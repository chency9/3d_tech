"""Non-destructive REV03 armor additions to the precision IK mechanism.

Each split shell is parented to exactly one existing rigid link; no armor
bridges a moving joint. Re-running replaces only the REV03 collection.
"""
import bpy,sys,os,math,json
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0,os.path.join(ROOT,'blender'))
import mechanical_parts as p
from mechanical_parts import V,basis,group,mesh,ring,bolt,block,cable,sector_tube,panel
from mechanical_parts import white,carbon,accent,metal,black,brass
scene=next(s for s in bpy.data.scenes if s.name.startswith('BIOMECH'));bpy.context.window.scene=scene
collection_name='Telson SC-8 · REV 03 · articulated carapace'
old=bpy.data.collections.get(collection_name)
if old:
    for obj in list(old.objects):bpy.data.objects.remove(obj,do_unlink=True)
    bpy.data.collections.remove(old)
collection=bpy.data.collections.new(collection_name);scene.collection.children.link(collection);p.use_collection(collection)
root=scene.objects['Telson_SC8'];p.register_tree(root)
CFG=json.load(open(os.path.join(ROOT,'src','scorpion-config.json')))

def shell(name,a,z,r,parent,half,assembly='armor'):
    """Rounded, tapered double-wall ceramic carapace with a split service seam."""
    a,z=V(a),V(z);axis,u,v=basis(z-a)
    middle=(a+z)*.5
    direction=u*half
    part=group(name,middle,parent,assembly=assembly,explode=direction*.23+V((0,.09,0)))
    stations=[(.17,.73),(.22,.96),(.32,1.04),(.65,.94),(.78,.78),(.83,.60)]
    start=-math.pi*.46+(math.pi if half<0 else 0);n=32
    vertices=[]
    for inner in [False,True]:
        for t,scale in stations:
            radius=r*scale-(.026 if inner else 0)
            for j in range(n+1):
                angle=start+j/n*math.pi*.92
                vertices.append(a.lerp(z,t)+(u*math.cos(angle)+v*math.sin(angle)*.88)*radius)
    row=n+1;layer=len(stations)*row;faces=[]
    for side in [0,1]:
        base=side*layer
        for k in range(len(stations)-1):
            for j in range(n):
                q=base+k*row+j;faces.append((q,q+1,q+1+row,q+row))
    for k in [0,len(stations)-1]:
        for j in range(n):
            q=k*row+j;faces.append((q,q+1,q+1+layer,q+layer))
    for j in [0,n]:
        for k in range(len(stations)-1):
            q=k*row+j;faces.append((q,q+row,q+row+layer,q+layer))
    mesh(name+' hollow ceramic skin',vertices,faces,white,part,smooth=True)
    # Visible lips, captive fasteners and orange registration marks follow the shell.
    for t,scale in [stations[1],stations[-2]]:
        sector_tube(name+' graphite end gasket',a.lerp(z,t)-axis*.014,a.lerp(z,t)+axis*.014,r*scale*.93,black,part,inner=r*scale*.83,start=start,end=start+math.pi*.92,n=32)
        for frac in [.16,.84]:
            angle=start+frac*math.pi*.92
            normal=(u*math.cos(angle)+v*math.sin(angle)).normalized()
            bolt(name+' captive service fastener',a.lerp(z,t)+normal*r*scale,part,normal,.025)
    angle=start+math.pi*.46
    normal=u*math.cos(angle)+v*math.sin(angle)
    cable(name+' vermilion index inlay',[a.lerp(z,t)+normal*(r*sc+.006) for t,sc in stations[1:4]],.018,accent,part)
    return part

print('SC-8: split femoral, tibial and pedipalp carapaces',flush=True)
for leg in CFG['legs']:
    ident=leg['id']
    upper=scene.objects['SC_leg_'+ident+'_femur'];lower=scene.objects['SC_leg_'+ident+'_tibia']
    a=p.ORIGINS[upper.name];k=p.ORIGINS[lower.name];z=p.ORIGINS['SC_leg_'+ident+'_foot']
    for side in [-1,1]:
        shell('SC_femur_shell_'+ident+'_'+str(side),a,k,.245,upper,side)
        shell('SC_tibia_shell_'+ident+'_'+str(side),k,z,.173,lower,side)
