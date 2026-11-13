"""Export a refined .blend to the site's two articulated GLBs.

Use in a BACKGROUND Blender process. This script batches meshes in memory but
never saves the .blend, preserving all individually editable source objects.
Example:
  blender --background blender/biomech-specimens.blend --python blender/export_models.py
"""
import bpy
import os
import json
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'models')
os.makedirs(OUT, exist_ok=True)
scene = next(s for s in bpy.data.scenes if s.name.startswith('BIOMECH'))
bpy.context.window.scene = scene

if not bpy.app.background:
    raise RuntimeError('Run this export in a background Blender process to preserve the editable scene.')

manifest = []
for root_name, filename in [('Telson_SC8', 'telson-sc8.glb'), ('Mellis_HB7', 'mellis-hb7.glb')]:
    root = scene.objects.get(root_name)
    if root is None:
        raise ValueError('Missing required root: ' + root_name)
    original = list(root.children_recursive)
    buckets = defaultdict(list)
    for obj in [root] + original:
        obj.hide_set(False)
        obj.hide_viewport = False
        if obj.type in {'MESH', 'CURVE'}:
            if not obj.data.materials or obj.parent is None:
                raise ValueError('Every part needs a material and rigid pivot parent: ' + obj.name)
            if len(obj.data.materials) != 1:
                raise ValueError('Split multi-material meshes before exporting: ' + obj.name)
            buckets[(obj.parent.name, obj.data.materials[0].name)].append(obj)
    for (parent_name, mat_name), objects in buckets.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.convert(target='MESH')
        if len(objects) > 1:
            bpy.ops.object.join()
        bpy.context.object.name = parent_name + '__' + mat_name.split(' · ')[0]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [root] + list(root.children_recursive):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    output = os.path.join(OUT, filename)
    bpy.ops.export_scene.gltf(
        filepath=output, export_format='GLB', use_selection=True,
        use_active_scene=True, export_extras=True, export_animations=False,
        export_yup=True, export_apply=True,
    )
    meshes = [o for o in root.children_recursive if o.type == 'MESH']
    manifest.append({
        'file': filename, 'specimen': root.get('specimen', root_name),
        'editable_objects': len(original) + 1, 'draw_batches': len(meshes),
        'vertices': sum(len(o.data.vertices) for o in meshes),
        'bytes': os.path.getsize(output),
    })
with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=2)
print('BIOMECH_EXPORT=' + json.dumps(manifest))
