"""SC-8 revision 02: layered hard-surface model with independent limb segments.

Run in background with biomech-specimens.blend loaded; preserves the bee.
Construction coordinates use the web renderer's X/right, Y/up, Z/front axes.
The shared JSON supplies real rest lengths to both geometry and IK.
"""
import bpy, bmesh, math, json, os
from mathutils import Vector

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with open(os.path.join(ROOT,'src','scorpion-config.json'),encoding='utf-8') as f:
    CFG=json.load(f)
scene=next(s for s in bpy.data.scenes if s.name.startswith('BIOMECH'))
bpy.context.window.scene=scene
old=scene.objects.get('Telson_SC8')
if old:
    for o in list(old.children_recursive)+[old]:
        bpy.data.objects.remove(o,do_unlink=True)
collection=bpy.data.collections.new('Telson SC-8 · REV 02 · precision assemblies')
scene.collection.children.link(collection)
ORIGINS={}
COUNTS={}
V=Vector

def b(v): return (v[0],-v[2],v[1])

def mat(prefix,name,rgb,metal=.0,rough=.45):
    m=bpy.data.materials.new(prefix+' · '+name)
    m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value=(*rgb,1)
    p.inputs['Metallic'].default_value=metal
    p.inputs['Roughness'].default_value=rough
    m.diffuse_color=(*rgb,1)
    return m

white=mat('01','REV02 zirconia ceramic',(.62,.65,.63),.24,.43)
carbon=mat('02','REV02 graphite anodized chassis',(.025,.034,.037),.65,.42)
accent=mat('03','REV02 vermilion actuator markings',(.79,.055,.015),.35,.37)
metal=mat('04','REV02 brushed titanium',(.22,.28,.30),.83,.36)
black=mat('05','REV02 fluoropolymer seals',(.009,.013,.014),.10,.64)
glass=mat('06','REV02 smoked sapphire optic',(.009,.028,.033),.8,.16)
brass=mat('08','REV02 phosphor bronze bearings',(.36,.19,.07),.83,.38)

def group(name,point=(0,0,0),parent=None,assembly=None,explode=None,detail=None):
    o=bpy.data.objects.new(name,None);collection.objects.link(o)
    o.empty_display_size=.10
    ORIGINS[name]=V(point)
    o.parent=parent
    o.location=b(V(point)-(ORIGINS[parent.name] if parent else V((0,0,0))))
    if assembly:o['assembly']=assembly
    if explode is not None:o['explodeVector']=list(explode)
    if detail:o['detail']=detail
    return o

def mesh(name,vertices,faces,material,parent,bevel=0,smooth=False):
    origin=ORIGINS[parent.name]
    data=bpy.data.meshes.new(name)
    data.from_pydata([b(V(v)-origin) for v in vertices],[],faces)
    data.materials.append(material)
    data.update()
    bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
    o=bpy.data.objects.new(name,data);collection.objects.link(o);o.parent=parent
    if smooth:
        for p in data.polygons:p.use_smooth=len(p.vertices)==4
    if bevel:
        m=o.modifiers.new('CNC edge chamfer','BEVEL');m.width=bevel;m.segments=2
        m=o.modifiers.new('Machined face normals','WEIGHTED_NORMAL');m.keep_sharp=True
    COUNTS[material.name]=COUNTS.get(material.name,0)+1
    return o

def basis(axis):
    n=V(axis).normalized()
    u=n.cross(V((0,1,0)) if abs(n.y)<.9 else V((1,0,0))).normalized()
    return n,u,n.cross(u)

def cyl(name,a,z,r,material,parent,r2=None,n=20):
    a,z=V(a),V(z);_,u,v=basis(z-a)
    r2=r if r2 is None else r2
    verts=[p+(u*math.cos(i*math.tau/n)+v*math.sin(i*math.tau/n))*rad for p,rad in [(a,r),(z,r2)] for i in range(n)]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,verts,faces,material,parent,smooth=True)

