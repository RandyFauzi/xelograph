import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Mesh, MeshStandardMaterial, Vector3, Texture } from 'three';
import { createOcclusionController, collectOccluderMeshes } from '../src/game/occlusion.mjs';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
function obstacle(x, z, material = new MeshStandardMaterial()) {
  const mesh = new Mesh(new BoxGeometry(2, 4, 1), material);
  mesh.position.set(x, 1.5, z);
  mesh.updateMatrixWorld(true);
  return mesh;
}
function settle(controller) {
  for (let i = 0; i < 90; i++) controller.update(1 / 60);
}
test('Actual exported trees and buildings retain grouped occlusion meshes after GLTF loading', async () => {
  const bytes = readFileSync(new URL('../public/models/world.glb', import.meta.url));
  const { scene } = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .register(() => ({
      name: 'geometry-test-textures',
      loadTexture: () => Promise.resolve(new Texture()),
    }))
    .parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const meshes = collectOccluderMeshes(scene),
    groups = new Map();
  for (const mesh of meshes) {
    const key = mesh.userData.cameraOcclusionGroup;
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  assert.ok(groups.size >= 43);
  assert.ok(
    [...groups.values()].some((n) => n > 1),
    'Multi-material nodes yield all child meshes',
  );
  assert.ok(meshes.every((m) => !m.name.includes('Meadow') && !m.name.includes('Court')));
});
test('Only scenery between camera and character fades, then restores completely', () => {
  const blocking = obstacle(0, 4),
    neighbour = obstacle(5, 4),
    behind = obstacle(0, -3);
  const c = createOcclusionController([blocking, neighbour, behind]);
  c.detect(new Vector3(0, 2, 10), new Vector3(0, 0.28, 0));
  c.update(1 / 60);
  assert.ok(
    blocking.material.opacity < 1 && blocking.material.opacity > 0.16,
    'Transition is gradual',
  );
  settle(c);
  assert.equal(blocking.material.opacity, 0.16);
  assert.equal(blocking.material.transparent, true);
  assert.equal(blocking.material.depthWrite, false);
  assert.equal(neighbour.material.opacity, 1);
  assert.equal(behind.material.opacity, 1);
  c.detect(new Vector3(8, 2, 10), new Vector3(8, 0.28, 0));
  settle(c);
  assert.equal(blocking.material.opacity, 1);
  assert.equal(blocking.material.transparent, false);
  assert.equal(blocking.material.depthWrite, true);
  assert.equal(blocking.renderOrder, 0);
});
test('All materials of a building fade and retain original settings on cleanup', () => {
  const a = new MeshStandardMaterial(),
    b = new MeshStandardMaterial({ opacity: 0.7, transparent: true, depthWrite: false });
  const mesh = obstacle(0, 4, [a, b, a, b, a, b]),
    c = createOcclusionController([mesh]);
  c.detect(new Vector3(0, 2, 10), new Vector3(0, 0.28, 0));
  settle(c);
  assert.ok(Math.abs(b.opacity - 0.7 * 0.16) < 0.000001);
  assert.equal(a.opacity, 0.16);
  c.restore();
  assert.equal(a.opacity, 1);
  assert.equal(a.transparent, false);
  assert.equal(a.depthWrite, true);
  assert.equal(b.opacity, 0.7);
  assert.equal(b.transparent, true);
  assert.equal(b.depthWrite, false);
});
test('Title screen disables fading and objects behind the player remain opaque', () => {
  const mesh = obstacle(0, 4),
    c = createOcclusionController([mesh]);
  c.detect(new Vector3(0, 2, 10), new Vector3(0, 0.28, 0), false);
  settle(c);
  assert.equal(mesh.material.opacity, 1);
  c.detect(new Vector3(0, 2, 10), new Vector3(0, 0.28, 0), true);
  settle(c);
  assert.equal(mesh.material.opacity, 0.16);
  c.detect(new Vector3(0, 2, 10), new Vector3(0, 0.28, 0), false);
  settle(c);
  assert.equal(mesh.material.opacity, 1);
});
