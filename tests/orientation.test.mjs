import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Vector3 } from 'three';
import { headingForMovement, inputDirection } from '../src/game/navigation.mjs';

test('Actual GLB face points along movement for all eight directions and camera-relative input', async () => {
  const bytes = readFileSync(new URL('../public/models/avatar.glb', import.meta.url));
  const { scene } = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  scene.updateMatrixWorld(true);
  const head = scene.getObjectByName('Head').getWorldPosition(new Vector3());
  const eyes = [];
  scene.traverse((o) => {
    if (o.name.startsWith('Eye')) eyes.push(o.getWorldPosition(new Vector3()));
  });
  assert.equal(eyes.length, 2);
  const face = eyes[0].clone().add(eyes[1]).multiplyScalar(0.5).sub(head);
  face.y = 0;
  face.normalize();
  assert.ok(face.z > 0.99, 'Exported avatar faces +Z');
  const directions = [
    { x: 0, z: 1 },
    { x: 1, z: 0 },
    { x: 0, z: -1 },
    { x: -1, z: 0 },
    { x: 1, z: 1 },
    { x: -1, z: 1 },
    { x: 1, z: -1 },
    { x: -1, z: -1 },
  ];
  for (const camera of [
    { x: 0, z: -1 },
    { x: -1, z: 0 },
    { x: -1, z: -1 },
  ])
    for (const [h, v] of [
      [0, -1],
      [0, 1],
      [1, 0],
      [-1, 0],
    ])
      directions.push(inputDirection(h, v, camera));
  for (const { x, z } of directions) {
    const actual = face.clone().applyAxisAngle(new Vector3(0, 1, 0), headingForMovement(x, z));
    const desired = new Vector3(x, 0, z).normalize();
    assert.ok(actual.dot(desired) > 0.99999, `Face follows movement (${x}, ${z})`);
  }
});