def ring(name,p,axis,r,width,material,parent,inner=None,n=32):
    p=V(p);axis,u,v=basis(axis);inner=r*.77 if inner is None else inner
    verts=[p+axis*d+(u*math.cos(i*math.tau/n)+v*math.sin(i*math.tau/n))*rad for d,rad in [(-width/2,r),(width/2,r),(-width/2,inner),(width/2,inner)] for i in range(n)]
    faces=[]
    for i in range(n):
        j=(i+1)%n
        faces.extend([(i,j,j+n,i+n),(i+2*n,i+3*n,j+3*n,j+2*n),(i,i+2*n,j+2*n,j),(i+n,j+n,j+3*n,i+3*n)])
    return mesh(name,verts,faces,material,parent,smooth=True)

def gear(name,p,axis,r,depth,teeth,material,parent):
    p=V(p);axis,u,v=basis(axis);n=teeth*4
    verts=[]
    for d in [-depth/2,depth/2]:
        for i in range(n):
            rad=r*(1 if i%4 in [1,2] else .86)
            verts.append(p+axis*d+(u*math.cos(i*math.tau/n)+v*math.sin(i*math.tau/n))*rad)
    return mesh(name,verts,[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],material,parent,bevel=.004)

def sphere(name,p,scale,material,parent):
    p=V(p);verts=[];n=24;rows=12
    for j in range(rows+1):
        t=math.pi*j/rows
        for i in range(n):
            a=math.tau*i/n
            verts.append(p+V((scale[0]*math.sin(t)*math.cos(a),scale[1]*math.cos(t),scale[2]*math.sin(t)*math.sin(a))))
    faces=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(rows) for i in range(n)]
    return mesh(name,verts,faces,material,parent,smooth=True)

def block(name,p,size,material,parent,bevel=.018):
    p=V(p);x,y,z=[k/2 for k in size]
    verts=[p+V(v) for v in [(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)]]
    return mesh(name,verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)],material,parent,bevel)

def panel(name,outline,y,thick,material,parent,bevel=.018):
    n=len(outline)
    verts=[(x,h,z) for h in [y-thick/2,y+thick/2] for x,z in outline]
    return mesh(name,verts,[tuple(range(n)),tuple(reversed(range(n,2*n)))]+[(i,i+n,(i+1)%n+n,(i+1)%n) for i in range(n)],material,parent,bevel)

def cable(name,points,r,material,parent):
    # An editable bezier spline, converted and batched only in the web export.
    cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=5;cu.bevel_depth=r;cu.bevel_resolution=1
    s=cu.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
    for bp,p in zip(s.bezier_points,points):
        bp.co=b(V(p)-ORIGINS[parent.name]);bp.handle_left_type='AUTO';bp.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,cu);collection.objects.link(o);o.parent=parent;cu.materials.append(material)
    return o

def bolt(name,p,parent,axis=(0,1,0),size=.033):
    p=V(p);a=V(axis).normalized()
    ring(name+' seating washer',p,a,size*1.35,.012,metal,parent,n=16)
    cyl(name+' titanium hex head',p,p+a*.025,size,metal,parent,n=6)
    cyl(name+' hex socket',p+a*.025,p+a*.028,size*.45,black,parent,n=6)

