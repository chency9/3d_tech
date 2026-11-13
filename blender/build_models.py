"""Rebuild the two reference-inspired, editable biomechanical models in Blender.

Run: blender --background --python blender/build_models.py -- /absolute/project
All dimensions are design units, not measurements of a manufactured robot.
The browser poses exported pivot groups; refinement can keep these stable names.
"""
import bpy
import math
import os
import sys
import json
from mathutils import Vector
from collections import defaultdict

ROOT = os.path.abspath(sys.argv[sys.argv.index('--') + 1]) if '--' in sys.argv else os.path.dirname(os.path.dirname(__file__))
OUT = os.path.join(ROOT, 'public', 'models')
os.makedirs(OUT, exist_ok=True)
scene = bpy.data.scenes.new('BIOMECH · Mechanical specimens')
bpy.context.window.scene = scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 0.1


def material(name, rgb, metal=0.0, rough=.45, alpha=1):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.diffuse_color = (*rgb, alpha)
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*rgb, alpha)
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Alpha'].default_value = alpha
    if alpha < 1:
        try:
            m.surface_render_method = 'DITHERED'
        except (TypeError, AttributeError):
            pass
    return m


ivory = material('01 · ceramic / warm ivory', (.78, .77, .72), .18, .47)
edge = material('02 · graphite / structure', (.055, .065, .07), .65, .43)
orange = material('03 · vermilion / moving assemblies', (.94, .14, .045), .25, .43)
steel = material('04 · titanium / machined surfaces', (.31, .35, .36), .82, .38)
rubber = material('05 · elastomer / seals', (.017, .023, .026), .05, .65)
lens = material('06 · optical glass / smoked', (.018, .045, .052), .65, .19)
membrane = material('07 · wing membrane', (.73, .79, .76), .14, .55, .19)
all_models = []


def group(name, loc=(0, 0, 0), parent=None, assembly=None):
    o = bpy.data.objects.new(name, None)
    scene.collection.objects.link(o)
    o.location = loc
    if parent:
        o.parent = parent
        o.matrix_parent_inverse = parent.matrix_world.inverted()
    if assembly:
        o['assembly'] = assembly
    return o


def finish(o, name, mat, parent):
    o.name = name
    o.data.materials.append(mat)
    for face in o.data.polygons:
        face.use_smooth = True
    if parent:
        bpy.context.view_layer.update()
        world = o.matrix_world.copy()
        o.parent = parent
        o.matrix_world = world
    return o


def ball(name, pos, scale, mat, parent):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, location=pos)
    o = bpy.context.object
    o.scale = scale
    return finish(o, name, mat, parent)


def box(name, pos, scale, mat, parent, bevel=.045):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    o = bpy.context.object
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new('Machined edge radii', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        mod = o.modifiers.new('Weighted surface normals', 'WEIGHTED_NORMAL')
    return finish(o, name, mat, parent)


def cylinder(name, a, b, radius, mat, parent, radius2=None, vertices=24):
    a, b = Vector(a), Vector(b)
    delta = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=radius if radius2 is None else radius2, depth=delta.length, location=(a+b)/2)
    o = bpy.context.object
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = delta.to_track_quat('Z', 'Y')
    return finish(o, name, mat, parent)


def ring(name, center, major, minor, mat, parent, axis=(0, 0, 1)):
    bpy.ops.mesh.primitive_torus_add(major_segments=32, minor_segments=8, location=center, major_radius=major, minor_radius=minor)
    o = bpy.context.object
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector(axis).to_track_quat('Z', 'Y')
    return finish(o, name, mat, parent)


def cable(name, points, radius, mat, parent):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.resolution_u = 8
    cu.bevel_depth = radius
    cu.bevel_resolution = 2
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(points)-1)
    for p, co in zip(sp.bezier_points, points):
        p.co = co
        p.handle_left_type = 'AUTO'
        p.handle_right_type = 'AUTO'
    ob = bpy.data.objects.new(name, cu)
    scene.collection.objects.link(ob)
    ob.data.materials.append(mat)
    if parent:
        bpy.context.view_layer.update()
        world = ob.matrix_world.copy()
        ob.parent = parent
        ob.matrix_world = world
    return ob


def bolt(name, p, parent, axis=(0,0,1), size=.045):
    p, d = Vector(p), Vector(axis)
    cylinder(name, p, p+d*.035, size, steel, parent, vertices=6)
    cylinder(name+' socket', p+d*.035, p+d*.038, size*.42, rubber, parent, vertices=6)


