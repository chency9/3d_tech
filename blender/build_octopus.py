"""Pelagos OC-8: eight articulated arms and an opening segmented pressure mantle.

Run in background with biomech-specimens.blend. Reference: supplied octopus.gif.
The shared JSON defines every arm link; no dimensions claim engineering validity.
"""
import bpy, sys, os, math, json
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0,os.path.join(ROOT,'blender'))
import mechanical_parts as p
from mechanical_parts import group,mesh,cyl,ring,gear,sphere,block,cable,bolt,hub,basis,V
from mechanical_parts import white,carbon,accent,metal,black,glass,brass
with open(os.path.join(ROOT,'src','octopus-config.json'),encoding='utf-8') as f: cfg=json.load(f)
scene=next(s for s in bpy.data.scenes if s.name.startswith('BIOMECH'))
bpy.context.window.scene=scene
old=scene.objects.get('Pelagos_OC8')
if old:
    for obj in list(old.children_recursive)+[old]:bpy.data.objects.remove(obj,do_unlink=True)
collection=bpy.data.collections.new('Pelagos OC-8 · precision articulated specimen')
scene.collection.children.link(collection);p.use_collection(collection)
root=group('Pelagos_OC8');root['specimen']='Pelagos OC-8';root['revision']=1
body=group('OC_body',parent=root,assembly='body')
C=V(cfg['center']);R=cfg['mantleRadius'];H=cfg['mantleHeight']

def surface(theta,phi,scale=1):
    return C+V((R*math.sin(phi)*math.cos(theta),H*math.cos(phi),R*math.sin(phi)*math.sin(theta)))*scale

def patch(name,a0,a1,p0,p1,parent,material=white,thickness=.045):
    nu=max(8,int((a1-a0)*25));nv=max(8,int((p1-p0)*22));verts=[]
    for layer in [0,1]:
        for j in range(nv+1):
            for i in range(nu+1):verts.append(surface(a0+(a1-a0)*i/nu,p0+(p1-p0)*j/nv,1-layer*thickness))
    stride=nu+1;count=(nu+1)*(nv+1);faces=[]
    for j in range(nv):
        for i in range(nu):
            q=j*stride+i;faces.extend([(q,q+1,q+1+stride,q+stride),(q+count,q+stride+count,q+stride+1+count,q+1+count)])
    for j in range(nv):
        for i in [0,nu]:
            q=j*stride+i;faces.append((q,q+stride,q+stride+count,q+count))
    for i in range(nu):
        for j in [0,nv]:
            q=j*stride+i;faces.append((q,q+1,q+1+count,q+count))
    return mesh(name,verts,faces,material,parent,smooth=True)

print('OC-8: pressure mantle and visible pump cartridge',flush=True)
core=group('OC_core',C,body,assembly='core',explode=(0,.65,0))
for y,r in [(1.42,.72),(1.63,.87),(1.88,.80),(2.13,.76),(2.42,.69),(2.70,.60),(2.98,.46),(3.18,.32)]:
    ring('Pump support bulkhead',(0,y,0),(0,1,0),r,.085,carbon,core,inner=r*.74,n=64)
    ring('Machined impeller seat',(0,y+.052,0),(0,1,0),r*.91,.018,metal,core,inner=r*.81,n=64)
    for i in range(12):
        a=i*math.tau/12
        bolt('Bulkhead cap screw',(r*.86*math.cos(a),y+.07,r*.86*math.sin(a)),core,size=.023)
for i in range(12):
    a=i*math.tau/12;d=V((math.cos(a),0,math.sin(a)));u=V((-math.sin(a),0,math.cos(a)))
    cyl('Titanium pressure-frame strut',V((0,1.52,0))+d*.73,V((0,3.12,0))+d*.27,.034,metal,core,n=16)
    cable('Braided hydraulic return',[V((0,1.70,0))+d*.78,V((0,2.30,0))+d*.70+u*.12,V((0,3.04,0))+d*.32],.024,black,core)
    for j in range(3):
        y=1.96+j*.31
        cyl('Axial motor winding',V((0,y,0))+d*.44,V((0,y+.20,0))+d*.44,.07,brass,core,n=20)
        for k in range(4):ring('Copper coil turn',V((0,y+.025+k*.045,0))+d*.44,(0,1,0),.074,.014,brass,core,n=20)
rotor=group('OC_rotor',(0,2.17,0),core)
cyl('Pump hollow drive spindle',(0,1.46,0),(0,3.34,0),.15,metal,rotor,n=48)
for j in range(3):
    y=1.88+j*.42
    gear('Pump planetary ring',(0,y,0),(0,1,0),.55-j*.05,.07,36,carbon,rotor)
    for i in range(6):
        a=i*math.tau/6
        gear('Planet gear',(math.cos(a)*.34,y+.055,math.sin(a)*.34),(0,1,0),.12,.06,14,brass,rotor)
        cyl('Planet spindle',(math.cos(a)*.34,y+.04,math.sin(a)*.34),(math.cos(a)*.34,y+.11,math.sin(a)*.34),.037,metal,rotor,n=16)

