import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApiHandler } from '../server/api-handler.mjs';
import { openDb, validateDatabasePath } from '../server/db.mjs';

test('Production storage rejects relative, deployment, and public paths', () => {
  const options = { persistentRequired: true };
  for (const path of [
    './data/db.sqlite',
    ':memory:',
    join(process.cwd(), 'data/db.sqlite'),
    '/home/example/hbuilds/current/db.sqlite',
    '/home/example/public_html/db.sqlite',
  ])
    assert.throws(() => validateDatabasePath(path, options));
  assert.equal(
    validateDatabasePath(join(tmpdir(), 'xelograph-private/db.sqlite'), options),
    join(tmpdir(), 'xelograph-private/db.sqlite'),
  );
});

test('Native Next handler keeps answers and sessions after replacing the deployment, and creates a restorable backup', async () => {
  const root = mkdtempSync(join(tmpdir(), 'xel-deploy-'));
  const deployment = join(root, 'release');
  const database = join(root, 'persistent', 'db.sqlite');
  let db;
  try {
    mkdirSync(deployment);
    db = openDb(database);
    let handle = createApiHandler({ db, demo: true, adminToken: 'test-admin' });
    const request = async (path, { method = 'GET', body, cookie, token } = {}) =>
      handle(
        new Request('https://reunion.example/api' + path, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Origin: 'https://reunion.example',
            ...(cookie ? { cookie } : {}),
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        }),
      );
    const joined = await request('/join', {
      method: 'POST',
      body: {
        fullName: 'Deployment Probe',
        nickname: 'Probe',
        whatsapp: '081234567890',
        avatar: { outfit: 'sage', hair: 'short', skin: 'warm' },
        invitation: 'XEL-DEMO',
        consentData: true,
        consentPublic: false,
      },
    });
    assert.equal(joined.status, 201);
    const cookie = joined.headers.get('set-cookie').split(';')[0];
    const id = (await joined.json()).id;
    assert.equal(
      (await request('/answers/0', { method: 'PUT', cookie, body: { concept: 'both' } })).status,
      200,
    );
    db.close();
    db = null;
    rmSync(deployment, { recursive: true });
    mkdirSync(deployment);
    db = openDb(database);
    handle = createApiHandler({ db, demo: true, adminToken: 'test-admin' });
    const resumed = await (await request('/me', { cookie })).json();
    assert.equal(resumed.id, id);
    assert.equal(resumed.answers.concept, 'both');
    assert.deepEqual(resumed.progress, [0]);
    assert.equal((await request('/admin/storage')).status, 403);
    const health = await (await request('/admin/storage', { token: 'test-admin' })).json();
    assert.equal(health.integrity, 'ok');
    assert.equal(health.persistent, true);
    const result = await (
      await request('/admin/backup', { method: 'POST', token: 'test-admin' })
    ).json();
    assert.equal(result.ok, true);
    assert.ok(existsSync(result.filename));
    const restored = openDb(result.filename);
    assert.equal(
      JSON.parse(
        restored.prepare('SELECT answers_json FROM responses WHERE alumni_id=?').get(id)
          .answers_json,
      ).concept,
      'both',
    );
    restored.close();
    const malformed = await handle(
      new Request('https://reunion.example/api/join', { method: 'POST', body: '{broken' }),
    );
    assert.equal(malformed.status, 400);
    const oversized = await handle(
      new Request('https://reunion.example/api/join', { method: 'POST', body: 'x'.repeat(16385) }),
    );
    assert.equal(oversized.status, 413);
  } finally {
    db?.close();
    rmSync(root, { recursive: true, force: true });
  }
});