def joint(name, p, radius, parent, axis=(1,0,0)):
    p, v = Vector(p), Vector(axis)
    cylinder(name+' drum', p-v*.12, p+v*.12, radius, edge, parent)
    for s in [-1,1]:
        face = p+v*(s*.13)
        ring(name+' accent seal', face, radius*.84, .026, orange, parent, axis)
        cylinder(name+' hub', face-v*.01, face+v*.01, radius*.43, steel, parent)
        for angle in range(0,360,90):
            u = Vector((0, math.sin(math.radians(angle)), math.cos(math.radians(angle)))) if abs(v.x)>.5 else Vector((math.sin(math.radians(angle)), math.cos(math.radians(angle)),0))
            bolt(name+' fastener', face+u*radius*.62, parent, tuple(v*s), size=.025)


def link(name, a, b, radius, parent, armor=True):
    a,b = Vector(a), Vector(b)
    cylinder(name+' inner rod', a, b, radius*.58, steel, parent)
    delta=b-a
    if armor:
        center=(a+b)/2
        o=box(name+' ceramic fairing',center,(radius*1.75,radius*1.55,delta.length*.70),ivory,parent,radius*.24)
        o.rotation_mode='QUATERNION'
        o.rotation_quaternion=delta.to_track_quat('Z','Y')
    for t in [.15,.85]:
        center=a+delta*t
        cylinder(name+' end collar',center-delta.normalized()*.05,center+delta.normalized()*.05,radius*.90,edge,parent)