mantle=group('OC_mantle',C,body,assembly='mantle')
for i in range(8):
    a=i*math.tau/8
    lower=group(f'OC_lower_panel_{i}',C,body,assembly='mantle',explode=(math.cos(a)*.24,-.15,math.sin(a)*.24))
    patch('Lower ceramic pressure plate',a-.37,a+.37,1.53,2.55,lower)
    patch('Lower graphite seam',a-.383,a+.383,1.52,2.56,lower,black,.02)
    # Put the seam inside the outer shell, preserving a real air gap.
    seam=lower.children[-1];seam.scale=(.988,.988,.988)
    hinge=surface(a,1.49)
    petal=group(f'OC_mantle_petal_{i}',hinge,mantle,explode=(math.cos(a)*.24,.15,math.sin(a)*.24))
    petal['hingeAxis']=[-math.sin(a),0,math.cos(a)]
    patch('Upper petal crown',a-.368,a+.368,.14,.43,petal)
    patch('Upper petal lower armor',a-.368,a+.368,1.04,1.49,petal)
    patch('Window left structural strip',a-.368,a-.22,.43,1.04,petal)
    patch('Window right structural strip',a+.22,a+.368,.43,1.04,petal)
    for sign in [-1,1]:
        cable('Window machined frame',[surface(a+sign*.22,phi,1.002) for phi in [.43,.55,.7,.86,1.04]],.022,carbon,petal)
        for phi in [.30,.50,.71,.92,1.12,1.33]:
            q=surface(a+sign*.31,phi,1.014);axis=(q-C).normalized()
            bolt('Flush pressure-shell fastener',q,petal,axis,size=.025)
    patch('Orange inspection insert',a-.19,a+.19,1.09,1.18,petal,accent,.017)
    for k in range(5):
        theta=a-.14+k*.07
        q=surface(theta,1.13,1.014)
        cyl('Inspection panel relief',q,q+(q-C).normalized()*.008,.012,black,petal,n=12)
    hub('Mantle hinge cartridge',hinge,(-math.sin(a),0,math.cos(a)),.10,petal,False)
cap=group('OC_crown',(0,3.86,0),mantle,explode=(0,.65,0))
cyl('Crown access hatch',(0,3.83,0),(0,3.91,0),.22,carbon,cap,n=64)
ring('Hatch titanium gasket',(0,3.92,0),(0,1,0),.20,.018,metal,cap,n=48)
for i in range(6):
    a=i*math.tau/6;bolt('Hatch screw',(.16*math.cos(a),3.93,.16*math.sin(a)),cap,size=.023)

for side in [-1,1]:
    direction=V((side*.65,-.03,.76)).normalized();center=V((side*.70,2.16,.78))
    eye=group('OC_optic_'+('L' if side<0 else 'R'),center,body,assembly='optics',explode=list(direction*.46))
    cyl('Spherical optic collar',center-direction*.11,center+direction*.10,.39,white,eye,n=64)
    ring('Optic graphite seat',center+direction*.12,direction,.365,.07,carbon,eye,n=64)
    ring('Vermilion optic gasket',center+direction*.165,direction,.326,.025,accent,eye,n=64)
    cyl('Smoked sapphire lens',center+direction*.15,center+direction*.19,.29,glass,eye,n=64)
    ring('Lens aperture engraving',center+direction*.194,direction,.235,.009,metal,eye,inner=.229,n=64)
    _,u,v=basis(direction)
    for k in range(10):
        a=k*math.tau/10;q=center+direction*.20+(u*math.cos(a)+v*math.sin(a))*.145
        cyl('Optical iris blade',q,q+direction*.005,.035,carbon,eye,n=6)
    for k in range(8):
        a=k*math.tau/8;bolt('Optic bezel fixing',center+direction*.17+(u*math.cos(a)+v*math.sin(a))*.35,eye,direction,.018)