def hub(name,p,axis,r,parent,detail=True):
    p=V(p);axis,u,v=basis(axis)
    cyl(name+' reduction housing',p-axis*.13,p+axis*.13,r,carbon,parent,n=32)
    for side in [-1,1]:
        face=p+axis*side*.145
        ring(name+' precision bearing',face,axis,r*.92,.035,metal,parent,inner=r*.79)
        ring(name+' orange seal',face+axis*side*.022,axis,r*.77,.018,accent,parent,inner=r*.68)
        gear(name+' exposed reduction gear',face+axis*side*.035,axis,r*.61,.022,16,brass,parent)
        cyl(name+' output hub',face,face+axis*side*.075,r*.27,carbon,parent,n=24)
        cyl(name+' shaft end',face+axis*side*.076,face+axis*side*.08,r*.13,metal,parent,n=6)
        for i in range(6):
            a=i*math.tau/6
            q=face+(u*math.cos(a)+v*math.sin(a))*r*.84
            bolt(name+' flange fixing',q,parent,axis*side,size=.019)
        if detail:
            for i in range(12):
                a=i*math.tau/12
                q=face+(u*math.cos(a)+v*math.sin(a))*r*.48
                cyl(name+' radial milling pocket',q+axis*side*.047,q+axis*side*.051,r*.045,black,parent,n=8)

def beam(name,a,z,w,parent,armor=True):
    a,z=V(a),V(z);direction,u,v=basis(z-a)
    length=(z-a).length
    cyl(name+' central titanium spine',a,z,w*.40,metal,parent,n=16)
    for side in [-1,1]:
        off=u*w*.7*side
        cyl(name+' carbon tie rod',a+off,z+off,w*.17,carbon,parent,n=12)
        for t in [.15,.84]:
            c=a.lerp(z,t)+off
            ring(name+' rod clamp',c,direction,w*.24,.05,metal,parent,n=16)
        if armor:
            # Tapered split fairing with an open center channel.
            verts=[]
            for t,width in [(.18,w),(.80,w*.80)]:
                c=a.lerp(z,t)+u*side*w*.75
                for uu,vv in [(-.30,-.58),(.30,-.58),(.38,.40),(-.38,.58)]:
                    verts.append(c+u*uu*width+v*vv*width)
            mesh(name+' split ceramic rail',verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)],white,parent,bevel=.018)
    for t in [.18,.48,.78]:
        center=a.lerp(z,t)
        cyl(name+' transverse brace',center-u*w*.85,center+u*w*.85,w*.12,carbon,parent,n=12)
        for s in [-1,1]:bolt(name+' rail fastener',center+u*w*.83*s,parent,u*s,.022)
    # Exposed, nested piston housed within this rigid link.
    offset=v*w*.63
    cyl(name+' hydraulic barrel',a+direction*.13+offset,a+direction*length*.60+offset,w*.28,carbon,parent,n=20)
    ring(name+' gland',a+direction*length*.60+offset,direction,w*.33,.045,accent,parent,n=20)
    cyl(name+' polished piston',a+direction*length*.57+offset,z-direction*.07+offset,w*.13,metal,parent,n=16)
    cable(name+' signal loom',[a+v*w*.8,a.lerp(z,.45)+v*w*.92,z+v*w*.55],.012,black,parent)

def leg_rest(leg):
    hip,foot=V(leg['hip']),V(leg['foot']);h=foot-hip;h.y=0;h.normalize()
    coxa=hip+h*CFG['coxaLength']
    d=foot-coxa;length=d.length;n=d.normalized()
    bend=V((0,1,0))-n*n.y;bend.normalize()
    a=(CFG['femurLength']**2-CFG['tibiaLength']**2+length**2)/(2*length)
    knee=coxa+n*a+bend*math.sqrt(CFG['femurLength']**2-a*a)
    return hip,coxa,knee,foot

root=group('Telson_SC8');root['specimen']='Telson SC-8';root['revision']=2
chassis=group('SC_chassis',parent=root)
body=group('SC_body',parent=chassis,assembly='body')
print('Building layered chassis',flush=True)

# A visibly open truss frame, with removable armor leaves instead of a sealed blob.
for side in [-1,1]:
    cyl('Longitudinal titanium frame',(side*.60,1.20,-1.25),(side*.60,1.20,1.25),.075,metal,body)
    cyl('Lower carbon stringer',(side*.51,.98,-1.15),(side*.51,.98,1.15),.055,carbon,body)