def build_scorpion():
    root=group('Telson_SC8')
    body=group('SC_body', parent=root, assembly='body')
    ball('Ventral armored chassis',(0,0,1.24),(.77,1.32,.42),edge,body)
    for i in range(6):
        y=-.95+i*.40
        w=.76*(1-.13*abs(i-2.5)/2.5)
        plate=box('Dorsal ceramic segment %02d'%i,(0,y,1.60),(w*1.8,.33,.29),ivory,body,.10)
        box('Dorsal spine seam',(0,y,1.76),(.06,.31,.016),edge,body,.005)
        for side in [-1,1]:
            box('Segment vermilion marking',(side*w*.75,y+.045,1.765),(.22,.055,.018),orange,body,.004)
            bolt('Dorsal plate bolt',(side*w*.57,y-.09,1.76),body)
            for vent in range(3):
                box('Heat exchanger slot',(side*.68,y-.10+vent*.075,1.43),(.03,.045,.14),rubber,body,.008)
    # Exposed internal spine, wiring and actuators remain visible when armor lifts.
    cylinder('Spinal transmission',(0,-1.22,1.27),(0,1.32,1.27),.17,steel,body)
    for side in [-1,1]:
        cable('Orange power loom',[(side*.5,-1.2,1.32),(side*.62,-.6,1.51),(side*.59,.65,1.5),(side*.32,1.25,1.38)],.032,orange,body)
    head=group('SC_head',(0,-1.28,1.3),root,'head')
    ball('Cephalothorax mask',(0,-1.34,1.4),(.61,.45,.37),ivory,head)
    for x in [-.31,-.105,.105,.31]:
        cylinder('Optic bezel',(x,-1.70,1.50),(x,-1.80,1.50),.085,edge,head)
        ball('Compound optic',(x,-1.80,1.50),(.066,.036,.066),lens,head)
    for side in [-1,1]:
        for i in range(4):
            y=-.85+i*.57
            hip=(side*.68,y,1.32)
            elbow=(side*1.24,y+(.15 if i>1 else -.15),1.32)
            knee=(side*(1.91+.12*math.sin(i)),y+(i-1.5)*.32,1.08)
            foot=(side*(2.36+.12*math.sin(i)),y+(i-1.5)*.56,.09)
            leg=group('SC_leg_%s%d'%('L' if side<0 else 'R',i),hip,root,'legs')
            joint('Coxa drive',hip,.18,leg,axis=(0,0,1))
            link('Coxa',hip,elbow,.14,leg)
            joint('Femur drive',elbow,.19,leg)
            link('Femur',elbow,knee,.17,leg)
            joint('Tibia drive',knee,.17,leg)
            link('Tibia',knee,foot,.115,leg)
            ball('Ground contact',foot,(.09,.12,.08),rubber,leg)
            cable('Leg signal cable',[hip,(side*1.30,y,1.5),knee],.018,edge,leg)
        shoulder=(side*.60,-1.05,1.25)
        elbow=(side*1.12,-1.88,1.13)
        wrist=(side*1.32,-2.55,.98)
        palm=(side*1.33,-2.88,.95)
        claw=group('SC_claw_'+('L' if side<0 else 'R'),shoulder,root,'claws')
        joint('Pedipalp shoulder',shoulder,.23,claw)
        link('Pedipalp upper',shoulder,elbow,.23,claw)
        joint('Pedipalp elbow',elbow,.21,claw)
        link('Pedipalp forearm',elbow,wrist,.24,claw)
        cylinder('Wrist ring',(wrist[0],wrist[1]+.15,wrist[2]),(wrist[0],wrist[1]-.10,wrist[2]),.26,orange,claw)
        ball('Chela palm',palm,(.29,.40,.24),ivory,claw)
        for jawside in [-1,1]:
            pivot=(palm[0]+jawside*.19,palm[1]-.19,palm[2])
            jaw=group('SC_jaw_%s_%s'%('L' if side<0 else 'R','a' if jawside<0 else 'b'),pivot,claw)
            points=[pivot,(pivot[0]+jawside*.23,-3.40,.94),(pivot[0]+jawside*.18,-3.80,.92),(palm[0],-4.08,.91)]
            for k in range(3):
                cylinder('Pincer tapered armor',points[k],points[k+1],.16-k*.045,ivory if k<2 else edge,jaw,radius2=.115-k*.05)
            cylinder('Inner gripping tooth',(pivot[0]+jawside*.15,-3.52,.94),(pivot[0]+jawside*.01,-3.56,.94),.065,edge,jaw,radius2=.01)
            joint('Chela hinge',pivot,.11,jaw,axis=(0,0,1))
    tailpoints=[(0,1.12,1.38),(0,1.86,1.88),(0,2.10,2.65),(0,1.82,3.40),(0,1.15,3.91),(0,.37,3.95),(0,-.21,3.44)]
    tailbase=group('SC_tail',tailpoints[0],root,'tail')
    previous=tailbase
    for i in range(len(tailpoints)-1):
        a,b=Vector(tailpoints[i]),Vector(tailpoints[i+1])
        seg=group('SC_tail_joint_%d'%i,a,previous)
        bpy.context.view_layer.update()
        # The pivot is world positioned, and the chain keeps that transform.
        seg.matrix_world.translation=a
        joint('Caudal servo %d'%i,a,.28 if i<4 else .23,seg)
        link('Tail segment %d'%i,a,b,.31 if i<4 else .25,seg)
        for side in [-1,1]:
            off=Vector((side*.21,0,0))
            cable('Tail hydraulic line',[a+off,(a+b)/2+off+Vector((0,.07,.07)),b+off],.024,edge,seg)
        previous=seg
    tip=tailpoints[-1]
    ball('Telson capsule',tip,(.28,.30,.34),ivory,previous)
    ring('Telson warning band',(0,-.29,3.34),.235,.037,orange,previous,axis=(0,1,.5))
    cylinder('Hardened stinger',tip,(0,-.68,2.88),.16,edge,previous,radius2=.018)
    root['specimen']='Telson SC-8'
    all_models.append(root)
    return root


