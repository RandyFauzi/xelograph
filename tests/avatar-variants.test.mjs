import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createStaticAvatar } from '../src/game/staticAvatar.mjs';
import { avatarPartVisible } from '../src/game/avatarParts.mjs';
import { validateAvatar } from '../server/domain.mjs';
import { createApiHandler } from '../server/api-handler.mjs';
import { openDb } from '../server/db.mjs';
import { AVATAR_MODELS, selectAvatarCharacter } from '../src/game/avatarCatalog.mjs';
import { Box3 } from 'three';

test('Each gender exposes exactly three distinct models and switching resets incompatible choices', () => {
  assert.deepEqual(
    AVATAR_MODELS.female.map((m) => m.id),
    ['long', 'ponytail', 'hijab'],
  );
  assert.deepEqual(
    AVATAR_MODELS.male.map((m) => m.id),
    ['short', 'quiff', 'cap'],
  );
  const female = { character: 'female', hair: 'hijab', outfit: 'clay', skin: 'warm' };
  const male = selectAvatarCharacter(female, 'male');
  assert.equal(male.hair, 'short');
  assert.equal(male.outfit, 'clay');
  assert.equal(male.skin, 'warm');
  assert.equal(selectAvatarCharacter(male, 'female').hair, 'long');
  assert.equal(selectAvatarCharacter({ ...female, hair: 'ponytail' }, 'female').hair, 'ponytail');
  assert.throws(() => validateAvatar({ ...female, character: 'male' }));
  assert.throws(() => validateAvatar({ ...female, hair: 'quiff' }));
});

test('All six authored models have previews, different clothing meshes, and matching animated/static bounds after Meshopt', async () => {
  const bytes = readFileSync(new URL('../public/models/avatar.glb', import.meta.url));
  const { scene } = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const expected = {
    'female:long': 'Body_female_Skirt',
    'female:ponytail': 'Look_female_ponytail_Torso',
    'female:hijab': 'Look_female_hijab_Long_skirt',
    'male:short': 'Torso',
    'male:quiff': 'Look_male_quiff_Jacket',
    'male:cap': 'Look_male_cap_Hoodie',
  };
  for (const character of ['female', 'male'])
    for (const model of AVATAR_MODELS[character]) {
      const picture = readFileSync(new URL('../public' + model.preview, import.meta.url));
      assert.equal(picture.toString('ascii', 1, 4), 'PNG');
      assert.equal(picture[25], 6);
      const config = { character, hair: model.id };
      assert.ok(scene.getObjectByName(expected[character + ':' + model.id]));
      assert.equal(avatarPartVisible(expected[character + ':' + model.id], config), true);
      const copy = scene.clone(true);
      copy.traverse((o) => {
        if (o.isMesh) o.visible = avatarPartVisible(o.name, config);
      });
      copy.updateMatrixWorld(true);
      const reference = new Box3();
      copy.traverse((o) => {
        if (o.isMesh && o.visible) reference.union(new Box3().setFromObject(o, true));
      });
      const combined = createStaticAvatar(scene, {
        ...config,
        outfitColor: '#347cc5',
        skinColor: '#bc845c',
      });
      const actual = new Box3().setFromObject(combined, true);
      assert.ok(
        reference.min.distanceTo(actual.min) < 0.001,
        character + ':' + model.id + ' keeps its foot position',
      );
      assert.ok(
        reference.max.distanceTo(actual.max) < 0.001,
        character + ':' + model.id + ' keeps its shape and head height',
      );
      assert.ok(actual.max.y > 1.6 && actual.max.y < 2);
      assert.ok(combined.children.length < 10);
    }
});

test('Every female and male model persists through code-free registration and session resume', async () => {
  const db = openDb(':memory:');
  let index = 0;
  try {
    const handle = createApiHandler({ db });
    for (const character of ['female', 'male'])
      for (const model of AVATAR_MODELS[character]) {
        const avatar = { character, hair: model.id, outfit: 'navy', skin: 'warm' };
        const joined = await handle(
          new Request('https://reunion.example/api/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fullName: 'Penguji Model ' + index,
              nickname: 'Model ' + index,
              whatsapp: '0812345600' + String(index++).padStart(2, '0'),
              avatar,
              consentData: true,
              consentPublic: false,
            }),
          }),
        );
        assert.equal(joined.status, 201);
        assert.deepEqual((await joined.json()).avatar, avatar);
        const resumed = await handle(
          new Request('https://reunion.example/api/me', {
            headers: { cookie: joined.headers.get('set-cookie').split(';')[0] },
          }),
        );
        assert.deepEqual((await resumed.json()).avatar, avatar);
      }
  } finally {
    db.close();
  }
});

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
  const { scene } = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
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