print('OC-8: eight twelve-link arms with suction valves',flush=True)
for arm in range(8):
    a=cfg['azimuthOffset']+arm*math.tau/8;d=V((math.cos(a),0,math.sin(a)));u=V((-math.sin(a),0,math.cos(a)))
    shoulder=d*cfg['shoulderRadius']+V((0,cfg['shoulderHeight'],0))
    base=group(f'OC_arm_{arm}',shoulder,body,assembly='arm2' if arm==1 else 'arms',explode=list(d*.65))
    hub('Shoulder rotary flange',shoulder,u,.26,base)
    previous=base;point=shoulder.copy()
    for j,length in enumerate(cfg['segmentLengths']):
        joint=group(f'OC_arm_{arm}_joint_{j}',point,previous)
        radius=.24*(1-j/15)**.9
        end=point+d*length
        hub('Wrist differential '+str(j),point,u,radius*.70,joint,False)
        cyl('Open graphite vertebra',point+d*.08,end-d*.025,radius*.73,carbon,joint,n=24)
        for sign in [-1,1]:
            # Two curved shell halves around an open longitudinal service channel.
            _,x,y=basis(d);verts=[];N=16
            for t in [.20,.86]:
                for k in range(N+1):
                    phi=(.18+k/N*(math.pi-.36))+(math.pi if sign<0 else 0)
                    verts.append(point+d*(length*t)+(x*math.cos(phi)+y*math.sin(phi))*radius)
            faces=[(k,k+1,k+N+2,k+N+1) for k in range(N)]
            o=mesh('Split ceramic arm fairing',verts,faces,white,joint,smooth=True)
            solid=o.modifiers.new('Shell wall thickness','SOLIDIFY');solid.thickness=.018
            for t in [.28,.74]:
                q=point+d*length*t+V((0,radius*.97,0))+u*sign*radius*.22
                bolt('Arm captive shell screw',q,joint,(0,1,0),max(.013,radius*.09))
        for t in [.18,.88]:
            ring('Vermilion pressure seal',point+d*length*t,d,radius*.94,.018,accent,joint,n=32)
        for sign in [-1,1]:
            cable('External tendon conduit',[point+u*sign*radius*.78,point+d*length*.5+u*sign*radius*.84,end+u*sign*radius*.70],.012 if j<7 else .008,black,joint)
            for t in [.36,.69]:
                q=point+d*length*t+u*sign*radius*.48-V((0,radius*.76,0));r=radius*.40
                cyl('Suction valve stem',q,q-V((0,.045,0)),r*.55,carbon,joint,n=20)
                ring('Ceramic suction bell',q-V((0,.052,0)),(0,1,0),r,.035,white,joint,inner=r*.61,n=24)
                ring('Elastomer suction lip',q-V((0,.072,0)),(0,1,0),r*.91,.016,black,joint,inner=r*.68,n=24)
        previous=joint;point=end
    tip=group(f'OC_arm_{arm}_tip',point,previous)
    sphere('Tactile tip sensor',point,(.075,.085,.075),carbon,tip)
    ring('Tip status bezel',point,(0,1,0),.064,.014,accent,tip,n=24)

siphon=group('OC_siphon',(0,1.35,.68),body,assembly='siphon',explode=(0,-.25,.60))
nozzle=V((0,-.42,.91)).normalized();start=V((0,1.35,.68))
cyl('Jet pressure nozzle',start-nozzle*.12,start+nozzle*.35,.31,carbon,siphon,r2=.24,n=48)
for t,r in [(.0,.32),(.22,.27),(.36,.245)]:ring('Nozzle service collar',start+nozzle*t,nozzle,r,.035,white,siphon,n=48)
ring('Jet outlet gasket',start+nozzle*.39,nozzle,.22,.025,accent,siphon,n=48)
fan=group('OC_jet_impeller',start+nozzle*.34,siphon)
gear('Jet impeller',start+nozzle*.34,nozzle,.18,.035,9,metal,fan)
beak=group('OC_beak',(0,1.12,0),body,assembly='beak',explode=(0,-.48,0))
ring('Mandible planetary seat',(0,1.13,0),(0,1,0),.38,.09,carbon,beak,n=48)
for side in [-1,1]:
    jaw=group('OC_beak_'+('L' if side<0 else 'R'),(side*.14,1.1,0),beak)
    cyl('Beak ceramic jaw',(side*.19,1.10,0),(side*.08,.77,.13),.11,white,jaw,r2=.014,n=32)
root['editable_meshes']=sum(1 for o in root.children_recursive if o.type=='MESH')
root['rigDescription']='8 independently curled arms, 12 serial links each, opening mantle petals, internal pump, optics, jet and beak.'
visible=set(root.children_recursive)|{root}
for obj in scene.objects:
    if obj.type in {'MESH','CURVE','EMPTY'}:obj.hide_set(obj not in visible)
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'blender','biomech-specimens.blend'))
print('OC8_EDITABLE_OBJECTS',len(root.children_recursive)+1,flush=True)
EXPORT_ONLY={'Pelagos_OC8'}
exec(compile(open(os.path.join(ROOT,'blender','export_models.py'),encoding='utf-8').read(),os.path.join(ROOT,'blender','export_models.py'),'exec'))
