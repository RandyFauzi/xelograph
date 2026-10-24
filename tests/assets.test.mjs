import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
function glb(name) {
  const b = readFileSync(new URL('../public/models/' + name, import.meta.url));
  assert.equal(b.toString('ascii', 0, 4), 'glTF');
  assert.equal(b.readUInt32LE(4), 2);
  assert.equal(b.readUInt32LE(8), b.length);
  const len = b.readUInt32LE(12);
  const json = JSON.parse(b.toString('utf8', 20, 20 + len));
  assert.ok(
    json.buffers.every((b) => !b.uri),
    'Assets must be self-contained',
  );
  return { json, size: b.length };
}
test('World GLB contains seven checkpoints and an original complete environment', () => {
  const { json, size } = glb('world.glb');
  assert.ok(size < 2500000, 'Expanded campus stays within a 2.5 MB runtime asset budget');
  const names = json.nodes.map((n) => n.name);
  const occluders = json.nodes.filter((n) => n.extras?.camera_occluder === true);
  assert.ok(
    occluders.filter((n) => n.name.startsWith('Tree_occluder')).length >= 40,
    'Trees stay separate for selective fading',
  );
  assert.equal(occluders.filter((n) => n.name.startsWith('Building_occluder')).length, 3);
  for (let i = 1; i <= 7; i++) assert.ok(names.includes('Checkpoint_' + i + '_pad'));
  assert.ok(names.includes('Central_plaza') || names.includes('Central plaza'));
  assert.ok(json.meshes.length > 30);
  for (const name of ['Basketball_court', 'Picnic_pavilion', 'Outer_lake'])
    assert.ok(names.includes(name) || names.includes(name.replaceAll('_', ' ')), name);
});
test('Modular avatar GLB contains all required parts and tintable materials', () => {
  const { json, size } = glb('avatar.glb');
  assert.ok(size < 250000);
  const names = json.nodes.map((n) => n.name);
  for (const name of [
    'Torso',
    'Head',
    'Hair_short',
    'Hair_bob',
    'Hair_cap',
    'Cap_brim',
    'Arm_L',
    'Arm_R',
    'Leg_L',
    'Leg_R',
  ])
    assert.ok(names.includes(name), name);
  for (const name of ['AvatarShirt', 'AvatarSkin'])
    assert.ok(json.materials.some((m) => m.name === name));
});
