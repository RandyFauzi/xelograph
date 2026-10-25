import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createStaticAvatar } from '../src/game/staticAvatar.mjs';
import { avatarPartVisible } from '../src/game/avatarParts.mjs';
import { validateAvatar } from '../server/domain.mjs';
import { createApiHandler } from '../server/api-handler.mjs';
import { openDb } from '../server/db.mjs';

test('Female choice validates, rejects unknown characters, and keeps legacy avatars compatible', () => {
  const legacy = { outfit: 'sage', hair: 'bob', skin: 'warm' };
  assert.equal(validateAvatar(legacy).character, 'male');
  assert.equal(
    validateAvatar({ ...legacy, character: 'female', hair: 'long' }).character,
    'female',
  );
  assert.throws(() => validateAvatar({ ...legacy, character: 'unknown' }));
});

test('Female avatar is saved in SQLite and returned with the resumed session', async () => {
  const db = openDb(':memory:');
  try {
    const handle = createApiHandler({ db, demo: true });
    const avatar = { character: 'female', hair: 'long', outfit: 'clay', skin: 'warm' };
    const response = await handle(
      new Request('https://reunion.example/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Penguji Karakter',
          nickname: 'Penguji',
          whatsapp: '081234567890',
          avatar,
          invitation: 'XEL-DEMO',
          consentData: true,
          consentPublic: false,
        }),
      }),
    );
    assert.equal(response.status, 201);
    assert.deepEqual((await response.json()).avatar, avatar);
    const cookie = response.headers.get('set-cookie').split(';')[0];
    const resumed = await handle(
      new Request('https://reunion.example/api/me', { headers: { cookie } }),
    );
    assert.deepEqual((await resumed.json()).avatar, avatar);
    assert.deepEqual(
      JSON.parse(db.prepare('SELECT avatar_json FROM alumni').get().avatar_json),
      avatar,
    );
  } finally {
    db.close();
  }
});

test('Actual female mesh and long hair are selected consistently without mixing male geometry or cached templates', async () => {
  const bytes = readFileSync(new URL('../public/models/avatar.glb', import.meta.url));
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const female = { character: 'female', hair: 'long' };
  assert.ok(scene.getObjectByName('Body_female_Skirt'));
  assert.ok(scene.getObjectByName('Hair_long_back'));
  assert.equal(avatarPartVisible('Torso', female), false);
  assert.equal(avatarPartVisible('Body_female_Skirt', female), true);
  assert.equal(avatarPartVisible('Hair_short', female), false);
  assert.equal(avatarPartVisible('Hair_long_back', female), true);
  assert.equal(avatarPartVisible('Body_female_Skirt', { hair: 'short' }), false);
  const colors = { outfitColor: '#367fcb', skinColor: '#c78e65' };
  for (const hair of ['short', 'bob', 'cap', 'long']) {
    const male = createStaticAvatar(scene, { ...colors, hair, character: 'male' });
    const woman = createStaticAvatar(scene, { ...colors, hair, character: 'female' });
    assert.ok(male.children.length < 10 && woman.children.length < 10);
    assert.notEqual(
      male.getObjectByName('AvatarShirt').geometry,
      woman.getObjectByName('AvatarShirt').geometry,
    );
    assert.equal(
      woman.getObjectByName('AvatarShirt').geometry,
      createStaticAvatar(scene, { ...colors, hair, character: 'female' }).getObjectByName(
        'AvatarShirt',
      ).geometry,
    );
  }
});
