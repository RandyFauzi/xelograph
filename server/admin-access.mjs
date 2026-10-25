import { createHmac } from 'node:crypto';
/** Private eight-digit codes; role is resolved on the server, never supplied by clients. */
export function deriveAdminAccessCode(secret, role = 'owner') {
  if (!secret) throw new Error('Admin credential unavailable');
  if (!['owner', 'viewer'].includes(role)) throw new Error('Invalid admin role');
  const digest = createHmac('sha256', secret)
    .update('xylograph/admin/access/v2/' + role)
    .digest();
  return String(10000000 + Number(digest.readBigUInt64BE() % 90000000n));
}