for i in range(7):
    z=-1.18+i*.39
    beam('Rib %02d'%i,(-.72,1.28,z),(.72,1.28,z),.12,body,False)
    for s in [-1,1]:
        cyl('Diagonal spaceframe',(s*.60,1.22,z),(s*.48,.98,z+.27),.027,metal,body,n=12)
core=group('SC_power_core',(0,1.25,0),body,assembly='power',explode=(0,.5,0),detail='POWER CORE')
block('Battery carbon enclosure',(0,1.27,-.45),(.62,.38,1.05),carbon,core,.055)
for i in range(8):
    z=-.91+i*.13
    block('Cooling fin',(0,1.50,z),(.67,.075,.032),metal,core,.006)
for s in [-1,1]:
    for i in range(4):
        z=-.90+i*.59
        cyl('Accumulator cartridge',(s*.65,1.22,z),(s*.65,1.49,z),.095,carbon,body,n=20)
        ring('Accumulator service collar',(s*.65,1.47,z),(0,1,0),.102,.045,accent,body)
        cyl('Service port',(s*.65,1.49,z),(s*.65,1.56,z),.037,brass,body,n=6)
        cable('Hydraulic feed manifold',[(s*.65,1.42,z),(s*.79,1.38,z+.08),(s*.84,1.34,z+.15)],.025,black,body)
for i in range(6):
    z=-1.08+i*.40
    for s in [-1,1]:
        deck=group('SC_armor_%s_%d'%('L' if s<0 else 'R',i),(s*.4,1.65,z),body,assembly='armor',explode=(s*.38,.62+i*.045,0),detail='DORSAL ARMOR')
        # Chamfered chamfer-profile leaves with a recessed center channel.
        outline=[(s*.13,z-.15),(s*.62,z-.17),(s*.80,z-.07),(s*.75,z+.12),(s*.55,z+.18),(s*.13,z+.13)]
        panel('Armored leaf / %02d'%i,outline,1.62,.11,white,deck,.025)
        panel('Graphite backing',[(x*.98,zz) for x,zz in outline],1.54,.055,carbon,deck,.016)
        for k in range(3):
            slot=[(s*.44,z-.09+k*.06),(s*.69,z-.11+k*.06),(s*.70,z-.087+k*.06),(s*.46,z-.067+k*.06)]
            panel('Recessed cooling louvre',slot,1.682,.010,black,deck,.003)
        for zz in [-.10,.11]:bolt('Captive armor screw',(s*.25,1.687,z+zz),deck,size=.028)
        block('Orange registration tab',(s*.61,1.688,z+.11),(.12,.012,.035),accent,deck,.005)
        for k in range(3):block('Etched warning stripe',(s*(.32+k*.037),1.689,z+.025),(.017,.009,.075),carbon,deck,.002)
    cyl('Exposed vertebral bridge',(-.12,1.54,z),(.12,1.54,z),.065,metal,body)
    ring('Vertebral orange coupler',(0,1.55,z),(0,0,1),.08,.055,accent,body)
for s in [-1,1]:
    for k in range(3):
        cable('Braided spine harness',[(s*(.10+k*.032),1.64,1.18),(s*(.13+k*.032),1.70,.25),(s*(.10+k*.032),1.68,-1.21)],.012,accent if k==0 else black,body)
for s in [-1,1]:
    control=group('SC_service_'+str(s),(s*.70,1.1,.1),body,explode=(s*.35,.15,0))
    block('Side controller bay',(s*.73,1.13,0),(.13,.29,.85),carbon,control,.025)
    for i in range(4):
        z=-.30+i*.20
        cyl('Data connector',(s*.77,1.13,z),(s*.84,1.13,z),.052,metal,control,n=12)
        cyl('Connector socket',(s*.84,1.13,z),(s*.845,1.13,z),.035,black,control,n=12)
        bolt('Controller screw',(s*.81,1.24,z),control,(s,0,0),.018)

