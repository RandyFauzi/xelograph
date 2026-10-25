import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CREATOR_MONUMENT, creatorProximity } from '../src/game/creatorMonument.mjs';
import { findPath, isWalkable, MISSION_ZONES } from '../src/game/navigation.mjs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Box3 } from 'three';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

test('Creator popup opens on approach once, stays dismissed nearby, and rearms only after leaving', () => {
  const point = { x: CREATOR_MONUMENT.x, z: CREATOR_MONUMENT.z + 1.3 };
  assert.equal(
    creatorProximity(point, false, false).open,
    false,
    'Menus and other dialogs cannot open credits',
  );
  const entered = creatorProximity(point, false, true);
  assert.equal(entered.open, true);
  assert.equal(creatorProximity(point, entered.latched, false).open, false);
  assert.equal(
    creatorProximity(point, entered.latched, true).open,
    false,
    'Closing the dialog must not immediately reopen it',
  );
  const edge = creatorProximity({ x: point.x, z: CREATOR_MONUMENT.z + 2 }, true, true);
  assert.equal(
    edge.latched,
    true,
    'Small movements at the boundary cannot repeatedly trigger the popup',
  );
  const left = creatorProximity({ x: point.x, z: CREATOR_MONUMENT.z + 5 }, true, true);
  assert.equal(left.latched, false);
  assert.equal(creatorProximity(point, left.latched, true).open, true);
});

test('The single garden monument is reachable before any questionnaire and does not overlap mission triggers', () => {
  const target = { x: CREATOR_MONUMENT.x, z: CREATOR_MONUMENT.z + 1.3 };
  assert.equal(isWalkable(target.x, target.z, 0), true);
  assert.ok(findPath({ x: 0, z: 14 }, target, 0).length > 0);
  for (const [x, z] of MISSION_ZONES)
    assert.ok(
      Math.hypot(x - CREATOR_MONUMENT.x, z - CREATOR_MONUMENT.z) > CREATOR_MONUMENT.radius + 2.25,
    );
});

test('Credit preview is local and portfolio link uses the requested HTTPS address', () => {
  const bytes = readFileSync(new URL('../public' + CREATOR_MONUMENT.asset, import.meta.url));
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG');
  assert.equal(bytes[25], 6);
  assert.equal(CREATOR_MONUMENT.portfolio, 'https://randyfauzi.github.io/Randy-Fauzi-Portofolio/');
});

test('Easter egg uses genuine compact 3D geometry below player height, with no billboard images', async () => {
  const bytes = readFileSync(new URL('../public' + CREATOR_MONUMENT.model, import.meta.url));
  assert.ok(bytes.length < 250000, 'Small optional landmark must remain lightweight');
  const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  assert.equal(
    json.images?.length || 0,
    0,
    'Artwork must be modeled geometry rather than an image plane',
  );
  const { scene } = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const box = new Box3().setFromObject(scene);
  assert.ok(box.max.y - box.min.y < 1.3, 'Relic is clearly smaller than the roughly 1.7 m avatar');
  assert.ok(box.max.z - box.min.z > 0.5, 'Model has actual depth visible from the sides');
  assert.ok(scene.getObjectByName('CreatorCrystal'));
  assert.ok(
    scene.getObjectByName('CreatorCrystal').isMesh,
    'Floating crystal remains independently animatable',
  );
  let draws = 0;
  scene.traverse((o) => {
    if (o.isMesh) draws++;
  });
  assert.ok(draws <= 10, 'Static materials are batched for mobile rendering');
});