for ident in ['L','R']:
    upper=scene.objects['SC_arm_'+ident+'_upper'];lower=scene.objects['SC_arm_'+ident+'_lower'];hand=scene.objects['SC_hand_'+ident]
    a=p.ORIGINS[upper.name];k=p.ORIGINS[lower.name];z=p.ORIGINS[hand.name]
    for side in [-1,1]:
        shell('SC_pedipalp_shell_'+ident+'_upper_'+str(side),a,k,.30,upper,side)
        shell('SC_pedipalp_shell_'+ident+'_lower_'+str(side),k,z,.27,lower,side)
    # Outer palm cheeks give the pincer a stout enclosing volume, with an open
    # dorsal service window through which the original jaw gears remain visible.
    palm=p.ORIGINS[hand.name]+V((0,-.02,.36))
    for side in [-1,1]:
        cover=group('SC_palm_cheek_'+ident+'_'+str(side),palm,hand,'armor',(side*.28,.16,0))
        block('Chela curved cheek',palm+V((side*.29,0,.02)),(.14,.32,.52),white,cover,.065)
        ring('Chela service port',palm+V((side*.365,0,.03)),(1,0,0),.095,.022,accent,cover,inner=.072,n=48)
        ring('Chela service locking collar',palm+V((side*.38,0,.03)),(1,0,0),.065,.025,metal,cover,inner=.045,n=40)
        for dz in [-.15,.20]:bolt('Chela side fastener',palm+V((side*.37,.08,dz)),cover,(side,0,0),.027)

print('SC-8: six caudal armor segments and pressure service modules',flush=True)
points=[V(q) for q in CFG['tailPoints']]
for i,(a,z) in enumerate(zip(points,points[1:])):
    parent=scene.objects[f'SC_tail_joint_{i}']
    for side in [-1,1]:shell(f'SC_caudal_carapace_{i}_{side}',a,z,.32 if i<4 else .27,parent,side)
    axis,u,v=basis(z-a)
    for t in [.12,.89]:ring('Caudal rotary dust seal',a.lerp(z,t),axis,.19 if i<4 else .16,.045,black,parent,n=48)

body=scene.objects['SC_body']
for side in [-1,1]:
    for i in range(3):
        center=V((side*.81,1.35,-.74+i*.7))
        service=group(f'SC_external_service_{side}_{i}',center,body,explode=(side*.26,.2,0))
        ring('Indexed hydraulic pressure port',center,(side,0,0),.083,.045,metal,service,inner=.061,n=40)
        ring('Pressure port orange seal',center+V((side*.035,0,0)),(side,0,0),.065,.018,accent,service,inner=.052,n=40)
        for j in range(6):
            theta=j*math.tau/6
            bolt('Manifold service screw',center+V((side*.025,math.sin(theta)*.11,math.cos(theta)*.11)),service,(side,0,0),.018)

root['revision']=3
root['editable_meshes']=sum(o.type=='MESH' for o in root.children_recursive)
root['rigDescription']='Eight IK legs and linked hydraulic pistons; split hollow ceramic limb and tail armor; geared pincers with removable service cheeks.'
visible=set(root.children_recursive)|{root}
for obj in scene.objects:
    if obj.type in {'MESH','CURVE','EMPTY'}:obj.hide_set(obj not in visible)
bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'blender','biomech-specimens.blend'))
print('SC8_EDITABLE_OBJECTS',len(root.children_recursive)+1,flush=True)
EXPORT_ONLY={'Telson_SC8'}
exec(compile(open(os.path.join(ROOT,'blender','export_models.py'),encoding='utf-8').read(),os.path.join(ROOT,'blender','export_models.py'),'exec'))
