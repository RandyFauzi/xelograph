import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openDb } from '../server/db.mjs';
import { createApiHandler } from '../server/api-handler.mjs';

const initial = { character: 'male', hair: 'cap', outfit: 'sage', skin: 'light' };
const changed = { character: 'female', hair: 'hijab', outfit: 'clay', skin: 'deep' };
const answers = [
  { concept: 'both' },
  { attendance: 'yes' },
  { committee: 'participant', department: [] },
  { activities: ['musik'], production: 'no' },
  { venue: 'sekolah' },
  { contribution: 'no', sponsor: 'no' },
  { message: 'Uji avatar tersimpan' },
];
function client(getHandle) {
  return async (path, method = 'GET', body, cookie) =>
    getHandle()(
      new Request('https://world.example/api' + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://world.example',
          ...(cookie ? { cookie } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
}
const joinBody = (phone, avatar = initial) => ({
  fullName: 'Penguji Setting',
  nickname: 'Penguji',
  whatsapp: phone,
  avatar,
  consentData: true,
  consentPublic: true,
});
function clean(folder) {
  if (
    dirname(resolve(folder)) !== resolve(tmpdir()) ||
    !basename(folder).startsWith('xylo-avatar-')
  )
    throw new Error('Unsafe temporary cleanup');
  rmSync(folder, { recursive: true, force: true });
}

test('Saved avatar settings drive /me and public world, retain answers, and survive database reopen', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'xylo-avatar-'));
  let db;
  try {
    const file = join(folder, 'db.sqlite');
    db = openDb(file);
    let handle = createApiHandler({ db });
    const request = client(() => handle);
    const joined = await request('/join', 'POST', joinBody('081234567890'));
    assert.equal(joined.status, 201);
    const cookie = joined.headers.get('set-cookie').split(';')[0];
    const original = await joined.json();
    for (let i = 0; i < 7; i++)
      assert.equal((await request('/answers/' + i, 'PUT', answers[i], cookie)).status, 200);
    assert.equal((await request('/complete', 'POST', {}, cookie)).status, 200);
    const updated = await request(
      '/avatar',
      'PATCH',
      { avatar: changed, expectedRevision: 1 },
      cookie,
    );
    assert.equal(updated.status, 200);
    const profile = await updated.json();
    assert.deepEqual(profile.avatar, changed);
    assert.equal(profile.avatarRevision, 2);
    assert.equal(profile.progress.length, 7);
    assert.ok(profile.completedAt);
    assert.ok(profile.avatarUpdatedAt);
    assert.deepEqual(
      (await (await request('/avatar', 'GET', null, cookie)).json()).avatar,
      changed,
    );
    const stale = await request(
      '/avatar',
      'PATCH',
      { avatar: initial, expectedRevision: 1 },
      cookie,
    );
    assert.equal(stale.status, 409);
    assert.equal(
      (
        await request(
          '/avatar',
          'PATCH',
          { avatar: { ...changed, hair: 'invalid' }, expectedRevision: 2 },
          cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (await request('/avatar', 'PATCH', { avatar: initial, expectedRevision: 2 })).status,
      401,
    );
    db.close();
    db = null;
    db = openDb(file);
    handle = createApiHandler({ db });
    const resumed = await (await request('/me', 'GET', null, cookie)).json();
    assert.deepEqual(resumed.avatar, changed);
    assert.equal(resumed.avatarRevision, 2);
    assert.equal(resumed.answers.message, answers[6].message);
    const world = await (await request('/world')).json();
    assert.equal(world[0].id, original.id);
    assert.deepEqual(world[0].avatar, changed);
    assert.deepEqual(
      JSON.parse(
        db.prepare('SELECT avatar_json FROM alumni WHERE id=?').get(original.id).avatar_json,
      ),
      changed,
    );
  } finally {
    db?.close();
    clean(folder);
  }
});

test('Avatar update can only affect the authenticated owner even if another alumni id is supplied', async () => {
  const db = openDb(':memory:');
  try {
    const handle = createApiHandler({ db }),
      request = client(() => handle);
    const first = await request('/join', 'POST', joinBody('081234567890'));
    const ownerCookie = first.headers.get('set-cookie').split(';')[0];
    const owner = await first.json();
    const second = await request('/join', 'POST', joinBody('081234567891'));
    const other = await second.json();
    assert.equal(
      (
        await request(
          '/avatar',
          'PATCH',
          { avatar: changed, expectedRevision: 1, alumniId: other.id },
          ownerCookie,
        )
      ).status,
      200,
    );
    assert.deepEqual(
      JSON.parse(db.prepare('SELECT avatar_json FROM alumni WHERE id=?').get(owner.id).avatar_json),
      changed,
    );
    assert.deepEqual(
      JSON.parse(db.prepare('SELECT avatar_json FROM alumni WHERE id=?').get(other.id).avatar_json),
      initial,
    );
  } finally {
    db.close();
  }
});

test('Legacy database migration preserves exact avatar JSON and initializes settings metadata idempotently', () => {
  const folder = mkdtempSync(join(tmpdir(), 'xylo-avatar-'));
  let db;
  try {
    const file = join(folder, 'legacy.sqlite');
    db = new DatabaseSync(file);
    const schema = readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8')
      .replace(/^ avatar_revision.*\r?\n/gm, '')
      .replace(/^ avatar_updated_at.*\r?\n/gm, '');
    db.exec(schema);
    const oldAvatar = JSON.stringify({ outfit: 'cream', hair: 'bob', skin: 'warm' });
    db.prepare(
      'INSERT INTO alumni(id,full_name,nickname,whatsapp,avatar_json,consent_at) VALUES(?,?,?,?,?,?)',
    ).run('legacy', 'Alumni Lama', 'Lama', '6281234567890', oldAvatar, new Date().toISOString());
    db.prepare('INSERT INTO responses(alumni_id,answers_json) VALUES(?,?)').run(
      'legacy',
      '{"concept":"both"}',
    );
    db.close();
    db = null;
    for (let i = 0; i < 2; i++) {
      db = openDb(file);
      const row = db.prepare('SELECT * FROM alumni WHERE id=?').get('legacy');
      assert.equal(row.avatar_json, oldAvatar);
      assert.equal(row.avatar_revision, 1);
      assert.equal(row.avatar_updated_at, row.created_at);
      assert.equal(
        db.prepare('SELECT answers_json FROM responses').get().answers_json,
        '{"concept":"both"}',
      );
      db.close();
      db = null;
    }
  } finally {
    db?.close();
    clean(folder);
  }
});
