import { randomBytes } from 'node:crypto';
import { openDb, hash } from '../server/db.mjs';
const label = process.argv[2];
if (!label) {
  console.error('Usage: npm run db:invite -- "Nama alumni"');
  process.exit(1);
}
const code = 'XEL-' + randomBytes(12).toString('hex').toUpperCase();
const db = openDb();
db.prepare('INSERT INTO invitations(code_hash,label) VALUES(?,?)').run(hash(code), label);
db.close();
console.log('Simpan dan bagikan secara pribadi kepada ' + label + ': ' + code);
