import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.mjs';
import { createApiHandler } from '../server/api-handler.mjs';

test('Chat API: unauthorized guests cannot send, registered alumni can send, and survey completion generates system broadcast', async () => {
  const db = openDb(':memory:');
  try {
    const handle = createApiHandler({ db });

    // 1. Initial chat list is empty
    const initRes = await handle(new Request('http://localhost/api/chat'));
    assert.equal(initRes.status, 200);
    const initData = await initRes.json();
    assert.deepEqual(initData.messages, []);

    // 2. Unregistered guest cannot post chat
    const unregRes = await handle(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Halo semua' }),
      }),
    );
    assert.equal(unregRes.status, 401);

    // 3. Register alumni with a character
    const regRes = await handle(
      new Request('http://localhost/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Budi Santoso',
          nickname: 'Budi',
          whatsapp: '081299998888',
          consentData: true,
          avatar: { character: 'male', outfit: 'navy', hair: 'short', skin: 'warm' },
        }),
      }),
    );
    assert.equal(regRes.status, 201);
    const cookie = regRes.headers.get('set-cookie');
    assert.ok(cookie);

    // 4. Registered alumni sends message
    const sendRes = await handle(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ text: '<b>Halo</b> semuanya, kangen nih!' }),
      }),
    );
    assert.equal(sendRes.status, 201);
    const sendData = await sendRes.json();
    assert.equal(sendData.message.nickname, 'Budi');
    assert.equal(sendData.message.text, 'Halo semuanya, kangen nih!', 'HTML tags must be stripped');
    assert.equal(sendData.message.isSystem, false);

    // 5. Rate limit: sending immediately within 2 seconds returns 429
    const rapidRes = await handle(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ text: 'Spam test' }),
      }),
    );
    assert.equal(rapidRes.status, 429);

    // 6. Complete survey to verify system broadcast
    const answers = [
      { concept: 'both' },
      { attendance: 'yes' },
      { committee: 'active', department: ['kreatif', 'acara'] },
      { activities: ['games', 'musik'], production: 'yes' },
      { venue: 'other', venueNote: 'Taman sekolah' },
      { contribution: 'depends', sponsor: 'donor' },
      { message: 'Sampai bertemu!' },
    ];
    for (let i = 0; i < 7; i++) {
      await handle(
        new Request(`http://localhost/api/answers/${i}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify(answers[i]),
        }),
      );
    }
    const compRes = await handle(
      new Request('http://localhost/api/complete', {
        method: 'POST',
        headers: { cookie },
      }),
    );
    assert.equal(compRes.status, 200);

    // 7. Verify chat messages contain Budi's message and the system survey broadcast
    const listRes = await handle(new Request('http://localhost/api/chat'));
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    assert.equal(listData.messages.length, 2);

    const userMsg = listData.messages[0];
    assert.equal(userMsg.nickname, 'Budi');
    assert.equal(userMsg.text, 'Halo semuanya, kangen nih!');
    assert.equal(userMsg.isSystem, false);

    const sysMsg = listData.messages[1];
    assert.equal(sysMsg.nickname, 'Sistem');
    assert.equal(sysMsg.isSystem, true);
    assert.ok(sysMsg.text.includes('Budi'));
    assert.ok(sysMsg.text.includes('Reunion Pass'));
  } finally {
    db.close();
  }
});
