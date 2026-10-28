import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fittingAvatar, toggleFittingItem, clearFittingSlot } from '../src/game/shopPreview.ts';
import { createApiHandler } from '../server/api-handler.mjs';
import { openDb } from '../server/db.mjs';

test('Fitting combinations preserve identity, replace only their own slot and reset to the latest saved outfit', () => {
  const saved = Object.freeze({
    character: 'female',
    hair: 'hijab',
    skin: 'deep',
    outfit: 'clay',
    eyewear: 'anime_sunglasses',
  });
  const hat = { id: 'topi_beret_bear', category: 'headwear' };
  const eye = { id: 'pixel_sunglasses', category: 'eyewear' };
  const shirt = { id: 'row4_01_varsity_black', category: 'outfit' };
  let selection = Object.freeze({});
  for (const item of [hat, eye, shirt])
    selection = Object.freeze(toggleFittingItem(selection, item));
  const preview = fittingAvatar(saved, selection);
  assert.deepEqual(preview, { ...saved, headwear: hat.id, eyewear: eye.id, outfit: shirt.id });
  assert.equal(saved.eyewear, 'anime_sunglasses');
  assert.equal(saved.outfit, 'clay');
  assert.deepEqual(fittingAvatar(saved, toggleFittingItem(selection, eye)), {
    ...saved,
    headwear: hat.id,
    outfit: shirt.id,
  });
  const next = toggleFittingItem(selection, { id: 'row4_02_track_blue', category: 'outfit' });
  assert.equal(fittingAvatar(saved, next).outfit, 'row4_02_track_blue');
  // An explicit save of one slot must not silently save other trial items.
  const updatedSaved = { ...saved, outfit: shirt.id };
  const afterSave = clearFittingSlot(selection, 'outfit');
  assert.equal(afterSave.headwear, hat.id);
  assert.deepEqual(fittingAvatar(updatedSaved, {}), updatedSaved);
});

test('Trying the real catalog with zero coins leaves balance, inventory and persisted profile unchanged; unowned equip is still rejected', async () => {
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
    const join = await request('/join', 'POST', {
      fullName: 'Preview Test Alumni',
      nickname: 'Preview',
      whatsapp: '081235678910',
      consentData: true,
      avatar: { character: 'female', hair: 'hijab', skin: 'deep', outfit: 'clay' },
    });
    assert.equal(join.status, 201);
    cookie = join.headers.get('set-cookie').split(';')[0];
    const initialProfile = await join.json();
    await request('/store');
    db.prepare('UPDATE user_wallets SET coins_balance=0 WHERE alumni_id=?').run(initialProfile.id);
    const before = await (await request('/store')).json();
    assert.equal(before.coins, 0);
    let selection = {};
    for (const item of before.items) {
      selection = toggleFittingItem(selection, item);
      const preview = fittingAvatar(initialProfile.avatar, selection);
      assert.equal(preview[item.category], item.id);
      assert.equal(preview.character, initialProfile.avatar.character);
      assert.equal(preview.skin, initialProfile.avatar.skin);
    }
    const attempted = before.items[0];
    assert.equal(
      (
        await request('/store/equip', 'POST', {
          itemId: attempted.id,
          slot: attempted.category,
          action: 'equip',
        })
      ).status,
      403,
    );
    const after = await (await request('/store')).json();
    assert.deepEqual(after, before);
    assert.deepEqual(await (await request('/me')).json(), initialProfile);
    assert.deepEqual(fittingAvatar(initialProfile.avatar, {}), initialProfile.avatar);
  } finally {
    db.close();
  }
});
