import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Box3, Vector3, Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createAvatarAppearance } from '../src/game/avatarAppearance.mjs';
import { STORE_OUTFITS, wearableAssetUrls } from '../src/game/wearableCatalog.mjs';
import { AVATAR_MODELS } from '../src/game/avatarCatalog.mjs';
import { createStaticAvatar } from '../src/game/staticAvatar.mjs';
import { avatarIdleJoint } from '../src/game/crowdMotion.mjs';
import { createApiHandler } from '../server/api-handler.mjs';
import { openDb } from '../server/db.mjs';

const load = async (url) => {
  const b = readFileSync(new URL('../public' + url, import.meta.url));
  return (
    await new GLTFLoader()
      .register(() => ({
        name: 'GeometryOnlyTestTextures',
        loadTexture: () => Promise.resolve(new Texture()),
      }))
      .setMeshoptDecoder(MeshoptDecoder)
      .parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')
  ).scene;
};
const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 0.0001, `${actual} != ${expected}`);
const disposeMaterials = (model) =>
  model.traverse((o) => {
    if (o.isMesh) o.material.dispose();
  });

test('Eight actual store garments fit all six avatars, replace stock tops, and follow authored arm pivots', async () => {
  const source = await load('/models/avatar.glb');
  const assets = new Map(
    await Promise.all(
      STORE_OUTFITS.map(async (id) => [
        '/models/' + id + '.glb',
        await load('/models/' + id + '.glb'),
      ]),
    ),
  );
  for (const [character, looks] of Object.entries(AVATAR_MODELS))
    for (const { id: hair } of looks)
      for (const outfit of STORE_OUTFITS) {
        const config = { character, hair, outfit };
        const model = createAvatarAppearance(source, config, assets);
        model.updateMatrixWorld(true);
        assert.equal(model.getObjectByName('Torso').visible, false);
        assert.equal(model.getObjectByName('Sleeve_L').visible, false);
        const torso = new Box3();
        model.traverse((o) => {
          if (o.isMesh && o.name.startsWith('Wearable_Torso_'))
            torso.union(new Box3().setFromObject(o));
        });
        near(torso.min.y, 0.615);
        near(torso.max.y, 1.125);
        near(torso.getSize(new Vector3()).x, 0.5);
        near(torso.getSize(new Vector3()).z, 0.31);
        for (const [side, x, mode] of [
          ['L', -0.34, 3],
          ['R', 0.34, 2],
        ]) {
          const sleeve = model.getObjectByName('WearableSleeve_' + side);
          assert.equal(sleeve.parent.name, 'Arm_' + side);
          const box = new Box3().setFromObject(sleeve);
          near(box.min.y, 0.64);
          near(box.max.y, 1.06);
          near(box.getCenter(new Vector3()).x, x);
          sleeve.traverse((o) => {
            if (o.isMesh) assert.equal(avatarIdleJoint(o)[3], mode);
          });
          const atRest = box.getCenter(new Vector3());
          sleeve.parent.rotation.x = 0.4;
          model.updateMatrixWorld(true);
          assert.ok(
            new Box3().setFromObject(sleeve).getCenter(new Vector3()).distanceTo(atRest) > 0.02,
          );
        }
        disposeMaterials(model);
      }
  assert.equal(source.getObjectByName('Torso').visible, true, 'GLTF cache is never altered');
});

test('Fitted garments and accessories survive NPC batching and keep preview-only material changes isolated', async () => {
  const source = await load('/models/avatar.glb');
  const config = {
    character: 'male',
    hair: 'short',
    outfit: 'row4_04_halfzip_cream',
    headwear: 'topi_beret_bear',
    eyewear: 'pixel_sunglasses',
  };
  const assets = new Map(
    await Promise.all(wearableAssetUrls(config).map(async (url) => [url, await load(url)])),
  );
  const model = createAvatarAppearance(source, config, assets);
  const baked = createStaticAvatar(model, { ...config, outfitColor: '#fff', skinColor: '#fff' });
  let torsoMaterials = 0,
    handWeights = 0,
    headWeights = 0;
  for (const mesh of baked.children) {
    if (mesh.material.name.includes('Fleece')) torsoMaterials++;
    const joints = mesh.geometry.getAttribute('idleJoint');
    for (let i = 0; i < joints.count; i++) {
      if (joints.getW(i) === 2) handWeights++;
      if (joints.getW(i) === 1) headWeights++;
    }
  }
  assert.ok(
    torsoMaterials > 0,
    'Custom cream material is rendered rather than recolored to default navy',
  );
  assert.ok(handWeights > 0 && headWeights > 0);
  const bakedBounds = new Box3().setFromObject(baked);
  assert.ok(bakedBounds.max.y < 2.2 && bakedBounds.min.y >= 0);
  const again = createAvatarAppearance(source, { ...config, outfit: 'navy' }, assets);
  assert.equal(
    again.getObjectByName('Torso').visible,
    true,
    'Removing a custom shirt restores the base look',
  );
  assert.equal(again.getObjectByName('FittedStoreOutfit'), undefined);
  disposeMaterials(model);
  disposeMaterials(again);
  disposeMaterials(baked);
});

test('Confirmed equip returns the exact outfit used by rendering; equip itself never spends more coins', async () => {
  const db = openDb(':memory:');
  try {
    const handle = createApiHandler({ db, demo: false, registrationOpen: true });
    let cookie = '';
    const request = (path, method = 'GET', body) =>
      handle(
        new Request('http://localhost/api' + path, {
          method,
          headers: { Cookie: cookie, 'Content-Type': 'application/json' },
          ...(body ? { body: JSON.stringify(body) } : {}),
        }),
      );
    const joined = await request('/join', 'POST', {
      fullName: 'Outfit Regression Test',
      nickname: 'Test',
      whatsapp: '081234509876',
      consentData: true,
      avatar: { character: 'male', hair: 'short', skin: 'warm', outfit: 'navy' },
    });
    cookie = joined.headers.get('set-cookie').split(';')[0];
    const before = await (await request('/store')).json();
    const item = before.items.find((i) => i.id === 'row4_04_halfzip_cream');
    const buy = await request('/store/buy', 'POST', { itemId: item.id });
    assert.equal(buy.status, 200);
    const purchased = await buy.json();
    assert.equal(purchased.coins, before.coins - item.price_coins);
    const equipped = await request('/store/equip', 'POST', {
      itemId: item.id,
      slot: 'outfit',
      action: 'equip',
    });
    assert.equal(equipped.status, 200);
    const saved = await equipped.json();
    assert.equal(saved.avatar.outfit, item.id);
    assert.deepEqual((await (await request('/me')).json()).avatar, saved.avatar);
    const after = await (await request('/store')).json();
    assert.equal(after.coins, purchased.coins);
    assert.ok(after.equipped.includes(item.id));
    assert.equal((await request('/store/buy', 'POST', { itemId: item.id })).status, 400);
    assert.equal((await (await request('/store')).json()).coins, purchased.coins);
    const removed = await request('/store/equip', 'POST', {
      itemId: item.id,
      slot: 'outfit',
      action: 'unequip',
    });
    assert.equal((await removed.json()).avatar.outfit, 'navy');
  } finally {
    db.close();
  }
});
