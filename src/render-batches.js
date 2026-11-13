import { BatchedMesh, Matrix4 } from 'three';

// Render copies share a submission, while the original scene graph remains
// authoritative for articulation, teardown, ray picking and transparent sorting.
export class RenderBatches {
  constructor(root, meshes, supported = true) {
    this.root = root;
    this.groups = [];
    this.enabled = false;
    this.inverseRoot = new Matrix4();
    this.matrix = new Matrix4();
    if (!supported) return;
    const groups = new Map();
    for (const mesh of meshes) {
      // Preserve the original transparent-object ordering and custom geometry.
      if (mesh.material.transparent || mesh.isSkinnedMesh || mesh.morphTargetInfluences || Array.isArray(mesh.material) || mesh.children.length) continue;
      const geometry = mesh.geometry;
      const layout = Object.entries(geometry.attributes).map(([name, attr]) => `${name}:${attr.itemSize}:${attr.normalized}:${attr.array.constructor.name}`).sort().join('|');
      const materialId = mesh.userData.renderMaterialId ?? mesh.material.uuid;
      const key = `${materialId}:${mesh.castShadow}:${mesh.receiveShadow}:${mesh.renderOrder}:${!!geometry.index}:${layout}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(mesh);
    }
    root.updateWorldMatrix(true, true);
    for (const members of groups.values()) {
      if (members.length < 2 || members.some(mesh => mesh.matrixWorld.determinant() <= 0)) continue;
      const vertices = members.reduce((n, mesh) => n + mesh.geometry.attributes.position.count, 0);
      const indices = members.reduce((n, mesh) => n + (mesh.geometry.index?.count || 0), 0);
      const batch = new BatchedMesh(members.length, vertices, indices, members[0].material.clone());
      batch.name = `render-batch / ${batch.material.name}`;
      batch.castShadow = members[0].castShadow;
      batch.receiveShadow = members[0].receiveShadow;
      batch.renderOrder = members[0].renderOrder;
      // The overall bounds move with the rig. Cull each original geometry
      // against its current matrix rather than using a stale aggregate sphere.
      batch.frustumCulled = false;
      batch.visible = false;
      batch.raycast = () => {};
      const entries = members.map(mesh => ({
        mesh,
        visible: mesh.visible,
        id: batch.addInstance(batch.addGeometry(mesh.geometry)),
        previous: new Matrix4().set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      }));
      for (const entry of entries) batch.setVisibleAt(entry.id, entry.visible);
      root.add(batch);
      this.groups.push({ batch, entries });
    }
  }

  setEnabled(enabled) {
    enabled = enabled && this.groups.length > 0;
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    for (const { batch, entries } of this.groups) {
      batch.visible = enabled;
      for (const { mesh, visible } of entries) mesh.visible = enabled ? false : visible;
    }
  }

  update() {
    if (!this.enabled) return;
    this.root.updateWorldMatrix(true, true);
    this.inverseRoot.copy(this.root.matrixWorld).invert();
    for (const { batch, entries } of this.groups) {
      for (const entry of entries) {
        this.matrix.multiplyMatrices(this.inverseRoot, entry.mesh.matrixWorld);
        if (!this.matrix.equals(entry.previous)) {
          batch.setMatrixAt(entry.id, this.matrix);
          entry.previous.copy(this.matrix);
        }
      }
    }
  }
}
