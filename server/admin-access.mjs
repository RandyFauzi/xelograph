import { createHmac } from 'node:crypto';
/** Stable private admin code derived from the existing random server credential. Never sent to clients. */
export function deriveAdminAccessCode(secret) {
  if (!secret) throw new Error('Admin credential unavailable');
  const text = createHmac('sha256', secret)
    .update('xylograph/admin/access/v1')
    .digest('hex')
    .slice(0, 16)
    .toUpperCase();
  return 'XYLO-' + text.match(/.{4}/g).join('-');
}