head=group('SC_head',(0,1.34,1.32),chassis,'head')
block('Sensor suspension cradle',(0,1.33,1.29),(1.05,.35,.40),carbon,head,.075)
panel('Faceted sensor brow',[(-.59,1.20),(-.40,1.72),(-.20,1.81),(.20,1.81),(.40,1.72),(.59,1.20)],1.61,.13,white,head,.035)
block('Stereo sensor rail',(0,1.39,1.64),(.94,.22,.22),metal,head,.045)
for x,r in [(-.34,.12),(-.12,.08),(.12,.08),(.34,.12)]:
    optic=group('SC_optic_'+str(x),(x,1.40,1.75),head,explode=(x*.4,.12,.30))
    cyl('Optic barrel',(x,1.40,1.61),(x,1.40,1.80),r,carbon,optic,n=32)
    ring('Lens retainer',(x,1.4,1.81),(0,0,1),r*.91,.018,accent,optic)
    sphere('Sapphire aspheric lens',(x,1.4,1.823),(r*.76,r*.76,.038),glass,optic)
    ring('Optical inner concentric',(x,1.4,1.85),(0,0,1),r*.50,.007,metal,optic,n=24)
for s in [-1,1]:
    cable('Tactile antenna',[(s*.45,1.42,1.48),(s*.68,1.38,1.72),(s*.72,1.32,2.01)],.017,metal,head)
    sphere('Antenna insulated tip',(s*.72,1.32,2.01),(.025,.025,.065),black,head)
    bolt('Brow mounting',(s*.40,1.695,1.37),head,size=.034)

print('Building eight independent IK limbs',flush=True)
for leg in CFG['legs']:
    ident=leg['id'];s=leg['side'];hip,coxa,knee,foot=leg_rest(leg)
    assembly=group('SC_leg_'+ident,hip,chassis,'legs')
    rootjoint=group('SC_leg_'+ident+'_coxa',hip,assembly)
    hub('Coxa azimuth / '+ident,hip,(0,1,0),.20,rootjoint,False)
    beam('Coxa truss / '+ident,hip,coxa,.17,rootjoint)
    upper=group('SC_leg_'+ident+'_femur',coxa,assembly,explode=(s*.14,.15,0))
    hinge=V((0,1,0)).cross(foot-hip).normalized()
    hub('Femoral planetary drive / '+ident,coxa,hinge,.235,upper)
    beam('Femur / '+ident,coxa,knee,.225,upper)
    lower=group('SC_leg_'+ident+'_tibia',knee,assembly,explode=(s*.22,.10,0))
    hub('Knee harmonic drive / '+ident,knee,hinge,.20,lower)
    beam('Tibia / '+ident,knee,foot,.155,lower)
    ankle=group('SC_leg_'+ident+'_foot',foot,assembly,explode=(s*.15,.08,0))
    sphere('Ankle ball / '+ident,foot,(.095,.085,.095),metal,ankle)
    block('Articulated traction pad / '+ident,foot+V((0,-.05,.025)),(.19,.10,.30),black,ankle,.045)
    for j in range(4):
        block('Traction tread',foot+V((0,-.085,-.075+j*.06)),(.20,.022,.026),carbon,ankle,.004)
    for s2 in [-1,1]:
        cyl('Split terrain claw',foot+V((s2*.055,-.035,.14)),foot+V((s2*.07,-.085,.23)),.025,metal,ankle,r2=.008,n=12)
    # Knee-bridging hydraulic actuator. Both endpoint anchors are attached to the
    # correct rigid links; the exported barrel and rod are articulated on the web.
    ram_a=coxa.lerp(knee,.35)+hinge*.22
    ram_b=knee.lerp(foot,.29)+hinge*.22
    delta=ram_b-ram_a;axis=delta.normalized();length=delta.length
    ram=group('SC_leg_'+ident+'_ram',ram_a,assembly)
    ram['ramA']=list(ram_a);ram['ramB']=list(ram_b);ram['restLength']=length
    cyl('Hydraulic ram barrel',ram_a,ram_a+axis*length*.57,.061,carbon,ram,n=20)
    for t in [.10,.48,.56]:ring('Hydraulic barrel clamp',ram_a+axis*length*t,axis,.073,.038,metal if t<.5 else accent,ram,n=24)
    rod=group('SC_leg_'+ident+'_rod',ram_a,ram)
    cyl('Polished telescopic shaft',ram_a+axis*length*.54,ram_b,.026,metal,rod,n=20)
    for label,p in [('A',ram_a),('B',ram_b)]:
        clevis=group('SC_leg_'+ident+'_clevis'+label,p,assembly)
        ring('Spherical hydraulic clevis',p,hinge,.087,.065,metal,clevis,n=24)

