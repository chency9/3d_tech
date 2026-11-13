"""Rebuild Mellis from the supplied reference: open thorax, dense wing cells,
telescoping abdomen, exposed reduction gears and articulated six-leg suspension.
"""
import bpy,sys,os,math
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0,os.path.join(ROOT,'blender'))
import mechanical_parts as p
from mechanical_parts import group,mesh,cyl,ring,gear,sphere,block,cable,bolt,hub,beam,sector_tube,helix,basis,V
from mechanical_parts import white,carbon,accent,metal,black,glass,brass
scene=next(s for s in bpy.data.scenes if s.name.startswith('BIOMECH'));bpy.context.window.scene=scene
old=scene.objects.get('Mellis_HB7')
if old:
    for obj in list(old.children_recursive)+[old]:bpy.data.objects.remove(obj,do_unlink=True)
collection=bpy.data.collections.new('Mellis HB-7 · REV 03 · micro flight machinery');scene.collection.children.link(collection);p.use_collection(collection)
membrane=p.mat('07','REV04 transparent wing film',(.88,.90,.86),.02,.62)
wing_vein=p.mat('09','REV04 pale chitin wing veins',(.66,.69,.65),.10,.75)
principled=next(n for n in membrane.node_tree.nodes if n.type=='BSDF_PRINCIPLED');principled.inputs['Alpha'].default_value=.045
membrane.diffuse_color=(.88,.90,.86,.045);membrane.surface_render_method='DITHERED'
root=group('Mellis_HB7');root['specimen']='Mellis HB-7';root['revision']=4
chassis=group('HB_chassis',parent=root)
body=group('HB_body',parent=chassis,assembly='body')
print('HB-7: open thorax and gear trains',flush=True)
for z in [-.60,-.28,.08,.42]:
    ring('Thorax titanium rib',(0,1.7,z),(0,0,1),.48,.055,metal,body,inner=.41,n=48)
    ring('Rib dampening gasket',(0,1.7,z+.032),(0,0,1),.445,.02,black,body,n=40)
for i in range(10):
    a=i*math.tau/10
    q=V((.44*math.cos(a),1.7+.44*math.sin(a),0))
    cyl('Longitudinal thorax stringer',q+V((0,0,-.66)),q+V((0,0,.48)),.028,carbon,body,n=16)
    cable('Curved signal loom',[q+V((0,0,-.6)),q+V((.04,.07,-.1)),q+V((0,0,.45))],.015,black,body)
motor=group('HB_motor',(0,1.73,-.02),body,assembly='motor',explode=(0,.38,0))
cyl('Axial motor body',(0,1.73,-.49),(0,1.73,.40),.24,carbon,motor,n=48)
for j in range(10):
    z=-.40+j*.075
    ring('Motor cooling fin',(0,1.73,z),(0,0,1),.285,.028,metal,motor,inner=.245,n=48)
for side in [-1,1]:
    drive=group('HB_drive_'+('L' if side<0 else 'R'),(side*.48,1.75,.0),body)
    gear('Thorax output gear',(side*.48,1.75,0),(1,0,0),.29,.085,32,carbon,drive)
    ring('Drive face titanium race',(side*.535,1.75,0),(1,0,0),.25,.035,metal,drive,n=48)
    ring('Orange crank track',(side*.56,1.75,0),(1,0,0),.202,.019,accent,drive,n=48)
    for j in range(3):
        a=j*math.tau/3
        gear('Satellite reduction pinion',(side*.57,1.75+.13*math.cos(a),.13*math.sin(a)),(1,0,0),.073,.04,12,brass,drive)
    for j in range(8):
        a=j*math.tau/8
        bolt('Transmission flange screw',(side*.59,1.75+.26*math.cos(a),.26*math.sin(a)),drive,(side,0,0),.018)
    cover=group('HB_thorax_cover_'+str(side),(side*.27,1.90,0),body,explode=(side*.48,.50,0))
    for j,z in enumerate([-.48,.10]):
        sector_tube('Ceramic thorax cheek',(0,1.70,z),(0,1.70,z+.25),.50,white,cover,start=0 if side>0 else math.pi,end=math.pi*.78 if side>0 else math.pi*1.78,n=32)
        for zz in [z+.045,z+.21]:
            bolt('Cover counterbore fixing',(side*.26,2.14,zz),cover,(0,1,0),.027)
    block('Identification orange strip',(side*.26,2.172,-.39),(.18,.014,.10),accent,cover,.006)
    for i in range(4):
        block('Service ventilation slot',(side*.29,2.145,-.48+i*.048),(.11,.016,.016),black,cover,.002)

