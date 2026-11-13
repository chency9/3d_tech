"""Export full evaluated geometry by rigid parent/material without changing the saved source."""
import bpy, os, json, sys
import numpy as np
from collections import defaultdict
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'public','models');os.makedirs(OUT,exist_ok=True)
scene=next(s for s in bpy.data.scenes if s.name.startswith('BIOMECH'))
bpy.context.window.scene=scene
if not bpy.app.background:raise RuntimeError('Export in background mode to preserve editable source.')
only=globals().get('EXPORT_ONLY')
if '--' in sys.argv:
    args=sys.argv[sys.argv.index('--')+1:]
    if '--only' in args:only=set(args[args.index('--only')+1].split(','))
manifest_path=os.path.join(OUT,'manifest.json');manifest={}
if os.path.exists(manifest_path):
    with open(manifest_path,encoding='utf-8') as f:manifest={item['file']:item for item in json.load(f)}
models=[('Telson_SC8','telson-sc8.glb'),('Mellis_HB7','mellis-hb7.glb'),('Pelagos_OC8','pelagos-oc8.glb')]
for root_name,filename in models:
    if only and root_name not in only:continue
    root=scene.objects.get(root_name)
    if root is None:raise ValueError('Missing required root: '+root_name)
    original=list(root.children_recursive);buckets=defaultdict(list)
    for obj in [root]+original:
        obj.hide_set(False);obj.hide_viewport=False
        if obj.type in {'MESH','CURVE'}:
            if len(obj.data.materials)!=1 or obj.parent is None:raise ValueError('Every part needs one material and a rigid parent: '+obj.name)
            buckets[(obj.parent.name,obj.data.materials[0].name)].append(obj)
    depsgraph=bpy.context.evaluated_depsgraph_get();depsgraph.update();prepared=[]
    print('Evaluating',root_name,len(original),'objects',len(buckets),'batches',flush=True)
    for number,((parent_name,material_name),objects) in enumerate(buckets.items()):
        parent=scene.objects[parent_name];parent_inverse=parent.matrix_world.inverted()
        vertices=[];faces=[];normals=[];smooth=[];offset=0
        for obj in objects:
            evaluated=obj.evaluated_get(depsgraph)
            source=evaluated.to_mesh(preserve_all_data_layers=True,depsgraph=depsgraph)
            transform=parent_inverse@obj.matrix_world
            coords=np.empty(len(source.vertices)*3,dtype=np.float32);source.vertices.foreach_get('co',coords)
            coords=coords.reshape(-1,3);matrix=np.array(transform,dtype=np.float64)
            coords=coords@matrix[:3,:3].T+matrix[:3,3];vertices.extend(coords.tolist())
            indices=np.empty(len(source.loops),dtype=np.int32);source.loops.foreach_get('vertex_index',indices)
            for polygon in source.polygons:
                faces.append((indices[polygon.loop_start:polygon.loop_start+polygon.loop_total]+offset).tolist())
                smooth.append(polygon.use_smooth)
            normal=np.empty(len(source.corner_normals)*3,dtype=np.float32);source.corner_normals.foreach_get('vector',normal)
            normal=normal.reshape(-1,3)@np.linalg.inv(matrix[:3,:3])
            normal/=np.maximum(np.linalg.norm(normal,axis=1,keepdims=True),1e-12)
            normals.extend(normal.tolist());offset+=len(source.vertices);evaluated.to_mesh_clear()
        data=bpy.data.meshes.new(parent_name+'__'+material_name.split(' · ')[0])
        data.from_pydata(vertices,[],faces);data.materials.append(bpy.data.materials[material_name])
        data.polygons.foreach_set('use_smooth',smooth);data.normals_split_custom_set(normals)
        prepared.append((parent,data,objects))
        if number%100==0:print('  evaluated',number+1,'/',len(buckets),flush=True)
    for parent,data,objects in prepared:
        obj=bpy.data.objects.new(data.name,data);scene.collection.objects.link(obj);obj.parent=parent
        for old in objects:bpy.data.objects.remove(old,do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT')
    descendants=[root]+list(root.children_recursive)
    for obj in descendants:obj.select_set(True)
    bpy.context.view_layer.objects.active=root;output=os.path.join(OUT,filename)
    bpy.ops.export_scene.gltf(filepath=output,export_format='GLB',use_selection=True,use_active_scene=True,export_extras=True,export_animations=False,export_yup=True,export_apply=True)
    meshes=[obj for obj in descendants if obj.type=='MESH']
    manifest[filename]={'file':filename,'specimen':root.get('specimen',root_name),'editable_objects':len(original)+1,'draw_batches':len(meshes),'vertices':sum(len(obj.data.vertices) for obj in meshes),'bytes':os.path.getsize(output)}
with open(manifest_path,'w',encoding='utf-8') as f:json.dump(list(manifest.values()),f,indent=2)
print('BIOMECH_EXPORT='+json.dumps(list(manifest.values())),flush=True)
