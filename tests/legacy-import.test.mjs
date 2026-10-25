import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, hash } from '../server/db.mjs';
import { createApiHandler } from '../server/api-handler.mjs';
import { deriveAdminAccessCode } from '../server/admin-access.mjs';
import {
  importLegacySurvey,
  prepareLegacyRow,
  publicLegacyAvatars,
  adminRespondents,
} from '../server/legacy-import.mjs';
const adminToken = 'unit-test-admin-secret';
const raw = (name, phone) => ({
  Timestamp: '46311.5',
  '1. Nama lengkap': name,
  '2. Nomor WhatsApp yang aktif': phone,
  '3. Apakah setuju jika acara Bukber sekaligus Reuni?': 'Sangat setuju',
  '4. Apakah bisa hadir?': 'Insyaallah hadirpsi 1',
  '5. Bersedia menjadi panitia?': 'Bersedia menjadi panitia aktif',
  '6. Bersedia berkontribusi dalam tim produksi?':
    'Tertarik, tetapi ingin mengetahui detailnya terlebih dahulu',
  '7. Bidang apa yang diminati?': 'Acara dan hiburan',
  '8. Tempat mana yang cocok?': 'Siring',
  '9. Konsep acara?': 'Kumpul keluarga, bebas',
  '10. Iuran atau kontribusi?': 'Bersedia jika nominalnya terjangkau',
  '11. Donatur atau sponsor?': 'Bersedia bantu mencarikan donatur atau sponsor.',
  '12. Masukan dan saran': 'Saran asli dipertahankan',
});
const payload = (rows) => ({
  version: 1,
  sourceName: 'synthetic.xlsx',
  fingerprint: hash('synthetic-source'),
  sheets: [{ name: 'Jawaban', rows: rows.map((cells, i) => ({ rowNumber: i + 2, cells })) }],
});
const client =
  (handle) =>
  async (path, { method = 'GET', body, cookie, token } = {}) =>
    handle(
      new Request('https://world.example/api' + path, {
        method,
        headers: {
          Origin: 'https://world.example',
          'Content-Type': 'application/json',
          ...(cookie ? { cookie } : {}),
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
test('Legacy import retains raw answers, unknown contacts and missing new questions; publishes stable authentic avatars', () => {
  const db = openDb(':memory:');
  try {
    const p = payload([raw('Alumni Satu', '081234567890'), raw('Alumni Dua', 'Privasi')]);
    assert.equal(importLegacySurvey(db, p, { publishAvatars: true, dryRun: true }).inserted, 2);
    assert.equal(db.prepare('SELECT count(*) n FROM legacy_responses').get().n, 0);
    const summary = importLegacySurvey(db, p, { publishAvatars: true });
    assert.equal(summary.inserted, 2);
    assert.equal(summary.missingContacts, 1);
    const rows = db.prepare('SELECT * FROM legacy_responses ORDER BY row_number').all();
    const a = JSON.parse(rows[0].answers_json);
    assert.equal(a.attendance, 'yes');
    assert.equal(a.production, 'maybe');
    assert.deepEqual(a.department, ['acara']);
    assert.equal(a.venue, 'other');
    assert.equal(a.venueNote, 'Siring');
    assert.equal(a.contribution, 'depends');
    assert.equal(a.concept, undefined);
    assert.equal(a.activities, undefined);
    assert.equal(a.sponsor, undefined);
    assert.deepEqual(JSON.parse(rows[0].raw_json), p.sheets[0].rows[0].cells);
    assert.equal(rows[1].whatsapp, null);
    const first = publicLegacyAvatars(db);
    assert.equal(first.length, 2);
    assert.ok(first.every((r) => !('whatsapp' in r) && !('answers' in r) && !('full_name' in r)));
    assert.deepEqual(publicLegacyAvatars(db), first);
    assert.equal(importLegacySurvey(db, p, { publishAvatars: true }).inserted, 0);
    assert.equal(publicLegacyAvatars(db).length, 2);
    assert.equal(adminRespondents(db).length, 2);
    assert.ok(adminRespondents(db)[0].raw);
    assert.equal(
      prepareLegacyRow({ rowNumber: 2, cells: raw('Phone Format', '81234567890') }, 'Sheet')
        .whatsapp,
      '6281234567890',
    );
  } finally {
    db.close();
  }
});
test('Matching preserves selected avatars and current answers, waives repeat filling, and avoids double avatars', async () => {
  const db = openDb(':memory:');
  try {
    const request = client(createApiHandler({ db })),
      avatar = { character: 'female', hair: 'hijab', outfit: 'clay', skin: 'deep' };
    const joined = await request('/join', {
      method: 'POST',
      body: {
        fullName: 'Alumni Satu',
        nickname: 'Satu',
        whatsapp: '081234567890',
        avatar,
        consentData: true,
        consentPublic: true,
      },
    });
    const person = await joined.json(),
      cookie = joined.headers.get('set-cookie').split(';')[0];
    await request('/answers/0', { method: 'PUT', body: { concept: 'fun' }, cookie });
    assert.equal(
      importLegacySurvey(db, payload([raw('Alumni Satu', '081234567890')]), {
        publishAvatars: true,
      }).linked,
      1,
    );
    const profile = await (await request('/me', { cookie })).json();
    assert.deepEqual(profile.avatar, avatar);
    assert.equal(profile.answers.concept, 'fun');
    assert.equal(profile.progress.length, 7);
    assert.equal(profile.surveyOrigin, 'legacy_import');
    const world = await (await request('/world')).json();
    assert.equal(world.length, 1);
    assert.equal(world[0].id, person.id);
    assert.deepEqual(world[0].avatar, avatar);
    assert.equal(adminRespondents(db).length, 1);
  } finally {
    db.close();
  }
});
test('Admin code creates private session, protects original answers, and revokes on logout or credential change', async () => {
  const db = openDb(':memory:');
  try {
    const request = client(createApiHandler({ db, adminToken }));
    assert.equal((await request('/admin')).status, 403);
    assert.equal(
      (await request('/admin/session', { method: 'POST', body: { code: 'wrong' } })).status,
      403,
    );
    const login = await request('/admin/session', {
      method: 'POST',
      body: { code: deriveAdminAccessCode(adminToken) },
    });
    assert.equal(login.status, 200);
    assert.match(login.headers.get('set-cookie'), /HttpOnly/);
    assert.match(login.headers.get('set-cookie'), /SameSite=Strict/);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal((await request('/admin', { cookie })).status, 200);
    const body = { payload: payload([raw('Alumni Satu', 'Privasi')]), publishAvatars: true };
    assert.equal((await request('/admin/import', { method: 'POST', body })).status, 403);
    assert.equal((await request('/admin/import', { method: 'POST', body, cookie })).status, 200);
    assert.equal(
      (await (await request('/admin', { cookie })).json())[0].raw['12. Masukan dan saran'],
      'Saran asli dipertahankan',
    );
    assert.equal(
      (await client(createApiHandler({ db, adminToken: 'different-secret' }))('/admin', { cookie }))
        .status,
      403,
    );
    await request('/admin/session', { method: 'DELETE', cookie });
    assert.equal((await request('/admin', { cookie })).status, 403);
    assert.equal((await request('/admin', { token: adminToken })).status, 200);
  } finally {
    db.close();
  }
});
test('Admin code login is rate limited and malformed source cannot partially import', async () => {
  const db = openDb(':memory:');
  try {
    const request = client(createApiHandler({ db, adminToken }));
    for (let i = 0; i < 5; i++)
      assert.equal(
        (await request('/admin/session', { method: 'POST', body: { code: 'bad' } })).status,
        403,
      );
    assert.equal(
      (
        await request('/admin/session', {
          method: 'POST',
          body: { code: deriveAdminAccessCode(adminToken) },
        })
      ).status,
      429,
    );
    assert.throws(() =>
      importLegacySurvey(db, payload([raw('Valid Name', 'Privasi'), raw('', 'Privasi')]), {
        publishAvatars: true,
      }),
    );
    assert.equal(db.prepare('SELECT count(*) n FROM survey_imports').get().n, 0);
  } finally {
    db.close();
  }
});
test('Admin can toggle respondent visibility in world and delete duplicate respondents', async () => {
  const db = openDb(':memory:');
  try {
    const request = client(createApiHandler({ db, adminToken }));
    const p = payload([
      raw('Alumni Ganda Satu', '081111111111'),
      raw('Alumni Ganda Dua', '081111111111'),
    ]);
    importLegacySurvey(db, p, { publishAvatars: true });

    let world = await (await request('/world')).json();
    assert.equal(world.length, 2);

    const adminList = await (await request('/admin', { token: adminToken })).json();
    assert.equal(adminList.length, 2);
    assert.equal(adminList[0].consent_public, true);
    assert.ok(adminList[0].avatar);

    const targetId = adminList[0].id;
    // Toggle visibility to false
    const toggleRes = await request(`/admin/alumni/${encodeURIComponent(targetId)}/visibility`, {
      method: 'PATCH',
      token: adminToken,
      body: { enabled: false },
    });
    assert.equal(toggleRes.status, 200);

    world = await (await request('/world')).json();
    assert.equal(world.length, 1);
    assert.ok(!world.some((w) => w.id === targetId));

    // Toggle back to true
    await request(`/admin/alumni/${encodeURIComponent(targetId)}/visibility`, {
      method: 'PATCH',
      token: adminToken,
      body: { enabled: true },
    });
    world = await (await request('/world')).json();
    assert.equal(world.length, 2);

    // Delete duplicate respondent
    const deleteRes = await request(`/admin/alumni/${encodeURIComponent(targetId)}`, {
      method: 'DELETE',
      token: adminToken,
    });
    assert.equal(deleteRes.status, 200);

    const updatedAdmin = await (await request('/admin', { token: adminToken })).json();
    assert.equal(updatedAdmin.length, 1);
    assert.ok(!updatedAdmin.some((r) => r.id === targetId));

    world = await (await request('/world')).json();
    assert.equal(world.length, 1);
  } finally {
    db.close();
  }
});

test('Simple owner and committee codes grant separate server-enforced roles', async () => {
  const db = openDb(':memory:');
  try {
    const request = client(createApiHandler({ db, adminToken }));
    const ownerCode = deriveAdminAccessCode(adminToken);
    const viewerCode = deriveAdminAccessCode(adminToken, 'viewer');
    assert.match(ownerCode, /^\d{8}$/);
    assert.match(viewerCode, /^\d{8}$/);
    assert.notEqual(ownerCode, viewerCode);
    const cookies = {};
    for (const [role, code] of [
      ['owner', ownerCode],
      ['viewer', viewerCode],
    ]) {
      const login = await request('/admin/session', {
        method: 'POST',
        body: { code, role: 'owner' },
      });
      assert.equal(login.status, 200);
      assert.equal((await login.json()).role, role);
      cookies[role] = login.headers.get('set-cookie').split(';')[0];
      assert.equal((await request('/admin', { cookie: cookies[role] })).status, 200);
      assert.equal(
        (await (await request('/admin/session', { cookie: cookies[role] })).json()).role,
        role,
      );
    }
    const source = payload([raw('Role Test Alumni', 'Privasi')]);
    const cookie = cookies.viewer;
    for (const [path, method, body] of [
      ['/admin/import', 'POST', { payload: source, publishAvatars: true }],
      ['/admin/backup', 'POST', {}],
      ['/admin/storage', 'GET', null],
      ['/admin/alumni/legacy%3Amissing/visibility', 'PATCH', { enabled: false }],
      ['/admin/alumni/legacy%3Amissing', 'DELETE', {}],
      ['/admin/unknown', 'POST', {}],
    ])
      assert.equal(
        (await request(path, { method, body: body || undefined, cookie })).status,
        403,
        path,
      );
    assert.equal(db.prepare('SELECT count(*) n FROM legacy_responses').get().n, 0);
    assert.equal(
      (
        await request('/admin/import', {
          method: 'POST',
          body: { payload: source, publishAvatars: true },
          cookie: cookies.owner,
        })
      ).status,
      200,
    );
    const row = (await (await request('/admin', { cookie })).json())[0];
    const item = '/admin/alumni/' + encodeURIComponent(row.id);
    assert.equal(
      (
        await request(item + '/visibility', {
          method: 'PATCH',
          body: { enabled: false },
          cookie: cookies.owner,
        })
      ).status,
      200,
    );
    assert.equal((await request(item, { method: 'DELETE', cookie })).status, 403);
    assert.equal((await request(item, { method: 'DELETE', cookie: cookies.owner })).status, 200);
    const rotated = client(
      createApiHandler({ db, adminToken, viewerCodeHash: hash('new-viewer-code') }),
    );
    assert.equal((await rotated('/admin', { cookie })).status, 403);
    assert.equal((await rotated('/admin', { cookie: cookies.owner })).status, 200);
    await request('/admin/session', { method: 'DELETE', cookie });
    assert.equal((await request('/admin', { cookie })).status, 403);
  } finally {
    db.close();
  }
});

test('Missing admin credentials cannot grant a role through an arbitrary cookie', async () => {
  const db = openDb(':memory:');
  try {
    const request = client(
      createApiHandler({
        db,
        adminToken: undefined,
        adminCodeHash: undefined,
        viewerCodeHash: undefined,
      }),
    );
    assert.equal((await request('/admin', { cookie: 'xylo_admin=not-a-session' })).status, 403);
  } finally {
    db.close();
  }
});