print('HB-7: optics, antennal sensors and neck bearing',flush=True)
neck=group('HB_neck',(0,1.70,.57),chassis,assembly='head')
for z,r in [(.52,.28),(.59,.32),(.66,.28)]:ring('Neck bearing',(0,1.70,z),(0,0,1),r,.045,metal if z==.59 else carbon,neck,n=48)
head=group('HB_head',(0,1.70,.97),chassis,assembly='head',explode=(0,.10,.62))
sphere('Optical skull pressure liner',(0,1.70,.97),(.56,.47,.44),carbon,head)
forehead=group('HB_forehead_shell',(0,1.70,.97),head,explode=(0,.20,.32))
sphere('Continuous ceramic forehead',(0,1.70,.97),(.535,.49,.46),white,forehead)
for side in [-1,1]:
    cheek=group('HB_optic_shield_'+str(side),(side*.25,1.72,.95),head,explode=(side*.24,.15,0))
    sphere('Rounded ceramic optical housing',(side*.25,1.73,.97),(.35,.49,.44),white,cheek)
    for y in [1.45,2.00]:bolt('Optic panel fixing',(side*.46,y,.99),cheek,(side,0,0),.022)
    # Two forward-facing lateral objectives, each with an independent optical barrel.
    axis=V((side*.50,0,.8660254));center=V((side*.39,1.75,1.22))
    eye=group('HB_optic_'+('L' if side<0 else 'R'),center,head,explode=(side*.25,.04,.27))
    cyl('Stereo optical barrel',center-axis*.10,center+axis*.13,.273,carbon,eye,n=64)
    for depth,r,mat in [(.04,.285,white),(.11,.278,carbon),(.145,.259,accent),(.167,.237,metal)]:
        ring('Stereo concentric objective bezel',center+axis*depth,axis,r,.018,mat,eye,inner=r-.020,n=64)
    face=center+axis*.17
    cyl('Smoked sapphire objective',face-axis*.025,face,.218,glass,eye,n=64)
    _,u,v=basis(axis);verts=[];rings=12;steps=64
    for row in range(rings+1):
        radius=.213*row/rings
        for j in range(steps):
            angle=j*math.tau/steps
            verts.append(face+(u*math.cos(angle)+v*math.sin(angle))*radius+axis*(.037*math.sqrt(max(0,1-(radius/.213)**2))))
    mesh('Curved stereo optical glass',verts,[(k*steps+j,k*steps+(j+1)%steps,(k+1)*steps+(j+1)%steps,(k+1)*steps+j) for k in range(rings) for j in range(steps)],glass,eye,smooth=True)
    for radius in [.14,.19]:ring('Optical glass etched ring',face+axis*.023,axis,radius,.003,metal,eye,inner=radius-.0015,n=64)
    for j in range(8):
        angle=j*math.tau/8
        bolt('Stereo bezel retaining screw',center+axis*.163+(u*math.cos(angle)+v*math.sin(angle))*.272,eye,axis,.010)