print('Building articulated pincers and geared tail',flush=True)
for s,ident in [(-1,'L'),(1,'R')]:
    shoulder=V((s*.60,1.26,1.18));elbow=V((s*1.17,1.09,1.94));wrist=V((s*1.39,.97,2.62));palm=V((s*1.40,.95,2.98))
    arm=group('SC_claw_'+ident,shoulder,chassis,'claws')
    upper=group('SC_arm_'+ident+'_upper',shoulder,arm)
    hub('Pedipalp base drive',shoulder,(0,1,0),.28,upper)
    beam('Upper pedipalp',shoulder,elbow,.27,upper)
    lower=group('SC_arm_'+ident+'_lower',elbow,arm)
    hub('Pedipalp elbow reducer',elbow,(s,0,0),.245,lower)
    beam('Forearm pedipalp',elbow,wrist,.24,lower)
    hand=group('SC_hand_'+ident,wrist,arm)
    hub('Wrist rotary coupling',wrist,(0,0,1),.29,hand)
    block('Chela internal gear case',palm,(.52,.25,.59),carbon,hand,.075)
    for y in [.78,1.12]:
        p=group('SC_chela_'+ident+'_'+str(y),palm,hand,assembly='armor',explode=(0,.35 if y>1 else -.1,0))
        panel('Chela faceted shield',[(palm.x-.27,2.69),(palm.x+.27,2.69),(palm.x+.34,3.08),(palm.x+.20,3.26),(palm.x-.20,3.26),(palm.x-.34,3.08)],y,.075,white,p,.025)
        for x in [-.19,.19]:
            for z in [2.80,3.12]:bolt('Chela shield fixing',(palm.x+x,y+.045,z),p,size=.026)
        block('Chela ID marking',(palm.x,y+.041,2.92),(.20,.012,.055),accent,p,.008)
    for js,tag in [(-1,'a'),(1,'b')]:
        pivot=V((palm.x+js*.225,.96,3.16))
        jaw=group('SC_jaw_'+ident+'_'+tag,pivot,hand,explode=(js*.10,.06,.07))
        hub('Chela finger pivot',pivot,(0,1,0),.138,jaw,False)
        outline=[(pivot.x-js*.12,3.14),(pivot.x+js*.13,3.15),(pivot.x+js*.32,3.45),(pivot.x+js*.30,3.78),(palm.x+js*.06,4.12),(palm.x+js*.015,4.10),(pivot.x+js*.10,3.70),(pivot.x+js*.10,3.43)]
        panel('CNC chela structural finger',outline,.96,.16,carbon,jaw,.018)
        for yy in [.85,1.07]:
            outline2=[(pivot.x-js*.08,3.17),(pivot.x+js*.10,3.19),(pivot.x+js*.26,3.48),(pivot.x+js*.24,3.71),(pivot.x+js*.11,3.76),(pivot.x+js*.04,3.44)]
            panel('Ceramic chela cheek plate',outline2,yy,.045,white,jaw,.015)
            for z in [3.28,3.51,3.69]:bolt('Finger plate socket screw',(pivot.x+js*.16,yy+.028,z),jaw,size=.022)
        for j in range(6):
            z=3.39+j*.075
            x=pivot.x+js*(.10+.025*j)
            panel('Carbide gripping tooth',[(x,z),(x-js*.10,z+.05),(x,z+.062)],.96,.115,metal,jaw,.007)
        panel('Tungsten hook tip',[(pivot.x+js*.26,3.77),(palm.x+js*.06,4.12),(palm.x-js*.015,4.13),(pivot.x+js*.12,3.84)],.96,.10,metal,jaw,.007)
        gear('Finger sector gear',pivot,(0,1,0),.165,.055,20,brass,jaw)

