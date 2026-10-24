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
  return db;
}