def build_bee():
    root=group('Mellis_HB7')
    thorax=group('HB_body',parent=root,assembly='body')
    ball('Thorax carbon core',(0,0,1.56),(.60,.83,.53),edge,thorax)
    for side in [-1,1]:
        ball('Thorax ceramic fairing',(side*.44,-.03,1.66),(.21,.62,.41),ivory,thorax)
        for i in range(5):
            box('Thorax vent',(side*.57,-.34+i*.16,1.77),(.025,.065,.24),rubber,thorax,.01)
        cable('Power bus',[(side*.45,-.62,1.5),(side*.6,0,1.35),(side*.4,.65,1.5)],.038,orange,thorax)
        for j in [-1,1]:
            joint('Wing transmission',(side*.54,j*.28,1.89),.20,thorax)
    box('Dorsal inspection plate',(0,-.05,2.06),(.58,.65,.09),ivory,thorax,.07)
    for x in [-.22,.22]:
        for y in [-.27,.18]:
            bolt('Thorax plate bolt',(x,y,2.11),thorax)
    head=group('HB_head',(0,-1.02,1.62),root,'head')
    ball('Cranium shell',(0,-1.02,1.63),(.59,.52,.53),ivory,head)
    cylinder('Camera graphite bezel',(0,-1.34,1.65),(0,-1.58,1.65),.385,edge,head)
    ring('Optic vermilion seal',(0,-1.59,1.65),.345,.032,orange,head,axis=(0,1,0))
    cylinder('Camera front',(0,-1.59,1.65),(0,-1.65,1.65),.292,lens,head)
    ring('Concentric optic',(0,-1.656,1.65),.211,.014,steel,head,axis=(0,1,0))
    ball('Camera lens',(0,-1.67,1.65),(.17,.052,.17),lens,head)
    for side in [-1,1]:
        ball('Optic reflection',(side*.10,-1.72,1.76),(.045,.013,.024),ivory,head)
        cable('Sensor antenna',[(side*.30,-1.14,2.04),(side*.42,-1.20,2.51),(side*.61,-1.28,2.94)],.035,edge,head)
        cylinder('Antenna signal tip',(side*.56,-1.26,2.82),(side*.63,-1.29,3.04),.055,orange,head,radius2=.035)
    abdomen=group('HB_abdomen',(0,.76,1.53),root,'abdomen')
    cylinder('Abdomen central spindle',(0,.6,1.53),(0,2.50,1.53),.15,steel,abdomen)
    for i in range(7):
        y=.78+i*.245
        r=.49*(1-(i/8)**1.7)
        band=group('HB_abdomen_ring_%d'%i,(0,y,1.53),abdomen)
        ball('Segment %d ceramic shell'%i,(0,y,1.53),(r,.185,r*.88),ivory if i%2==0 else edge,band)
        ring('Abdomen segment seal',(0,y+.105,1.53),r*.86,.023,orange if i in [0,3,5] else steel,band,axis=(0,1,0))
        for side in [-1,1]:
            bolt('Abdomen shell fixing',(side*r*.65,y,1.53+r*.66),band,size=.028)
    cylinder('Terminal sting',(0,2.30,1.53),(0,2.91,1.53),.13,edge,abdomen,radius2=.008)
    for side in [-1,1]:
        for i in range(3):
            y=-.46+i*.52
            hip=(side*.48,y,1.42)
            knee=(side*1.02,y+(i-1)*.36,.94)
            ankle=(side*1.32,y+(i-1)*.71,.22)
            foot=(side*1.58,y+(i-1)*.85,.08)
            leg=group('HB_leg_%s%d'%('L' if side<0 else 'R',i),hip,root,'legs')
            joint('Coxa ball joint',hip,.13,leg)
            link('Femur',hip,knee,.11,leg)
            joint('Tibial joint',knee,.12,leg)
            link('Tibia',knee,ankle,.065,leg)
            cylinder('Tarsus',ankle,foot,.047,edge,leg,radius2=.025)
            ball('Tarsal pad',foot,(.07,.13,.055),rubber,leg)
        for i in range(2):
            base=Vector((side*.49,-.27+i*.58,1.98))
            wing=group('HB_wing_%s%d'%('L' if side<0 else 'R',i),base,root,'wings')
            length=2.88 if i==0 else 2.10
            sweep=-.32 if i==0 else .72
            width=.57 if i==0 else .44
            def wpoint(t, v):
                return base+Vector((side*length*t,sweep*t+v*width*math.sin(math.pi*t)**.72,.19*math.sin(math.pi*t)+.14*t))
            perimeter=[wpoint(j/20,1) for j in range(21)]+[wpoint(j/20,-1) for j in range(19,0,-1)]
            mesh=bpy.data.meshes.new('Reticulated membrane')
            mesh.from_pydata([tuple(p) for p in perimeter],[],[tuple(range(len(perimeter)))])
            ob=bpy.data.objects.new('Transparent aerodynamic membrane',mesh)
            scene.collection.objects.link(ob)
            finish(ob,ob.name,membrane,wing)
            cable('Leading edge spar',[wpoint(j/10,1) for j in range(11)],.022,edge,wing)
            cable('Trailing edge spar',[wpoint(j/10,-1) for j in range(11)],.014,steel,wing)
            cable('Wingtip vermilion trim',[wpoint(j/20,1) for j in range(15,21)]+[wpoint(j/20,-1) for j in range(19,14,-1)],.034,orange,wing)
            cable('Longitudinal spar',[wpoint(j/10,0) for j in range(11)],.014,edge,wing)
            for t in [.15,.28,.40,.52,.64,.76,.87,.94]:
                cable('Transverse membrane rib',[wpoint(t,-1),wpoint(t+.025,0),wpoint(t,1)],.0085,steel,wing)
            for v in [-.5,.5]:
                cable('Secondary longitudinal vein',[wpoint(j/10,v) for j in range(1,10)],.007,steel,wing)
            joint('Wing root bearing',base,.13,wing)
    root['specimen']='Mellis HB-7'
    all_models.append(root)
    return root