points=[V(p) for p in CFG['tailPoints']]
tail=group('SC_tail',points[0],chassis,'tail');previous=tail
for i,(a,z) in enumerate(zip(points,points[1:])):
    seg=group('SC_tail_joint_%d'%i,a,previous)
    radius=.285 if i<4 else .24
    hub('Caudal planetary actuator %d'%i,a,(1,0,0),radius,seg)
    beam('Tail vertebral module %d'%i,a,z,.30 if i<4 else .24,seg)
    d=(z-a).normalized();_,u,v=basis(d)
    for s in [-1,1]:
        shell=group('SC_tail_shield_%d_%s'%(i,s),a,seg,assembly='armor',explode=(s*.27,.16,0))
        # Compact external cheek panel, leaving all drive drums exposed.
        c=a.lerp(z,.50)+V((s*.25,0,0))
        p1=a.lerp(z,.21)+V((s*.22,0,0));p2=a.lerp(z,.79)+V((s*.20,0,0))
        beam('Tail cheek link',p1,p2,.11,shell,True)
        cable('Flexible caudal hydraulic loom',[a+V((s*.31,0,0)),a.lerp(z,.5)+V((s*.35,.04,0)),z+V((s*.27,0,0))],.022,black,seg)
    for j in range(4):
        p=a.lerp(z,.3+j*.11)
        ring('Vertebral bellows rib',p,d,.14,.024,black,seg,n=20)
    previous=seg
tip=points[-1]
telson=group('SC_telson',tip,previous,explode=(0,.20,.18))
sphere('Telson pressure vessel',tip,(.25,.29,.32),carbon,telson)
for s in [-1,1]:
    shell=group('SC_telson_shield_'+str(s),tip,telson,explode=(s*.25,.18,0))
    sphere('Telson ceramic side shield',tip+V((s*.18,0,0)),(.10,.26,.28),white,shell)
    ring('Telson side inspection ring',tip+V((s*.27,0,0)),(1,0,0),.13,.025,accent,shell)
    bolt('Telson cap fastener',tip+V((s*.29,0,0)),shell,(s,0,0),.045)
stinger=[tip+V((0,-.10,.13)),tip+V((0,-.40,.35)),tip+V((0,-.74,.43))]
for i in range(2):cyl('Tungsten stinger',stinger[i],stinger[i+1],.13-i*.06,metal,telson,r2=.07-i*.06,n=24)

root['editable_meshes']=sum(COUNTS.values())
root['rigDescription']='8 legs with coxa/femur/tibia/foot pivots, linked hydraulic pistons, two articulated pedipalps, six serial tail actuators.'
root['units']='Concept model / decimeter design units'
for o in collection.objects:o.hide_set(False)
bee=scene.objects.get('Mellis_HB7')
if bee:
    for o in [bee]+list(bee.children_recursive):o.hide_set(True)
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT');root.select_set(True);bpy.context.view_layer.objects.active=root
scene['revision']='SC-8 precision revision 02'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'blender','biomech-specimens.blend'))
print('REVISION_02_OBJECTS',len(root.children_recursive)+1,'MESHES',sum(COUNTS.values()),flush=True)
# Export from the saved editable source. Batching changes memory only.
exec(compile(open(os.path.join(ROOT,'blender','export_models.py'),encoding='utf-8').read(),os.path.join(ROOT,'blender','export_models.py'),'exec'))
