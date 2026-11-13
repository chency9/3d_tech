"""Editable hard-surface components in browser X/right, Y/up, Z/front coordinates."""
import bpy, bmesh, math
from mathutils import Vector
V=Vector
ORIGINS={}
COUNTS={}
collection=None

def use_collection(value):
    global collection
    collection=value

def register_tree(root):
    bpy.context.view_layer.update()
    for obj in [root]+list(root.children_recursive):
        p=obj.matrix_world.translation
        ORIGINS[obj.name]=V((p.x,p.z,-p.y))

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

white=mat('01','REV03 zirconia ceramic',(.62,.65,.63),.24,.43)
carbon=mat('02','REV03 graphite anodized chassis',(.025,.034,.037),.65,.42)
accent=mat('03','REV03 vermilion actuator markings',(.79,.055,.015),.35,.37)
metal=mat('04','REV03 brushed titanium',(.22,.28,.30),.83,.36)
black=mat('05','REV03 fluoropolymer seals',(.009,.013,.014),.10,.64)
glass=mat('06','REV03 smoked sapphire optic',(.009,.028,.033),.8,.16)
brass=mat('08','REV03 phosphor bronze bearings',(.36,.19,.07),.83,.38)

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

def cyl(name,a,z,r,material,parent,r2=None,n=40):
    a,z=V(a),V(z);_,u,v=basis(z-a)
    r2=r if r2 is None else r2
    verts=[p+(u*math.cos(i*math.tau/n)+v*math.sin(i*math.tau/n))*rad for p,rad in [(a,r),(z,r2)] for i in range(n)]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,verts,faces,material,parent,smooth=True)

def ring(name,p,axis,r,width,material,parent,inner=None,n=40):
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
    p=V(p);verts=[];n=48;rows=24
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

def sector_tube(name,a,z,r,material,parent,inner=None,start=0,end=math.tau,n=48):
    a,z=V(a),V(z);axis,u,v=basis(z-a);inner=r-.025 if inner is None else inner
    verts=[point+(u*math.cos(start+(end-start)*i/n)+v*math.sin(start+(end-start)*i/n))*radius for point,radius in [(a,r),(z,r),(a,inner),(z,inner)] for i in range(n+1)]
    m=n+1;faces=[]
    for i in range(n):faces.extend([(i,i+1,i+1+m,i+m),(i+2*m,i+3*m,i+3*m+1,i+2*m+1),(i,i+2*m,i+2*m+1,i+1),(i+m,i+1+m,i+1+3*m,i+3*m)])
    faces.extend([(0,m,3*m,2*m),(n,n+2*m,n+3*m,n+m)])
    return mesh(name,verts,faces,material,parent,smooth=True)

def helix(name,a,z,r,turns,wire,material,parent):
    a,z=V(a),V(z);axis,u,v=basis(z-a)
    count=int(turns*20)
    return cable(name,[a.lerp(z,i/count)+(u*math.cos(i/count*turns*math.tau)+v*math.sin(i/count*turns*math.tau))*r for i in range(count+1)],wire,material,parent)