for side in [-1,1]:
    q=V((side*.29,2.05,.85))
    antenna=group('HB_antenna_'+str(side),q,head,explode=(side*.22,.44,0))
    hub('Antennal universal joint',q,(1,0,0),.073,antenna,False)
    points=[q,q+V((side*.07,.33,-.05)),q+V((side*.20,.70,-.13)),q+V((side*.22,.91,-.18))]
    for j in range(3):
        cyl('Carbon antenna segment',points[j],points[j+1],.024-j*.004,carbon,antenna,n=20)
        ring('Antenna ferrule',points[j],points[j+1]-points[j],.031-j*.004,.035,metal,antenna,n=20)
    cyl('Vermilion sensor tip',points[-1]-V((0,.13,0)),points[-1]+V((0,.045,0)),.033,accent,antenna,r2=.019,n=24)

print('HB-7: telescopic abdomen and exposed recoil spring',flush=True)
abdomen=group('HB_abdomen',(0,1.62,-.66),chassis,assembly='abdomen',explode=(0,0,-.60))
cyl('Abdomen guide spindle',(0,1.62,-.55),(0,1.62,-2.38),.09,metal,abdomen,n=32)
spring=group('HB_abdomen_spring',(0,1.62,-.73),abdomen)
helix('Phosphor bronze recoil spring',(0,1.62,-.79),(0,1.62,-2.03),.25,12,.025,metal,spring)
for i in range(7):
    z=-.79-i*.22;r=.48*(1-(i/8.6)**1.7)
    band=group(f'HB_abdomen_ring_{i}',(0,1.62,z),abdomen)
    ring('Abdomen structural annulus',(0,1.62,z),(0,0,1),r*.88,.075,carbon,band,inner=r*.69,n=48)
    ring('Annular bearing flange',(0,1.62,z-.06),(0,0,1),r*.91,.02,metal,band,inner=r*.76,n=48)
    if i in [0,2,4,6]:
        for side in [-1,1]:
            skin=group(f'HB_abdomen_shell_{i}_{side}',(0,1.62,z),band,explode=(side*.28,.16,0))
            sector_tube('Split abdomen ceramic capsule',(0,1.62,z+.08),(0,1.62,z-.15),r,white,skin,start=.04 if side>0 else math.pi+.04,end=math.pi-.04 if side>0 else math.tau-.04,n=32)
            for j in range(3):
                a=side*math.pi/2+(j-1)*.65
                q=V((r*math.cos(a),1.62+r*math.sin(a),z-.03))
                bolt('Abdominal panel rivet',q,skin,(math.cos(a),math.sin(a),0),.019)
        ring('Abdominal orange sealing ring',(0,1.62,z-.155),(0,0,1),r*.96,.025,accent,band,n=48)
    for j in range(6):
        a=j*math.tau/6
        cyl('Abdomen alignment dowel',(r*.63*math.cos(a),1.62+r*.63*math.sin(a),z+.08),(r*.63*math.cos(a),1.62+r*.63*math.sin(a),z-.14),.021,metal,band,n=12)
terminal=group('HB_terminal',(0,1.62,-2.23),band)
cyl('Terminal microprobe',(0,1.62,-2.18),(0,1.62,-2.59),.12,carbon,terminal,r2=.006,n=40)

