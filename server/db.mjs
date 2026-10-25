import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, chmodSync, realpathSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
export const hash = (s) => createHash('sha256').update(s).digest('hex');
export function validateDatabasePath(
  path,
  {
    persistentRequired = process.env.PERSISTENT_DATABASE_REQUIRED === 'true',
    cwd = process.cwd(),
  } = {},
) {
  if (!persistentRequired) return path;
  if (!isAbsolute(path))
    throw new Error(
      'Persistent database requires an absolute DATABASE_PATH outside the deployment.',
    );
  const target = resolve(/* turbopackIgnore: true */ path);
  let ancestor = target;
  while (!existsSync(ancestor) && dirname(ancestor) !== ancestor) ancestor = dirname(ancestor);
  const physical = resolve(realpathSync(ancestor), relative(ancestor, target));
  const rel = relative(cwd, physical);
  if (
    (!rel.startsWith('..') && !isAbsolute(rel)) ||
    /\/(public_html|hbuilds|\.next|public|dist)(\/|$)/i.test(physical.replaceAll('\\', '/'))
  )
    throw new Error('DATABASE_PATH must be outside public and deployment folders.');
  return target;
}
export function openDb(path = process.env.DATABASE_PATH || './data/xelograph.sqlite') {
  path = validateDatabasePath(path);
  if (path !== ':memory:')
    mkdirSync(dirname(resolve(/* turbopackIgnore: true */ path)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ':memory:' && process.platform !== 'win32') chmodSync(path, 0o600);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL;');
  db.exec(readFileSync(resolve(process.cwd(), 'database/schema.sql'), 'utf8'));
  // Additive, transactional migration: keep each existing avatar JSON and all survey data.
  db.exec('BEGIN IMMEDIATE');
  try {
    const columns = db
      .prepare('PRAGMA table_info(alumni)')
      .all()
      .map((column) => column.name);
    if (!columns.includes('avatar_revision'))
      db.exec(
        'ALTER TABLE alumni ADD COLUMN avatar_revision INTEGER NOT NULL DEFAULT 1 CHECK(avatar_revision > 0)',
      );
    if (!columns.includes('avatar_updated_at'))
      db.exec('ALTER TABLE alumni ADD COLUMN avatar_updated_at TEXT');
    const responseColumns = db
      .prepare('PRAGMA table_info(responses)')
      .all()
      .map((column) => column.name);
    if (!responseColumns.includes('completion_basis'))
      db.exec("ALTER TABLE responses ADD COLUMN completion_basis TEXT NOT NULL DEFAULT 'game'");
    const adminColumns = db
      .prepare('PRAGMA table_info(admin_sessions)')
      .all()
      .map((column) => column.name);
    if (!adminColumns.includes('credential_hash'))
      db.exec("ALTER TABLE admin_sessions ADD COLUMN credential_hash TEXT NOT NULL DEFAULT ''");
    db.exec('UPDATE alumni SET avatar_updated_at=created_at WHERE avatar_updated_at IS NULL');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    db.close();
    throw error;
  }
  return db;
}
