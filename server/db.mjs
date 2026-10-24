import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
export const hash = (s) => createHash('sha256').update(s).digest('hex');
export function openDb(path = process.env.DATABASE_PATH || './data/xelograph.sqlite') {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout=5000;');
  db.exec(readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
  return db;
}
