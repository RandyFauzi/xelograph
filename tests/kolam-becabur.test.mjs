import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { KOLAM_BECABUR, kolamProximity } from '../src/game/kolamBecabur.mjs';
import { findPath, isWalkable, MISSION_ZONES } from '../src/game/navigation.mjs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createApiHandler } from '../server/api-handler.mjs';
import { openDb } from '../server/db.mjs';

test('Kolam Becabur popup opens on approach once, stays dismissed nearby, and rearms after leaving', () => {
  const point = KOLAM_BECABUR.walkTarget;
  assert.equal(
    kolamProximity(point, false, false).open,
    false,
    'Inactive game state cannot auto-open pond modal',
  );
  const entered = kolamProximity(point, false, true);
  assert.equal(entered.near, true);
  assert.equal(entered.open, true);
  assert.equal(
    kolamProximity(point, entered.latched, true).open,
    false,
    'Closing the modal must not immediately reopen it while standing by the pond',
  );
  const edge = kolamProximity({ x: KOLAM_BECABUR.x - 4.4, z: KOLAM_BECABUR.z }, true, true);
  assert.equal(edge.latched, true, 'Small movement inside exitRadius keeps latch active');
  const left = kolamProximity({ x: KOLAM_BECABUR.x - 6.0, z: KOLAM_BECABUR.z }, true, true);
  assert.equal(left.latched, false, 'Walking past exitRadius rearms the pond trigger');
  assert.equal(kolamProximity(point, left.latched, true).open, true);
});

test('Kolam Becabur dock is walkable from spawn and separated from all mission triggers', () => {
  const target = KOLAM_BECABUR.walkTarget;
  assert.equal(isWalkable(target.x, target.z, 0), true);
  assert.ok(findPath({ x: 0, z: 14 }, target, 0).length > 0);
  for (const [x, z] of MISSION_ZONES) {
    assert.ok(
      Math.hypot(x - KOLAM_BECABUR.x, z - KOLAM_BECABUR.z) > KOLAM_BECABUR.radius + 2.5,
    );
  }
});

test('Kolam Becabur 3D model, preview image, and MP4 video are bundled locally and optimized', async () => {
  const previewBytes = readFileSync(new URL('../public' + KOLAM_BECABUR.preview, import.meta.url));
  assert.equal(previewBytes.toString('ascii', 1, 4), 'PNG');

  const videoStat = statSync(new URL('../public' + KOLAM_BECABUR.video, import.meta.url));
  assert.ok(videoStat.size > 100000, 'Video file is present and non-empty');

  const glbBytes = readFileSync(new URL('../public' + KOLAM_BECABUR.model, import.meta.url));
  assert.ok(glbBytes.length < 500000, 'Meshopt-compressed Kolam Becabur GLB stays lightweight');
  const gltf = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(
      glbBytes.buffer.slice(glbBytes.byteOffset, glbBytes.byteOffset + glbBytes.byteLength),
      '',
    );
  for (const name of ['Pond_Water', 'Sailboat', 'Sign_KolamBecabur', 'Wooden_Dock']) {
    assert.ok(gltf.scene.getObjectByName(name), `Missing expected node: ${name}`);
  }
  assert.ok(gltf.animations.length >= 4, 'Water and floating prop animations are preserved');
});

test('Online presence endpoint tracks active visitors and handles leave notifications', async () => {
  const db = openDb(':memory:');
  try {
    const handle = createApiHandler({ db });
    const r1 = await handle(
      new Request('https://reunion.example/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId: 'visitor-a' }),
      }),
    );
    assert.equal(r1.status, 200);
    assert.equal((await r1.json()).online, 1);

    const r2 = await handle(
      new Request('https://reunion.example/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId: 'visitor-b' }),
      }),
    );
    assert.equal((await r2.json()).online, 2);

    const r3 = await handle(
      new Request('https://reunion.example/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId: 'visitor-b', leave: true }),
      }),
    );
    assert.equal((await r3.json()).online, 1);

    for (let i = 1; i <= 7; i++) {
      await handle(
        new Request('https://reunion.example/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitorId: `peer-${i}`,
            nickname: `Alumni ${i}`,
            avatar: { character: 'female', hair: 'hijab', outfit: 'sage', skin: 'warm' },
            x: i * 2,
            z: 10 - i,
            playing: true,
          }),
        }),
      );
    }

    const rObserver = await handle(
      new Request('https://reunion.example/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId: 'visitor-a', x: 0, z: 14, playing: true }),
      }),
    );
    const data = await rObserver.json();
    assert.equal(data.online, 8);
    assert.equal(data.peers.length, 5, 'Live peer avatars are strictly capped at 5');
    assert.equal(data.peers[0].avatar.hair, 'hijab');
  } finally {
    db.close();
  }
});
