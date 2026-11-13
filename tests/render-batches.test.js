import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, BoxGeometry, MeshStandardMaterial, Matrix4, Vector3, Raycaster } from 'three';
import { RenderBatches } from '../src/render-batches.js';

function fixture(supported=true) {
  const root=new Group(), hinge=new Group(), material=new MeshStandardMaterial();
  root.add(hinge);
  const meshes=[0,1].map(i=>{
    const mesh=new Mesh(new BoxGeometry(1,1,1),material.clone());
    mesh.position.x=i*2;
    mesh.userData.renderMaterialId=material.uuid;
    hinge.add(mesh);
    return mesh;
  });
  const snapshots=meshes.map(mesh=>Array.from(mesh.geometry.attributes.position.array));
  const batches=new RenderBatches(root,meshes,supported);
  return {root,hinge,meshes,batches,snapshots};
}

test('batching preserves source geometry and follows independent hinges, root motion and teardown',()=>{
  const {root,hinge,meshes,batches,snapshots}=fixture();
  assert.equal(batches.groups.length,1);
  batches.setEnabled(true);
  for(let step=0;step<12;step++) {
    root.position.set(.2*step,1,-2);root.rotation.y=step*.13;
    hinge.rotation.z=step*.07;meshes[1].position.y=step*.3;
    batches.update();root.updateWorldMatrix(true,true);
    const {batch,entries}=batches.groups[0];
    for(const entry of entries) {
      const rendered=batch.getMatrixAt(entry.id,new Matrix4()).premultiply(batch.matrixWorld);
      rendered.elements.forEach((value,i)=>assert.ok(Math.abs(value-entry.mesh.matrixWorld.elements[i])<1e-6));
    }
    meshes.forEach((mesh,i)=>assert.deepEqual(Array.from(mesh.geometry.attributes.position.array),snapshots[i]));
  }
  batches.setEnabled(false);
  assert.ok(meshes.every(mesh=>mesh.visible));
  assert.equal(batches.groups[0].batch.visible,false);
});

test('original meshes remain ray-pickable while the render copies avoid duplicate hits',()=>{
  const {root,batches,meshes}=fixture();
  batches.setEnabled(true);batches.update();root.updateWorldMatrix(true,true);
  const ray=new Raycaster(new Vector3(0,0,5),new Vector3(0,0,-1));
  const hits=ray.intersectObject(root,true);
  assert.ok(hits.length>0);
  assert.ok(hits.every(hit=>hit.object===meshes[0]));
});

test('devices without multi-draw retain the original rendering path',()=>{
  const {meshes,batches}=fixture(false);
  batches.setEnabled(true);batches.update();
  assert.equal(batches.groups.length,0);
  assert.ok(meshes.every(mesh=>mesh.visible));
});