print('Building Telson SC-8...',flush=True)
scorpion=build_scorpion()
print('Building Mellis HB-7...',flush=True)
bee=build_bee()
bpy.context.view_layer.update()

# A clean studio camera and editable light rig for continued Blender refinement.
world=bpy.data.worlds.new('Warm studio')
scene.world=world
world.use_nodes=True
bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND')
bg.inputs['Color'].default_value=(.77,.75,.70,1)
bg.inputs['Strength'].default_value=.45
for name,pos,power,size in [('Key softbox',(3,-4,8),1000,7),('Fill softbox',(-5,-1,4),700,6),('Rim softbox',(1,5,6),1100,4)]:
    data=bpy.data.lights.new(name,'AREA')
    data.energy=power
    data.shape='DISK'
    data.size=size
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    obj.location=pos
    obj.rotation_euler=(Vector((0,0,1.5))-obj.location).to_track_quat('-Z','Y').to_euler()
camdata=bpy.data.cameras.new('Specimen camera')
cam=bpy.data.objects.new('Specimen camera',camdata)
scene.collection.objects.link(cam)
cam.location=(7,-9,6)
cam.rotation_euler=(Vector((0,-.3,1.7))-cam.location).to_track_quat('-Z','Y').to_euler()
camdata.type='ORTHO'
camdata.ortho_scale=9
scene.camera=cam
scene.render.resolution_x=1600
scene.render.resolution_y=1100
scene.render.resolution_percentage=100
scene['notes']='Reference-inspired concept mechanisms. Design units; not an engineering-validated physical product. Keep pivot names when refining for the website.'


def descendants(root):
    return [root]+list(root.children_recursive)


# Save the full editable originals before export-time batching. Keep two collections
# and show only the scorpion initially, so the saved viewport is immediately usable.
for root in all_models:
    collection=bpy.data.collections.new(root.name+' · editable')
    scene.collection.children.link(collection)
    for obj in descendants(root):
        for col in list(obj.users_collection):
            col.objects.unlink(obj)
        collection.objects.link(obj)
        if root==bee:
            obj.hide_set(True)
bpy.ops.object.select_all(action='DESELECT')
scorpion.select_set(True)
bpy.context.view_layer.objects.active=scorpion
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_distance=12
        area.spaces.active.region_3d.view_location=(0,0,1.7)
blend_path=os.path.join(ROOT,'blender','biomech-specimens.blend')
bpy.ops.wm.save_as_mainfile(filepath=blend_path)

manifest=[]
for root,filename in [(scorpion,'telson-sc8.glb'),(bee,'mellis-hb7.glb')]:
    obs=descendants(root)
    for o in obs:
        o.hide_set(False)
    # Batch by rigid pivot AND material to reduce draw calls without destroying rigs.
    buckets=defaultdict(list)
    for o in obs:
        if o.type in {'MESH','CURVE'}:
            buckets[(o.parent.name,o.data.materials[0].name)].append(o)
    print('Optimizing',filename,len(obs),'editable objects',len(buckets),'material batches',flush=True)
    for (parent_name,mat_name),items in buckets.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in items:
            o.select_set(True)
        bpy.context.view_layer.objects.active=items[0]
        bpy.ops.object.convert(target='MESH')
        bpy.ops.object.join()
        ob=bpy.context.object
        ob.name=parent_name+'__'+mat_name.split(' · ')[0]
    bpy.ops.object.select_all(action='DESELECT')
    for o in descendants(root):
        o.select_set(True)
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,filename),export_format='GLB',use_selection=True,use_active_scene=True,export_extras=True,export_animations=False,export_yup=True,export_apply=True)
    meshes=[o for o in descendants(root) if o.type=='MESH']
    manifest.append({'file':filename,'specimen':root['specimen'],'editable_objects':len(obs),'draw_batches':len(meshes),'vertices':sum(len(o.data.vertices) for o in meshes),'bytes':os.path.getsize(os.path.join(OUT,filename))})
with open(os.path.join(OUT,'manifest.json'),'w',encoding='utf-8') as f:
    json.dump(manifest,f,indent=2)
print(json.dumps(manifest),flush=True)
print('Saved editable source:',blend_path,flush=True)
