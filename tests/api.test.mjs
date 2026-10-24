import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server/index.mjs';
import { openDb, hash } from '../server/db.mjs';
import { normalizePhone, groupFor, badgesFor, validateAnswer } from '../server/domain.mjs';

const avatar = { outfit: 'sage', hair: 'bob', skin: 'warm' };
const answers = [
  { concept: 'both' },
  { attendance: 'no' },
  { committee: 'active', department: ['kreatif', 'acara'] },
  { activities: ['games', 'musik'], production: 'yes' },
  { venue: 'other', venueNote: 'Taman sekolah' },
  { contribution: 'depends', sponsor: 'donor' },
  { message: 'Sampai bertemu!' },
];
async function fixture(t, { demo = false, publicOrigins = [] } = {}) {
  const db = openDb(':memory:');
  const server = createApp({ db, demo, publicOrigins, adminToken: 'test-secret-token' }).listen(
    0,
    '127.0.0.1',
  );
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections();
    server.close();
    db.close();
  });
  const base = 'http://127.0.0.1:' + server.address().port;
  const request = async (path, { cookie, body, method = 'GET', token, headers = {} } = {}) => {
    const r = await fetch(base + '/api' + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { cookie } : {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: r.status,
      body: await r.json(),
      cookie: r.headers.get('set-cookie')?.split(';')[0],
    };
  };
  const invite = (code = 'XEL-PRIVATE') =>
    db
      .prepare('INSERT INTO invitations(code_hash,label) VALUES(?,?)')
      .run(hash(code), 'Test Alumni');
  const join = async (extra = {}) =>
    request('/join', {
      method: 'POST',
      body: {
        fullName: 'Alumni Penguji',
        nickname: 'Teman',
        whatsapp: '081234567890',
        avatar,
        consentData: true,
        consentPublic: true,
        invitation: 'XEL-PRIVATE',
        ...extra,
      },
    });
  return { db, request, invite, join };
}
test('Phone normalization and independent participation semantics', () => {
  assert.equal(normalizePhone('+62 812-3456-7890'), '6281234567890');
  assert.equal(normalizePhone('081234567890'), '6281234567890');
  assert.throws(() => normalizePhone('abc'));
  const a = { attendance: 'no', committee: 'active', production: 'yes', sponsor: 'donor' };
  assert.equal(groupFor(a), 'supporter');
  assert.deepEqual(badgesFor(a), ['Crew', 'Production', 'Supporter']);
  assert.throws(() => validateAnswer(2, { committee: 'active', department: [] }));
  assert.throws(() => validateAnswer(0, { concept: 'tampered' }));
  assert.throws(() => validateAnswer(6, { message: 'a'.repeat(1001) }));
  assert.deepEqual(validateAnswer(2, { committee: 'participant', department: ['acara'] }), {
    committee: 'participant',
    department: [],
  });
});
test('Next.js proxy accepts only explicitly configured frontend origins from loopback', async (t) => {
  const { request } = await fixture(t, { publicOrigins: ['http://127.0.0.1:3001'] });
  assert.equal(
    (await request('/logout', { method: 'POST', headers: { Origin: 'http://127.0.0.1:3001' } }))
      .status,
    200,
  );
  assert.equal(
    (await request('/logout', { method: 'POST', headers: { Origin: 'https://other.example' } }))
      .status,
    403,
  );
});
test('Private invitations, secure sessions, resume, autosave, completion and public privacy', async (t) => {
  const { request, invite, join } = await fixture(t);
  invite();
  assert.equal((await join({ invitation: 'wrong' })).status, 403);
  const joined = await join();
  assert.equal(joined.status, 201);
  const cookie = joined.cookie,
    id = joined.body.id;
  assert.ok(cookie);
  assert.equal((await request('/me', { cookie })).body.id, id);
  assert.equal((await request('/me')).status, 401);
  assert.deepEqual((await request('/world')).body, []);
  assert.equal((await request('/complete', { cookie, method: 'POST' })).status, 400);
  assert.equal(
    (await request('/answers/2', { cookie, method: 'PUT', body: answers[2] })).status,
    400,
  );
  assert.equal((await request('/me', { cookie })).body.progress.length, 0);
  for (let i = 0; i < 7; i++) {
    const r = await request('/answers/' + i, { cookie, method: 'PUT', body: answers[i] });
    assert.equal(r.status, 200);
    assert.equal(r.body.progress.length, i + 1);
  }
  const resume = await request('/resume', { method: 'POST', body: { invitation: 'XEL-PRIVATE' } });
  assert.equal(resume.status, 200);
  assert.equal(resume.body.id, id);
  assert.deepEqual(resume.body.answers.activities, ['games', 'musik']);
  assert.equal((await request('/world')).body.length, 0);
  const done = await request('/complete', { cookie, method: 'POST' });
  assert.ok(done.body.completedAt);
  const world = (await request('/world')).body;
  assert.equal(world.length, 1);
  assert.equal(world[0].group, 'supporter');
  assert.deepEqual(world[0].badges, ['Crew', 'Production', 'Supporter']);
  assert.deepEqual(Object.keys(world[0]).sort(), ['avatar', 'badges', 'group', 'id', 'nickname']);
  assert.equal(JSON.stringify(world).includes('6281234567890'), false);
  assert.equal(JSON.stringify(world).includes('Sampai bertemu'), false);
  const again = await join();
  assert.equal(again.status, 200);
  assert.equal(again.body.id, id);
  await request('/profile', { method: 'PATCH', cookie, body: { consentPublic: false } });
  assert.equal((await request('/world')).body.length, 0);
  const hiddenResume = await request('/me', { cookie: resume.cookie });
  assert.equal(hiddenResume.body.consentPublic, false);
  await request('/logout', { cookie, method: 'POST' });
  assert.equal((await request('/me', { cookie })).status, 401);
});
test('Duplicates cannot be used to take over a profile', async (t) => {
  const { request, invite, join } = await fixture(t);
  invite();
  invite('XEL-OTHER');
  await join();
  const duplicate = await join({ invitation: 'XEL-OTHER', whatsapp: '+62 81234567890' });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.cookie, undefined);
  assert.equal(
    (await request('/resume', { method: 'POST', body: { invitation: 'XEL-OTHER' } })).status,
    403,
  );
});
test('Validation, origin checks and admin access protect data', async (t) => {
  const { request, invite, join } = await fixture(t);
  invite();
  assert.equal((await join({ consentData: false })).status, 400);
  assert.equal((await join({ avatar: { outfit: 'invalid' } })).status, 400);
  const joined = await join(),
    cookie = joined.cookie;
  assert.equal(
    (await request('/answers/0', { method: 'PUT', cookie, body: { concept: 'invalid' } })).status,
    400,
  );
  assert.equal(
    (await request('/answers/7', { method: 'PUT', cookie, body: { message: 'no' } })).status,
    400,
  );
  assert.equal(
    (
      await request('/profile', {
        method: 'PATCH',
        cookie,
        body: { consentPublic: false },
        headers: { Origin: 'https://other.example' },
      })
    ).status,
    403,
  );
  assert.equal((await request('/admin')).status, 403);
  assert.equal((await request('/admin', { token: 'wrong' })).status, 403);
  const admin = await request('/admin', { token: 'test-secret-token' });
  assert.equal(admin.status, 200);
  assert.equal(admin.body[0].whatsapp, '6281234567890');
  await request('/admin/alumni/' + joined.body.id, {
    method: 'DELETE',
    token: 'test-secret-token',
  });
  assert.equal((await request('/me', { cookie })).status, 401);
  assert.equal((await request('/admin', { token: 'test-secret-token' })).body.length, 0);
});
test('Demo is explicit and can be disabled', async (t) => {
  const privateApp = await fixture(t);
  assert.equal((await privateApp.join({ invitation: 'XEL-DEMO' })).status, 403);
  const local = await fixture(t, { demo: true });
  assert.equal((await local.join({ invitation: 'XEL-DEMO' })).status, 201);
  assert.equal((await local.request('/config')).body.demo, true);
});
test('Fifty alumni on one shared IP can register and complete the whole journey', async (t) => {
  const { db, request } = await fixture(t);
  const people = await Promise.all(
    Array.from({ length: 50 }, async (_, i) => {
      const invitation = 'XEL-CAPACITY-' + i;
      db.prepare('INSERT INTO invitations(code_hash,label) VALUES(?,?)').run(
        hash(invitation),
        'Capacity test ' + i,
      );
      const joined = await request('/join', {
        method: 'POST',
        body: {
          fullName: 'Capacity Alumni ' + i,
          nickname: 'Teman ' + i,
          whatsapp: '08123456' + String(i).padStart(4, '0'),
          avatar,
          consentData: true,
          consentPublic: true,
          invitation,
        },
      });
      assert.equal(joined.status, 201);
      return joined.cookie;
    }),
  );
  for (let index = 0; index < 7; index++)
    await Promise.all(
      people.map(async (cookie) =>
        assert.equal(
          (await request('/answers/' + index, { method: 'PUT', cookie, body: answers[index] }))
            .status,
          200,
        ),
      ),
    );
  await Promise.all(
    people.map(async (cookie) =>
      assert.equal((await request('/complete', { method: 'POST', cookie })).status, 200),
    ),
  );
  assert.equal((await request('/world')).body.length, 50);
});
