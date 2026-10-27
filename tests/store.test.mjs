import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.mjs';
import { createApiHandler } from '../server/api-handler.mjs';

test('Avatar Store & Inventory: coin balance, purchasing, equipping, and unauthorized protection', async () => {
  const db = openDb(':memory:');
  try {
    const handle = createApiHandler({ db });

    // 1. Unregistered visitor can see store catalog but cannot buy
    const guestStore = await handle(new Request('http://localhost/api/store'));
    assert.equal(guestStore.status, 200);
    const guestData = await guestStore.json();
    assert.equal(guestData.coins, 0);
    assert.ok(guestData.items.length >= 3);

    const guestBuy = await handle(
      new Request('http://localhost/api/store/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: 'topi_beret_bear' }),
      }),
    );
    assert.equal(guestBuy.status, 401);

    // 2. Register an alumni with default avatar
    const regRes = await handle(
      new Request('http://localhost/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Randy Fauzi',
          nickname: 'Randy',
          whatsapp: '081234567890',
          consentData: true,
          avatar: { character: 'male', outfit: 'navy', hair: 'short', skin: 'warm' },
        }),
      }),
    );
    assert.equal(regRes.status, 201);
    const cookie = regRes.headers.get('set-cookie');
    assert.ok(cookie);

    // 3. Registered alumni gets 100 starter coins
    const storeRes = await handle(
      new Request('http://localhost/api/store', {
        headers: { cookie },
      }),
    );
    assert.equal(storeRes.status, 200);
    const storeData = await storeRes.json();
    assert.equal(storeData.coins, 100);
    assert.deepEqual(storeData.inventory, []);

    // 4. Buy topi_beret_bear (50 coins)
    const buyRes = await handle(
      new Request('http://localhost/api/store/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ itemId: 'topi_beret_bear' }),
      }),
    );
    assert.equal(buyRes.status, 200);
    const buyData = await buyRes.json();
    assert.equal(buyData.ok, true);
    assert.equal(buyData.coins, 50, '100 - 50 = 50 coins remaining');

    // 5. Cannot buy the same item twice
    const rebuyRes = await handle(
      new Request('http://localhost/api/store/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ itemId: 'topi_beret_bear' }),
      }),
    );
    assert.equal(rebuyRes.status, 400);

    // 6. Equip topi_beret_bear
    const equipRes = await handle(
      new Request('http://localhost/api/store/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          itemId: 'topi_beret_bear',
          slot: 'headwear',
          action: 'equip',
        }),
      }),
    );
    assert.equal(equipRes.status, 200);
    const equipData = await equipRes.json();
    assert.equal(equipData.avatar.headwear, 'topi_beret_bear');

    // 7. Buy pixel_sunglasses (40 coins, balance goes 50 -> 10)
    const buyGlasses = await handle(
      new Request('http://localhost/api/store/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ itemId: 'pixel_sunglasses' }),
      }),
    );
    assert.equal(buyGlasses.status, 200);
    assert.equal((await buyGlasses.json()).coins, 10);

    // 8. Trying to buy anime_sunglasses (40 coins) with only 10 coins fails
    const failBuy = await handle(
      new Request('http://localhost/api/store/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ itemId: 'anime_sunglasses' }),
      }),
    );
    assert.equal(failBuy.status, 400);
    assert.match((await failBuy.json()).error, /koin tidak cukup/i);

    // 9. Equip pixel_sunglasses alongside topi_beret_bear
    const equipGlasses = await handle(
      new Request('http://localhost/api/store/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          itemId: 'pixel_sunglasses',
          slot: 'eyewear',
          action: 'equip',
        }),
      }),
    );
    assert.equal(equipGlasses.status, 200);
    const dualEquip = await equipGlasses.json();
    assert.equal(dualEquip.avatar.headwear, 'topi_beret_bear');
    assert.equal(dualEquip.avatar.eyewear, 'pixel_sunglasses');

    // 10. Unequip headwear
    const unequipRes = await handle(
      new Request('http://localhost/api/store/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          itemId: 'topi_beret_bear',
          slot: 'headwear',
          action: 'unequip',
        }),
      }),
    );
    assert.equal(unequipRes.status, 200);
    const unequipData = await unequipRes.json();
    assert.equal(!unequipData.avatar.headwear, true);
    assert.equal(unequipData.avatar.eyewear, 'pixel_sunglasses');
  } finally {
    db.close();
  }
});