print('HB-7: reticulated four-wing structure',flush=True)
for side in [-1,1]:
    label='L' if side<0 else 'R'
    for i in range(2):
        base=V((side*.50,2.04,.16-i*.57));wing=group(f'HB_wing_{label}{i}',base,chassis,assembly='wings',explode=(side*.38,.33,-i*.15))
        length=3.16 if i==0 else 2.40;sweep=-.55 if i==0 else -1.05;width=.62 if i==0 else .50
        def point(t,v):return base+V((side*length*t,.10*math.sin(math.pi*t)+.14*t,sweep*t+v*width*math.sin(math.pi*t)**.72))
        nu=48;nv=14;vertices=[point(j/nu,-1+2*k/nv) for j in range(nu+1) for k in range(nv+1)]
        faces=[(j*(nv+1)+k,j*(nv+1)+k+1,(j+1)*(nv+1)+k+1,(j+1)*(nv+1)+k) for j in range(nu) for k in range(nv)]
        mesh('Transparent segmented aerodynamic film',vertices,faces,membrane,wing,smooth=True)
        for edge,r,mat in [(-1,.005,wing_vein),(1,.007,wing_vein)]:cable('Composite perimeter spar',[point(j/24,edge) for j in range(25)],r,mat,wing)
        cable('Vermilion wingtip trim',[point(j/32,1) for j in range(25,33)]+[point(j/32,-1) for j in range(31,24,-1)],.009,accent,wing)
        for v in [-.72,-.48,-.24,0,.24,.48,.72]:cable('Longitudinal micro spar',[point(j/24,v) for j in range(1,24)],.0025 if v else .004,wing_vein,wing)
        for j in range(1,17):
            t=j/18
            cable('Transverse rib',[point(t,-1),point(t+.008,-.5),point(t+.016,0),point(t+.008,.5),point(t,1)],.002,wing_vein,wing)
            for v in [-.72,-.24,.24,.72]:
                q=point(t+.012,v)
                cyl('Micro spar bonded node',q,q+V((0,.002,0)),.0045,wing_vein,wing,n=8)
        for j in range(1,7):
            t=j/9
            cable('Diagonal anti-shear brace',[point(t,-.95),point(t+.07,-.48)],.0018,wing_vein,wing)
            cable('Diagonal anti-shear brace',[point(t,.95),point(t+.07,.48)],.0018,wing_vein,wing)
        hub('Wing root output bearing',base,(0,0,1),.13,wing)
        crank=group(f'HB_wing_crank_{label}{i}',base,body)
        gear('Wing root reduction gear',base+V((0,-.06,0)),(0,0,1),.13,.035,24,brass,crank)
        cyl('Wing tendon pushrod',base+V((0,-.05,0)),V((side*.58,1.80,.06-i*.16)),.025,metal,crank,n=20)
    for i in range(3):
        z=.42-i*.49;hip=V((side*.45,1.49,z));knee=V((side*.98,.98,z+(.40-i*.38)));ankle=V((side*1.23,.28,z+(.67-i*.61)));foot=V((side*1.43,.10,z+(.75-i*.70)))
        leg=group(f'HB_leg_{label}{i}',hip,chassis,assembly='legs',explode=(side*.36,-.22,(1-i)*.20))
        hub('Coxa rotary actuator',hip,(0,0,1),.115,leg,False);beam('Femoral carbon link',hip,knee,.105,leg)
        tibia=group(f'HB_tibia_{label}{i}',knee,leg)
        hub('Knee actuator',knee,(0,0,1),.10,tibia,False);beam('Tibial telescopic strut',knee,ankle,.065,tibia)
        tarsus=group(f'HB_tarsus_{label}{i}',ankle,tibia)
        ring('Tarsal ball race',ankle,(0,0,1),.065,.04,accent,tarsus,n=24)
        cyl('Tarsal tendon',ankle,foot,.037,carbon,tarsus,r2=.025,n=20)
        for sign in [-1,1]:cable('Terminal gripping claw',[foot+V((sign*.04,.04,0)),foot+V((sign*.07,-.01,.08)),foot+V((sign*.025,0,.14))],.018,carbon,tarsus)
root['editable_meshes']=sum(obj.type=='MESH' for obj in root.children_recursive)
root['rigDescription']='Four reticulated wings, exposed thorax reduction gears, a spring-loaded telescoping abdomen, six two-link legs and paired stereo optics.'
visible=set(root.children_recursive)|{root}
for obj in scene.objects:
    if obj.type in {'MESH','CURVE','EMPTY'}:obj.hide_set(obj not in visible)
bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'blender','biomech-specimens.blend'))
print('HB7_EDITABLE_OBJECTS',len(root.children_recursive)+1,flush=True)
EXPORT_ONLY={'Mellis_HB7'}
exec(compile(open(os.path.join(ROOT,'blender','export_models.py'),encoding='utf-8').read(),os.path.join(ROOT,'blender','export_models.py'),'exec'))
