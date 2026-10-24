import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
import { openDb } from '../server/db.mjs';
test('Disk database survives reopening and enforces unique response/progress constraints', () => {
  const folder = mkdtempSync(join(tmpdir(), 'xelograph-test-')),
    path = join(folder, 'db.sqlite');
  try {
    let db = openDb(path);
    db.prepare(
      'INSERT INTO alumni(id,full_name,nickname,whatsapp,avatar_json,consent_at) VALUES(?,?,?,?,?,?)',
    ).run(
      'id-1',
      'Alumni Persisten',
      'Teman',
      '6281234567890',
      '{"outfit":"sage","hair":"short","skin":"warm"}',
      new Date().toISOString(),
    );
    db.prepare('INSERT INTO responses(alumni_id,answers_json) VALUES(?,?)').run(
      'id-1',
      '{"concept":"both"}',
    );
    db.prepare('INSERT INTO checkpoint_progress(alumni_id,checkpoint) VALUES(?,?)').run('id-1', 0);
    db.close();
    db = openDb(path);
    assert.equal(
      JSON.parse(
        db.prepare('SELECT answers_json FROM responses WHERE alumni_id=?').get('id-1').answers_json,
      ).concept,
      'both',
    );
    assert.equal(db.prepare('SELECT count(*) AS n FROM checkpoint_progress').get().n, 1);
    assert.throws(() => db.prepare('INSERT INTO responses(alumni_id) VALUES(?)').run('id-1'));
    assert.throws(() =>
      db
        .prepare('INSERT INTO checkpoint_progress(alumni_id,checkpoint) VALUES(?,?)')
        .run('id-1', 0),
    );
    assert.throws(() =>
      db
        .prepare('INSERT INTO checkpoint_progress(alumni_id,checkpoint) VALUES(?,?)')
        .run('id-1', 9),
    );
    assert.throws(() => db.prepare('INSERT INTO responses(alumni_id) VALUES(?)').run('missing-id'));
    db.close();
  } finally {
    if (
      dirname(resolve(folder)) !== resolve(tmpdir()) ||
      !basename(folder).startsWith('xelograph-test-')
    )
      throw new Error('Unsafe temporary cleanup path');
    rmSync(folder, { recursive: true, force: true });
  }
});
