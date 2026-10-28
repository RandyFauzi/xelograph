import { randomBytes, randomUUID, timingSafeEqual, createHmac, createHash } from 'node:crypto';
import QRCode from 'qrcode';
import { hash, openDb, validateDatabasePath } from './db.mjs';
import { backup } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { normalizePhone, validateAvatar, validateAnswer, groupFor, badgesFor } from './domain.mjs';
import { importLegacySurvey, publicLegacyAvatars, adminRespondents } from './legacy-import.mjs';
import { deriveAdminAccessCode } from './admin-access.mjs';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const securityHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
};
const json = (data, status = 200, cookie) =>
  Response.json(data, {
    status,
    headers: { ...securityHeaders, ...(cookie ? { 'Set-Cookie': cookie } : {}) },
  });
const sessionToken = (request) =>
  request.headers
    .get('cookie')
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('xel_session='))
    ?.slice(12);
async function readJson(request, limit = 16384) {
  if (!request.body) return {};
  const reader = request.body.getReader();
  const chunks = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > limit) {
      await reader.cancel();
      throw new HttpError(413, 'Data terlalu besar.');
    }
    chunks.push(Buffer.from(value));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(raw);
    const obj = {};
    for (const [k, v] of params.entries()) obj[k] = v;
    return obj;
  }
  try {
    const body = JSON.parse(raw || '{}');
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    try {
      const params = new URLSearchParams(raw);
      const obj = {};
      for (const [k, v] of params.entries()) obj[k] = v;
      if (Object.keys(obj).length > 0) return obj;
    } catch {}
    throw new HttpError(400, 'Format data tidak valid.');
  }
}

/** Shared Web Request handler, run directly inside Next.js (no secondary server). */
export function createApiHandler({
  db = openDb(),
  demo = process.env.DEMO_MODE === 'true' ||
    (process.env.NODE_ENV !== 'production' && process.env.DEMO_MODE !== 'false'),
  adminToken = process.env.ADMIN_TOKEN,
  adminCodeHash = process.env.ADMIN_ACCESS_CODE_HASH ||
    (adminToken ? hash(deriveAdminAccessCode(adminToken)) : undefined),
  viewerCodeHash = process.env.ADMIN_VIEWER_CODE_HASH ||
    (adminToken ? hash(deriveAdminAccessCode(adminToken, 'viewer')) : undefined),
  registrationOpen = process.env.PUBLIC_REGISTRATION !== 'false',
  publicOrigins = String(process.env.PUBLIC_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
} = {}) {
  const buckets = new Map();
  const loginBuckets = new Map();
  const presence = new Map();
  const chatRateLimit = new Map();
  const PRESENCE_TTL = 45000;
  const MAX_ONLINE_PEERS = 5;
  const prunePresence = (now) => {
    for (const [k, entry] of presence) {
      const ts = typeof entry === 'number' ? entry : entry.lastSeen;
      if (now - ts > PRESENCE_TTL) presence.delete(k);
    }
  };
  const adminTokenFromCookie = (request) =>
    request.headers
      .get('cookie')
      ?.split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith('xylo_admin='))
      ?.slice(11);
  const requireAdmin = (request, ownerOnly = false) => {
    const bearer = String(request.headers.get('authorization') || '').replace(/^Bearer /, '');
    let role;
    if (
      adminToken &&
      bearer &&
      timingSafeEqual(Buffer.from(hash(bearer)), Buffer.from(hash(adminToken)))
    )
      role = 'owner';
    const cookie = adminTokenFromCookie(request);
    if (!role && cookie) {
      const session = db
        .prepare('SELECT credential_hash FROM admin_sessions WHERE token_hash=? AND expires_at>?')
        .get(hash(cookie), Date.now());
      if (adminCodeHash && session?.credential_hash === adminCodeHash) role = 'owner';
      else if (viewerCodeHash && session?.credential_hash === viewerCodeHash) role = 'viewer';
    }
    if (!role) throw new HttpError(403, 'Masuk dengan kode admin untuk melihat hasil survei.');
    if (ownerOnly && role !== 'owner')
      throw new HttpError(403, 'Akses panitia hanya untuk melihat hasil survei.');
    return role;
  };
  const profile = (id) => {
    const u = db.prepare('SELECT * FROM alumni WHERE id=?').get(id);
    if (!u) return null;
    const r = db.prepare('SELECT * FROM responses WHERE alumni_id=?').get(id);
    return {
      id: u.id,
      fullName: u.full_name,
      nickname: u.nickname,
      avatar: validateAvatar(JSON.parse(u.avatar_json)),
      avatarRevision: u.avatar_revision,
      avatarUpdatedAt: u.avatar_updated_at || u.created_at,
      consentPublic: !!u.consent_public,
      answers: JSON.parse(r?.answers_json || '{}'),
      completedAt: r?.completed_at || null,
      surveyOrigin: r?.completion_basis || 'game',
      progress: db
        .prepare('SELECT checkpoint FROM checkpoint_progress WHERE alumni_id=? ORDER BY checkpoint')
        .all(id)
        .map((x) => x.checkpoint),
    };
  };
  const transaction = (fn) => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const value = fn();
      db.exec('COMMIT');
      return value;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
  const makeSession = (id) => {
    const token = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());
    db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(
      hash(token),
      id,
      Date.now() + 30 * 86400000,
    );
    return `xel_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
  };
  return async function handle(request, { ip = 'shared', trustedProxy = false } = {}) {
    try {
      const url = new URL(request.url),
        path = url.pathname,
        method = request.method;
      const origin = request.headers.get('origin');
      const isExternalWebhook = path === '/api/store/topup/webhook' || path === '/api/store/topup/duitku/callback';
      if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && origin && !isExternalWebhook) {
        let sameHost = false;
        try {
          sameHost = new URL(origin).host === (request.headers.get('host') || url.host);
        } catch {}
        const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);
        if (!sameHost && !((trustedProxy || loopback) && publicOrigins.includes(origin)))
          throw new HttpError(403, 'Origin tidak diizinkan.');
      }
      const now = Date.now();
      let bucket = buckets.get(ip);
      if (!bucket || now > bucket.until) {
        bucket = { count: 0, until: now + 60000 };
        buckets.set(ip, bucket);
      }
      if (path !== '/api/presence' && ++bucket.count > 1200)
        throw new HttpError(429, 'Terlalu banyak permintaan. Coba satu menit lagi.');
      if (buckets.size > 10000)
        for (const [key, value] of buckets) if (value.until < now) buckets.delete(key);
      if (method === 'GET' && path === '/api/config')
        return json({ demo, registrationOpen, mode: 'persistent', checkpoints: 7 });
      const importing = method === 'POST' && path === '/api/admin/import';
      if (importing) requireAdmin(request, true);
      const body = !['GET', 'HEAD', 'OPTIONS'].includes(method)
        ? await readJson(request, importing ? 1048576 : 16384)
        : {};
      if (path === '/api/admin/session' && method === 'POST') {
        const time = Date.now();
        let bucket = loginBuckets.get(ip);
        if (!bucket || time > bucket.until) {
          bucket = { count: 0, until: time + 15 * 60000 };
          loginBuckets.set(ip, bucket);
        }
        if (++bucket.count > 5)
          throw new HttpError(429, 'Terlalu banyak percobaan. Coba lagi 15 menit.');
        const code = String(body.code || '')
          .trim()
          .toUpperCase();
        const matches = (candidate) =>
          candidate &&
          /^[a-f0-9]{64}$/i.test(candidate) &&
          code &&
          code.length <= 128 &&
          timingSafeEqual(Buffer.from(hash(code), 'hex'), Buffer.from(candidate, 'hex'));
        const role = matches(adminCodeHash) ? 'owner' : matches(viewerCodeHash) ? 'viewer' : null;
        if (!role) throw new HttpError(403, 'Kode admin tidak cocok.');
        const credentialHash = role === 'owner' ? adminCodeHash : viewerCodeHash;
        loginBuckets.delete(ip);
        db.prepare('DELETE FROM admin_sessions WHERE expires_at<?').run(time);
        const token = randomBytes(32).toString('hex');
        db.prepare(
          'INSERT INTO admin_sessions(token_hash,credential_hash,expires_at) VALUES(?,?,?)',
        ).run(hash(token), credentialHash, time + 8 * 3600000);
        return json(
          { ok: true, role },
          200,
          `xylo_admin=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=28800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
        );
      }
      if (path === '/api/admin/session' && method === 'DELETE') {
        const token = adminTokenFromCookie(request);
        if (token) db.prepare('DELETE FROM admin_sessions WHERE token_hash=?').run(hash(token));
        return json(
          { ok: true },
          200,
          'xylo_admin=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0',
        );
      }
      if (method === 'POST' && path === '/api/join') {
        const { fullName, nickname, whatsapp, avatar, consentPublic, consentData, invitation } =
          body;
        const code = String(invitation || '')
          .trim()
          .toUpperCase();
        const inv = db.prepare('SELECT * FROM invitations WHERE code_hash=?').get(hash(code));
        if (!registrationOpen && !inv && !(demo && code === 'XEL-DEMO'))
          throw new HttpError(
            403,
            'Kode undangan tidak valid. Hubungi panitia untuk mendapatkan kode.',
          );
        if (inv?.alumni_id) return json(profile(inv.alumni_id), 200, makeSession(inv.alumni_id));
        if (!consentData) throw new HttpError(400, 'Persetujuan pengolahan data diperlukan.');
        if (
          typeof fullName !== 'string' ||
          fullName.trim().length < 3 ||
          fullName.length > 100 ||
          typeof nickname !== 'string' ||
          !nickname.trim() ||
          nickname.length > 24
        )
          throw new HttpError(400, 'Lengkapi nama (3–100 karakter) dan panggilan (1–24 karakter).');
        const phone = normalizePhone(whatsapp),
          av = validateAvatar(avatar);
        if (
          db
            .prepare(
              'SELECT id FROM legacy_responses WHERE whatsapp=? AND linked_alumni_id IS NULL',
            )
            .get(phone)
        )
          return json(
            {
              error:
                'Nomor ini sudah mengisi survei sebelumnya. Jawaban sudah dimigrasikan; pilih Jelajahi dulu tanpa mengisi ulang.',
              code: 'legacy_registered',
            },
            409,
          );
        if (db.prepare('SELECT id FROM alumni WHERE whatsapp=?').get(phone))
          throw new HttpError(
            409,
            'Nomor sudah terdaftar. Lanjutkan melalui browser saat membuat karakter, atau hubungi panitia.',
          );
        const id = randomUUID();
        transaction(() => {
          db.prepare(
            'INSERT INTO alumni(id,full_name,nickname,whatsapp,avatar_json,consent_public,consent_at) VALUES(?,?,?,?,?,?,?)',
          ).run(
            id,
            fullName.trim(),
            nickname.trim(),
            phone,
            JSON.stringify(av),
            consentPublic === true ? 1 : 0,
            new Date().toISOString(),
          );
          db.prepare('INSERT INTO responses(alumni_id) VALUES(?)').run(id);
          db.prepare('INSERT OR IGNORE INTO user_wallets(alumni_id, coins_balance) VALUES(?,100)').run(id);
          db.prepare('UPDATE alumni SET avatar_updated_at=created_at WHERE id=?').run(id);
          if (inv)
            db.prepare('UPDATE invitations SET alumni_id=? WHERE code_hash=?').run(id, hash(code));
        });
        return json(profile(id), 201, makeSession(id));
      }
      if (method === 'POST' && path === '/api/resume') {
        const inv = db.prepare('SELECT alumni_id FROM invitations WHERE code_hash=?').get(
          hash(
            String(body.invitation || '')
              .trim()
              .toUpperCase(),
          ),
        );
        if (!inv?.alumni_id) throw new HttpError(403, 'Kode belum terdaftar atau tidak valid.');
        return json(profile(inv.alumni_id), 200, makeSession(inv.alumni_id));
      }
      if (method === 'POST' && path === '/api/logout') {
        const token = sessionToken(request);
        if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));
        return json({ ok: true }, 200, 'xel_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
      }
      if (path === '/api/presence' && (method === 'GET' || method === 'POST')) {
        prunePresence(now);
        const rawKey = String(
          body?.visitorId ||
            url.searchParams.get('vid') ||
            sessionToken(request) ||
            ip + ':' + (request.headers.get('user-agent') || ''),
        ).slice(0, 128);
        const visitorKey = hash('presence:' + rawKey);
        if (method === 'POST' && body?.leave === true) {
          presence.delete(visitorKey);
          return json({ online: presence.size, peers: [] });
        }
        const prev = presence.get(visitorKey);
        let sessionUser = null;
        const tok = sessionToken(request);
        if (tok) {
          try {
            const s = db
              .prepare(
                'SELECT a.id,a.nickname,a.avatar_json FROM sessions s JOIN alumni a ON a.id=s.alumni_id WHERE s.token_hash=? AND s.expires_at>?',
              )
              .get(hash(tok), now);
            if (s) {
              sessionUser = {
                id: s.id,
                nickname: s.nickname,
                avatar: validateAvatar(JSON.parse(s.avatar_json)),
              };
            }
          } catch {}
        }
        let safeAvatar = sessionUser?.avatar ||
          prev?.avatar || {
            character: 'male',
            hair: 'short',
            outfit: 'navy',
            skin: 'warm',
          };
        if (body?.avatar && typeof body.avatar === 'object') {
          try {
            safeAvatar = validateAvatar(body.avatar);
          } catch {}
        }
        const rawNick =
          typeof body?.nickname === 'string' ? body.nickname.trim().slice(0, 24) : '';
        const customNick = rawNick && rawNick !== 'Teman Alumni' ? rawNick : '';
        const safeNickname =
          customNick ||
          sessionUser?.nickname ||
          (prev?.nickname && prev.nickname !== 'Teman Alumni' ? prev.nickname : '') ||
          rawNick ||
          'Teman Alumni';
        const clamp = (val, min, max, fallback) =>
          typeof val === 'number' && Number.isFinite(val)
            ? Math.max(min, Math.min(max, Math.round(val * 1000) / 1000))
            : fallback;
        const safeX = clamp(body?.x, -24, 24, prev?.x ?? 0);
        const safeZ = clamp(body?.z, -20, 34, prev?.z ?? 14);
        const safeVx = clamp(body?.vx, -12, 12, 0);
        const safeVz = clamp(body?.vz, -12, 12, 0);
        const safeMoving = Boolean(body?.moving);
        const safePlaying =
          typeof body?.playing === 'boolean' ? body.playing : (prev?.playing ?? true);
        const safeAlumniId =
          typeof body?.alumniId === 'string' && body.alumniId
            ? body.alumniId.slice(0, 64)
            : (sessionUser?.id ?? prev?.alumniId ?? null);

        if (presence.size < 5000 || presence.has(visitorKey)) {
          presence.set(visitorKey, {
            id: visitorKey.slice(0, 12),
            lastSeen: now,
            nickname: safeNickname,
            avatar: safeAvatar,
            x: safeX,
            z: safeZ,
            vx: safeVx,
            vz: safeVz,
            moving: safeMoving,
            playing: safePlaying,
            alumniId: safeAlumniId,
          });
        }
        const peers = [];
        for (const [k, entry] of presence) {
          if (k === visitorKey || !entry || typeof entry !== 'object') continue;
          peers.push(entry);
        }
        peers.sort((a, b) => {
          if (a.playing !== b.playing) return a.playing ? -1 : 1;
          return b.lastSeen - a.lastSeen;
        });
        const topPeers = peers.slice(0, MAX_ONLINE_PEERS).map((p) => ({
          id: p.id,
          nickname: p.nickname,
          avatar: p.avatar,
          x: p.x,
          z: p.z,
          vx: p.vx || 0,
          vz: p.vz || 0,
          moving: !!p.moving,
          alumniId: p.alumniId,
        }));
        return json({ online: Math.max(1, presence.size), peers: topPeers });
      }
      if (method === 'GET' && path === '/api/chat') {
        const since = Number(url.searchParams.get('since'));
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50));
        let rows;
        if (Number.isFinite(since) && since > 0) {
          rows = db
            .prepare(
              'SELECT id, alumni_id, visitor_id, nickname, text, is_system, created_at, created_ms FROM chat_messages WHERE created_ms > ? ORDER BY created_ms ASC LIMIT ?',
            )
            .all(since, limit);
        } else {
          rows = db
            .prepare(
              'SELECT * FROM (SELECT id, alumni_id, visitor_id, nickname, text, is_system, created_at, created_ms FROM chat_messages ORDER BY created_ms DESC LIMIT ?) ORDER BY created_ms ASC',
            )
            .all(limit);
        }
        return json({
          messages: rows.map((r) => ({
            id: r.id,
            senderId: r.alumni_id || r.visitor_id,
            nickname: r.nickname,
            text: r.text,
            isSystem: !!r.is_system,
            createdAt: r.created_at,
            createdMs: r.created_ms,
          })),
        });
      }
      if (method === 'POST' && path === '/api/chat') {
        const token = sessionToken(request);
        const session =
          token &&
          db
            .prepare(
              'SELECT a.id, a.nickname FROM sessions s JOIN alumni a ON a.id=s.alumni_id WHERE s.token_hash=? AND s.expires_at>?',
            )
            .get(hash(token), now);
        if (!session) {
          throw new HttpError(401, 'Buat karakter terlebih dahulu untuk ikut ngobrol.');
        }
        const lastSent = chatRateLimit.get(session.id) || 0;
        if (now - lastSent < 2000) {
          throw new HttpError(429, 'Tunggu sebentar sebelum mengirim pesan lagi.');
        }
        let rawText = typeof body?.text === 'string' ? body.text.trim() : '';
        rawText = rawText.replace(/<[^>]*>/g, '').replace(/[\r\n\t]+/g, ' ').trim();
        if (!rawText) throw new HttpError(400, 'Pesan tidak boleh kosong.');
        if (rawText.length > 100) rawText = rawText.slice(0, 100);

        const msgId = randomUUID();
        const iso = new Date(now).toISOString();
        transaction(() => {
          db.prepare(
            'INSERT INTO chat_messages(id, alumni_id, visitor_id, nickname, text, is_system, created_at, created_ms) VALUES(?,?,?,?,?,0,?,?)',
          ).run(msgId, session.id, null, session.nickname, rawText, iso, now);
          db.prepare(
            'DELETE FROM chat_messages WHERE id NOT IN (SELECT id FROM chat_messages ORDER BY created_ms DESC LIMIT 100)',
          ).run();
        });
        chatRateLimit.set(session.id, now);
        return json(
          {
            message: {
              id: msgId,
              senderId: session.id,
              nickname: session.nickname,
              text: rawText,
              isSystem: false,
              createdAt: iso,
              createdMs: now,
            },
          },
          201,
        );
      }
      if (path === '/api/store' || path.startsWith('/api/store/')) {
        const token = sessionToken(request);
        const session =
          token &&
          db
            .prepare(
              'SELECT a.id, a.nickname, a.avatar_json, a.avatar_revision FROM sessions s JOIN alumni a ON a.id=s.alumni_id WHERE s.token_hash=? AND s.expires_at>?',
            )
            .get(hash(token), now);

        if (method === 'GET' && path === '/api/store') {
          let coins = 0;
          let inventory = [];
          let equipped = [];
          if (session) {
            let wallet = db
              .prepare('SELECT coins_balance FROM user_wallets WHERE alumni_id=?')
              .get(session.id);
            if (!wallet) {
              db.prepare('INSERT OR IGNORE INTO user_wallets(alumni_id, coins_balance) VALUES(?,100)').run(session.id);
              wallet = { coins_balance: 100 };
            }
            coins = wallet.coins_balance;
            const rows = db
              .prepare('SELECT item_id, is_equipped FROM alumni_inventory WHERE alumni_id=?')
              .all(session.id);
            inventory = rows.map((r) => r.item_id);
            equipped = rows.filter((r) => r.is_equipped).map((r) => r.item_id);
          }
          const items = db
            .prepare(
              'SELECT id, name, category, price_coins, model_url, preview_url, description FROM store_items WHERE is_active=1 ORDER BY price_coins ASC',
            )
            .all();
          return json({ coins, items, inventory, equipped });
        }

        if (method === 'GET' && path === '/api/store/topup/packages') {
          return json({
            packages: [
              { id: 'pack_test', coins: 5, price_idr: 2000 },
              { id: 'pack_100', coins: 100, price_idr: 20000 },
              { id: 'pack_250', coins: 250, price_idr: 50000 },
              { id: 'pack_600', coins: 600, price_idr: 100000 },
            ],
            saweria_username: process.env.SAWERIA_USERNAME || 'randyfauzi24',
            duitku_merchant_code: process.env.DUITKU_MERCHANT_CODE || 'DS37157',
            duitku_active: true,
          });
        }

        const DUITKU_MERCHANT_CODE = process.env.DUITKU_MERCHANT_CODE || 'DS37157';
        const DUITKU_API_KEY = process.env.DUITKU_API_KEY || '201c99689731a38823b0efffabae9dc3';
        const DUITKU_ENV = process.env.DUITKU_ENV || 'sandbox';
        const DUITKU_INQUIRY_URL = DUITKU_ENV === 'production'
          ? 'https://passport.duitku.com/webapi/api/merchant/v2/inquiry'
          : 'https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry';
        const DUITKU_STATUS_URL = DUITKU_ENV === 'production'
          ? 'https://passport.duitku.com/webapi/api/merchant/transactionStatus'
          : 'https://sandbox.duitku.com/webapi/api/merchant/transactionStatus';

        if (method === 'POST' && path === '/api/store/topup/duitku/create') {
          const token = sessionToken(request);
          if (!token) throw new HttpError(401, 'Silakan login terlebih dahulu untuk top up.');
          const alumni = db
            .prepare(
              'SELECT a.id, a.nickname, a.whatsapp FROM sessions s JOIN alumni a ON a.id = s.alumni_id WHERE s.token_hash = ? AND s.expires_at > ?',
            )
            .get(hash(token), Date.now());
          if (!alumni) throw new HttpError(401, 'Sesi tidak valid.');

          const packages = [
            { id: 'pack_test', coins: 5, price_idr: 2000 },
            { id: 'pack_100', coins: 100, price_idr: 20000 },
            { id: 'pack_250', coins: 250, price_idr: 50000 },
            { id: 'pack_600', coins: 600, price_idr: 100000 },
          ];

          const packageId = String(body?.packageId || 'pack_test');
          const selected = packages.find((p) => p.id === packageId) || packages[0];

          const merchantOrderId = 'XELO_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7).toUpperCase();
          const signature = createHash('md5')
            .update(DUITKU_MERCHANT_CODE + merchantOrderId + selected.price_idr + DUITKU_API_KEY)
            .digest('hex');

          const inquiryPayload = {
            merchantCode: DUITKU_MERCHANT_CODE,
            paymentAmount: selected.price_idr,
            paymentMethod: 'NQ', // Nobu Universal QRIS
            merchantOrderId,
            productDetails: `Top Up ${selected.coins} Koin Xelograph`,
            email: 'alumni@xelograph.appku.site',
            phoneNumber: alumni.whatsapp || '08123456789',
            callbackUrl: 'https://xelograph.appku.site/api/store/topup/duitku/callback',
            returnUrl: 'https://xelograph.appku.site',
            expiryPeriod: 15,
            signature,
          };

          const duitkuRes = await fetch(DUITKU_INQUIRY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(inquiryPayload),
          });

          if (!duitkuRes.ok) {
            const errTxt = await duitkuRes.text();
            throw new HttpError(502, 'Gagal menghubungi server Duitku: ' + errTxt);
          }

          const duitkuData = await duitkuRes.json();
          if (duitkuData.statusCode !== '00') {
            throw new HttpError(400, duitkuData.statusMessage || 'Gagal membuat QRIS.');
          }

          const qrDataUrl = await QRCode.toDataURL(duitkuData.qrString, {
            margin: 1,
            width: 320,
            color: { dark: '#000000', light: '#ffffff' },
          });

          db.prepare(
            'INSERT INTO topup_transactions(id, alumni_id, saweria_trx_id, package_id, amount_idr, coins_awarded, donator_name, raw_message, status) VALUES(?,?,?,?,?,?,?,?,?)',
          ).run(
            merchantOrderId,
            alumni.id,
            duitkuData.reference || merchantOrderId,
            selected.id,
            selected.price_idr,
            selected.coins,
            alumni.nickname,
            'Duitku QRIS',
            'pending',
          );

          return json({
            ok: true,
            orderId: merchantOrderId,
            reference: duitkuData.reference,
            qrString: duitkuData.qrString,
            qrDataUrl,
            paymentUrl: duitkuData.paymentUrl,
            amount: selected.price_idr,
            coins: selected.coins,
            expiryMinutes: 15,
          });
        }

        if (method === 'GET' && path === '/api/store/topup/duitku/status') {
          const orderId = String(url.searchParams.get('orderId') || '').trim();
          if (!orderId) throw new HttpError(400, 'Parameter orderId diperlukan.');

          const trx = db
            .prepare(
              'SELECT id, alumni_id, package_id, amount_idr, coins_awarded, status FROM topup_transactions WHERE id=?',
            )
            .get(orderId);
          if (!trx) throw new HttpError(404, 'Transaksi tidak ditemukan.');

          if (trx.status === 'completed') {
            const wallet = db.prepare('SELECT coins_balance FROM user_wallets WHERE alumni_id=?').get(trx.alumni_id);
            return json({
              ok: true,
              status: 'completed',
              coins_awarded: trx.coins_awarded,
              balance: wallet?.coins_balance || 0,
            });
          }

          // Check with Duitku transactionStatus API for instant confirmation
          const signature = createHash('md5')
            .update(DUITKU_MERCHANT_CODE + orderId + DUITKU_API_KEY)
            .digest('hex');

          try {
            const checkRes = await fetch(DUITKU_STATUS_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                merchantCode: DUITKU_MERCHANT_CODE,
                merchantOrderId: orderId,
                signature,
              }),
            });

            if (checkRes.ok) {
              const checkData = await checkRes.json();
              if (checkData.statusCode === '00') {
                // Payment SUCCESS!
                let currentBalance = 0;
                transaction(() => {
                  db.prepare(
                    "UPDATE topup_transactions SET status='completed' WHERE id=? AND status='pending'",
                  ).run(orderId);
                  db.prepare(
                    'INSERT INTO user_wallets(alumni_id, coins_balance) VALUES(?,?) ON CONFLICT(alumni_id) DO UPDATE SET coins_balance=coins_balance+?, updated_at=CURRENT_TIMESTAMP',
                  ).run(trx.alumni_id, trx.coins_awarded, trx.coins_awarded);

                  const alumni = db.prepare('SELECT nickname FROM alumni WHERE id=?').get(trx.alumni_id);
                  const updatedWallet = db
                    .prepare('SELECT coins_balance FROM user_wallets WHERE alumni_id=?')
                    .get(trx.alumni_id);
                  currentBalance = updatedWallet?.coins_balance || 0;

                  const chatMsgId = 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
                  db.prepare(
                    'INSERT INTO chat_messages(id, alumni_id, visitor_id, nickname, text, is_system, created_ms) VALUES(?,?,?,?,?,1,?)',
                  ).run(
                    chatMsgId,
                    trx.alumni_id,
                    'system',
                    'Sistem Toko',
                    `🎉 ${alumni?.nickname || 'Alumni'} baru saja isi ulang ${trx.coins_awarded} Koin via QRIS Dinamis!`,
                    Date.now(),
                  );
                });

                return json({
                  ok: true,
                  status: 'completed',
                  coins_awarded: trx.coins_awarded,
                  balance: currentBalance,
                });
              } else if (checkData.statusCode === '02') {
                return json({ ok: true, status: 'failed' });
              }
            }
          } catch (e) {
            console.error('Error polling Duitku transactionStatus:', e);
          }

          return json({ ok: true, status: 'pending' });
        }

        if (method === 'POST' && path === '/api/store/topup/duitku/callback') {
          const merchantCode = String(body?.merchantCode || '');
          const amount = String(body?.amount || '');
          const merchantOrderId = String(body?.merchantOrderId || '');
          const signature = String(body?.signature || '');
          const resultCode = String(body?.resultCode || '');
          const reference = String(body?.reference || '');

          if (!merchantCode || !amount || !merchantOrderId || !signature) {
            throw new HttpError(400, 'Parameter callback tidak lengkap.');
          }

          const expectedSig = createHash('md5')
            .update(merchantCode + amount + merchantOrderId + DUITKU_API_KEY)
            .digest('hex');

          if (signature.toLowerCase() !== expectedSig.toLowerCase()) {
            throw new HttpError(403, 'Signature Duitku tidak valid.');
          }

          if (resultCode === '00') {
            const trx = db
              .prepare(
                'SELECT id, alumni_id, coins_awarded, status FROM topup_transactions WHERE id=?',
              )
              .get(merchantOrderId);

            if (trx && trx.status === 'pending') {
              transaction(() => {
                db.prepare(
                  "UPDATE topup_transactions SET status='completed', saweria_trx_id=? WHERE id=?",
                ).run(reference || trx.id, trx.id);
                db.prepare(
                  'INSERT INTO user_wallets(alumni_id, coins_balance) VALUES(?,?) ON CONFLICT(alumni_id) DO UPDATE SET coins_balance=coins_balance+?, updated_at=CURRENT_TIMESTAMP',
                ).run(trx.alumni_id, trx.coins_awarded, trx.coins_awarded);

                const alumni = db.prepare('SELECT nickname FROM alumni WHERE id=?').get(trx.alumni_id);
                const chatMsgId = 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
                db.prepare(
                  'INSERT INTO chat_messages(id, alumni_id, visitor_id, nickname, text, is_system, created_ms) VALUES(?,?,?,?,?,1,?)',
                ).run(
                  chatMsgId,
                  trx.alumni_id,
                  'system',
                  'Sistem Toko',
                  `🎉 ${alumni?.nickname || 'Alumni'} baru saja isi ulang ${trx.coins_awarded} Koin via QRIS Dinamis!`,
                  Date.now(),
                );
              });
            }
          }

          return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }

        if (method === 'POST' && path === '/api/store/topup/webhook') {
          // Signature verification (if secret configured)
          const secret = process.env.SAWERIA_WEBHOOK_SECRET;
          const sig = request.headers.get('saweria-callback-signature') || request.headers.get('x-saweria-signature');
          if (secret && sig) {
            const expected = createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
            if (sig !== expected) {
              throw new HttpError(403, 'Invalid signature.');
            }
          }

          const saweriaTrxId = String(body?.id || '').trim();
          if (!saweriaTrxId) throw new HttpError(400, 'ID transaksi Saweria diperlukan.');

          const amountRaw = Number(body?.amount_raw) || 0;
          if (amountRaw <= 0) throw new HttpError(400, 'Nominal tidak valid.');

          // Idempotency: prevent double crediting
          const existing = db
            .prepare('SELECT id, coins_awarded, alumni_id FROM topup_transactions WHERE saweria_trx_id=?')
            .get(saweriaTrxId);
          if (existing) {
            return json({ ok: true, duplicate: true, coins: existing.coins_awarded });
          }

          const msg = String(body?.message || '').trim();
          let targetAlumni = null;
          const idMatch = msg.match(/TOPUP[#:\s\-_]*([a-zA-Z0-9_\-]+)/i) || msg.match(/^([a-zA-Z0-9_\-]+)$/);
          if (idMatch) {
            const rawId = idMatch[1].trim();
            targetAlumni = db.prepare('SELECT id, nickname FROM alumni WHERE id=? OR LOWER(nickname)=LOWER(?)').get(rawId, rawId);
          }

          if (!targetAlumni) {
            const donator = String(body?.donator_name || '').trim();
            if (donator) {
              targetAlumni = db.prepare('SELECT id, nickname FROM alumni WHERE LOWER(nickname)=LOWER(?)').get(donator);
            }
          }

          if (!targetAlumni) {
            throw new HttpError(404, 'Alumni penerima koin tidak ditemukan dari pesan: ' + msg);
          }

          // Exact user-specified rates:
          // 100 Koin = 20.000, 250 Koin = 50.000, 600 Koin = 100.000
          let coinsAwarded = 0;
          let packageId = 'custom';
          if (amountRaw >= 100000) {
            coinsAwarded = Math.floor(amountRaw / 100000) * 600;
            packageId = 'pack_600';
          } else if (amountRaw >= 50000) {
            coinsAwarded = 250;
            packageId = 'pack_250';
          } else if (amountRaw >= 20000) {
            coinsAwarded = 100;
            packageId = 'pack_100';
          } else if (amountRaw >= 2000) {
            coinsAwarded = 5;
            packageId = 'pack_test';
          } else {
            coinsAwarded = Math.max(1, Math.floor(amountRaw / 400));
          }

          const orderId = 'topup_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

          transaction(() => {
            db.prepare(
              'INSERT INTO topup_transactions(id, alumni_id, saweria_trx_id, package_id, amount_idr, coins_awarded, donator_name, donator_email, raw_message, status) VALUES(?,?,?,?,?,?,?,?,?,?)'
            ).run(
              orderId,
              targetAlumni.id,
              saweriaTrxId,
              packageId,
              amountRaw,
              coinsAwarded,
              String(body?.donator_name || ''),
              String(body?.donator_email || ''),
              msg,
              'completed'
            );

            db.prepare(
              'INSERT INTO user_wallets(alumni_id, coins_balance) VALUES(?,?) ON CONFLICT(alumni_id) DO UPDATE SET coins_balance=coins_balance+?, updated_at=CURRENT_TIMESTAMP'
            ).run(targetAlumni.id, coinsAwarded, coinsAwarded);

            const chatMsgId = 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
            db.prepare(
              'INSERT INTO chat_messages(id, alumni_id, visitor_id, nickname, text, is_system, created_ms) VALUES(?,?,?,?,?,1,?)'
            ).run(
              chatMsgId,
              targetAlumni.id,
              'system',
              'Sistem Toko',
              `🎉 ${targetAlumni.nickname} baru saja isi ulang ${coinsAwarded} Koin di Toko Avatar!`,
              Date.now()
            );
          });

          return json({ ok: true, coins: coinsAwarded, alumni_id: targetAlumni.id });
        }

        if (!session) {
          throw new HttpError(401, 'Buat karakter terlebih dahulu untuk mengakses toko.');
        }

        if (method === 'POST' && path === '/api/store/buy') {
          const itemId = String(body?.itemId || '').trim();
          const item = db
            .prepare('SELECT id, name, category, price_coins FROM store_items WHERE id=? AND is_active=1')
            .get(itemId);
          if (!item) throw new HttpError(404, 'Item tidak ditemukan.');

          const owned = db
            .prepare('SELECT item_id FROM alumni_inventory WHERE alumni_id=? AND item_id=?')
            .get(session.id, itemId);
          if (owned) throw new HttpError(400, 'Kamu sudah memiliki item ini.');

          let wallet = db
            .prepare('SELECT coins_balance FROM user_wallets WHERE alumni_id=?')
            .get(session.id);
          if (!wallet) {
            db.prepare('INSERT OR IGNORE INTO user_wallets(alumni_id, coins_balance) VALUES(?,100)').run(session.id);
            wallet = { coins_balance: 100 };
          }
          if (wallet.coins_balance < item.price_coins) {
            throw new HttpError(400, 'Koin tidak cukup untuk membeli item ini.');
          }

          let newBalance = wallet.coins_balance;
          transaction(() => {
            db.prepare(
              'UPDATE user_wallets SET coins_balance=coins_balance-?, updated_at=? WHERE alumni_id=?',
            ).run(item.price_coins, new Date(now).toISOString(), session.id);
            db.prepare(
              'INSERT INTO alumni_inventory(alumni_id, item_id, is_equipped, acquired_at) VALUES(?,?,0,?)',
            ).run(session.id, itemId, new Date(now).toISOString());
            newBalance -= item.price_coins;
          });

          return json({ ok: true, coins: newBalance, itemId });
        }

        if (method === 'POST' && path === '/api/store/equip') {
          const itemId = String(body?.itemId || '').trim();
          const slot = body?.slot;
          const action = body?.action;
          if (!['headwear', 'eyewear', 'outfit'].includes(slot)) {
            throw new HttpError(400, 'Slot aksesoris tidak valid.');
          }

          const curAvatar = validateAvatar(JSON.parse(session.avatar_json));

          transaction(() => {
            if (action === 'equip') {
              const item = db
                .prepare('SELECT id, category FROM store_items WHERE id=? AND is_active=1')
                .get(itemId);
              if (!item || item.category !== slot) {
                throw new HttpError(400, 'Item tidak sesuai dengan slot.');
              }
              const owned = db
                .prepare('SELECT item_id FROM alumni_inventory WHERE alumni_id=? AND item_id=?')
                .get(session.id, itemId);
              if (!owned) throw new HttpError(403, 'Kamu belum memiliki item ini.');

              db.prepare(
                'UPDATE alumni_inventory SET is_equipped=0 WHERE alumni_id=? AND item_id IN (SELECT id FROM store_items WHERE category=?)',
              ).run(session.id, slot);
              db.prepare(
                'UPDATE alumni_inventory SET is_equipped=1 WHERE alumni_id=? AND item_id=?',
              ).run(session.id, itemId);

              curAvatar[slot] = itemId;
            } else {
              db.prepare(
                'UPDATE alumni_inventory SET is_equipped=0 WHERE alumni_id=? AND item_id IN (SELECT id FROM store_items WHERE category=?)',
              ).run(session.id, slot);
              if (slot === 'outfit') {
                curAvatar.outfit = 'navy';
              } else {
                curAvatar[slot] = null;
              }
            }

            db.prepare(
              'UPDATE alumni SET avatar_json=?, avatar_revision=avatar_revision+1, avatar_updated_at=? WHERE id=?',
            ).run(JSON.stringify(curAvatar), new Date(now).toISOString(), session.id);
          });

          return json(profile(session.id));
        }
      }
      if (method === 'GET' && path === '/api/world') {
        const rows = db
          .prepare(
            'SELECT a.id,a.nickname,a.avatar_json,r.answers_json FROM alumni a JOIN responses r ON r.alumni_id=a.id WHERE a.consent_public=1 AND r.completed_at IS NOT NULL ORDER BY a.created_at',
          )
          .all();
        return json([
          ...rows.map((r) => {
            const answers = JSON.parse(r.answers_json);
            return {
              id: r.id,
              nickname: r.nickname,
              avatar: validateAvatar(JSON.parse(r.avatar_json)),
              group: groupFor(answers),
              badges: badgesFor(answers),
            };
          }),
          ...publicLegacyAvatars(db),
        ]);
      }
      if (path === '/api/admin' || path.startsWith('/api/admin/')) {
        const role = requireAdmin(request);
        if (method === 'GET' && path === '/api/admin/session') return json({ role });
        if (role === 'viewer' && !(method === 'GET' && path === '/api/admin'))
          throw new HttpError(403, 'Akses panitia hanya untuk melihat hasil survei.');
        if (method === 'POST' && path === '/api/admin/import')
          return json(
            importLegacySurvey(db, body.payload, {
              dryRun: body.dryRun === true,
              publishAvatars: body.publishAvatars === true,
            }),
          );
        if (method === 'GET' && path === '/api/admin/storage') {
          const location = db.location('main');
          let persistent = false;
          try {
            validateDatabasePath(location || ':memory:', { persistentRequired: true });
            persistent = true;
          } catch {}
          return json({
            engine: 'sqlite',
            location,
            persistent,
            integrity: db.prepare('PRAGMA quick_check').get().quick_check,
            profiles: db.prepare('SELECT count(*) AS n FROM alumni').get().n,
          });
        }
        if (method === 'POST' && path === '/api/admin/backup') {
          const location = db.location('main');
          if (!location) throw new HttpError(400, 'Database tidak berada di disk.');
          const directory = join(dirname(location), 'backups');
          mkdirSync(directory, { recursive: true, mode: 0o700 });
          const filename = join(
            directory,
            `xelograph-${Date.now()}-${randomBytes(4).toString('hex')}.sqlite`,
          );
          await backup(db, filename);
          if (process.platform !== 'win32') chmodSync(filename, 0o600);
          return json({ ok: true, filename });
        }
        if (method === 'GET' && path === '/api/admin') {
          return json(adminRespondents(db));
        }
        const visibility = path.match(/^\/api\/admin\/alumni\/([^/]+)\/visibility$/);
        if (method === 'PATCH' && visibility) {
          const rawId = decodeURIComponent(visibility[1]);
          const enabled = body.enabled ?? body.consentPublic;
          if (typeof enabled !== 'boolean')
            throw new HttpError(400, 'Status visibilitas tidak valid.');
          const val = enabled ? 1 : 0;
          transaction(() => {
            if (rawId.startsWith('legacy:')) {
              const legacyId = rawId.replace(/^legacy:/, '');
              db.prepare('UPDATE legacy_responses SET published_by_admin=? WHERE id=?').run(
                val,
                legacyId,
              );
            } else {
              db.prepare('UPDATE alumni SET consent_public=? WHERE id=?').run(val, rawId);
            }
          });
          return json({ ok: true, id: rawId, consent_public: Boolean(val) });
        }
        const deletion = path.match(/^\/api\/admin\/alumni\/([^/]+)$/);
        if (method === 'DELETE' && deletion) {
          const rawId = decodeURIComponent(deletion[1]);
          transaction(() => {
            if (rawId.startsWith('legacy:')) {
              const legacyId = rawId.replace(/^legacy:/, '');
              db.prepare('DELETE FROM legacy_responses WHERE id=?').run(legacyId);
            } else {
              db.prepare('DELETE FROM legacy_responses WHERE linked_alumni_id=?').run(rawId);
              db.prepare('DELETE FROM checkpoint_progress WHERE alumni_id=?').run(rawId);
              db.prepare('DELETE FROM responses WHERE alumni_id=?').run(rawId);
              db.prepare('DELETE FROM sessions WHERE alumni_id=?').run(rawId);
              db.prepare('DELETE FROM invitations WHERE alumni_id=?').run(rawId);
              db.prepare('DELETE FROM alumni WHERE id=?').run(rawId);
            }
          });
          return json({ ok: true, id: rawId });
        }
      }
      const answerMatch = path.match(/^\/api\/answers\/([^/]+)$/);
      if (
        ['/api/me', '/api/complete', '/api/profile', '/api/avatar'].includes(path) ||
        answerMatch
      ) {
        const token = sessionToken(request);
        const session =
          token &&
          db
            .prepare('SELECT alumni_id FROM sessions WHERE token_hash=? AND expires_at>?')
            .get(hash(token), Date.now());
        if (!session)
          throw new HttpError(
            401,
            'Sesi belum tersedia. Gunakan browser tempat membuat karakter atau hubungi panitia.',
          );
        const id = session.alumni_id;
        if (method === 'GET' && path === '/api/me') return json(profile(id));
        if (method === 'GET' && path === '/api/avatar') {
          const current = profile(id);
          return json({
            avatar: current.avatar,
            revision: current.avatarRevision,
            updatedAt: current.avatarUpdatedAt,
          });
        }
        if (method === 'PATCH' && path === '/api/avatar') {
          const avatar = validateAvatar(body.avatar);
          if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 1)
            throw new HttpError(400, 'Versi karakter tidak valid. Muat ulang pengaturan.');
          const updated = db
            .prepare(
              'UPDATE alumni SET avatar_json=?, avatar_revision=avatar_revision+1, avatar_updated_at=? WHERE id=? AND avatar_revision=?',
            )
            .run(JSON.stringify(avatar), new Date().toISOString(), id, body.expectedRevision);
          if (updated.changes !== 1)
            throw new HttpError(
              409,
              'Karakter sudah berubah di sesi lain. Tutup lalu buka kembali pengaturan untuk memuat versi terbaru.',
            );
          return json(profile(id));
        }
        if (method === 'PUT' && answerMatch) {
          const index = Number(answerMatch[1]),
            answer = validateAnswer(index, body),
            old = profile(id);
          const next = Array.from({ length: 7 }, (_, i) => i).find(
            (i) => !old.progress.includes(i),
          );
          if (next !== undefined && index > next)
            throw new HttpError(400, 'Selesaikan misi sebelumnya untuk membuka area ini.');
          transaction(() => {
            db.prepare('UPDATE responses SET answers_json=?, updated_at=? WHERE alumni_id=?').run(
              JSON.stringify({ ...old.answers, ...answer }),
              new Date().toISOString(),
              id,
            );
            db.prepare(
              'INSERT OR IGNORE INTO checkpoint_progress(alumni_id,checkpoint) VALUES(?,?)',
            ).run(id, index);
          });
          return json(profile(id));
        }
        if (method === 'POST' && path === '/api/complete') {
          const cur = profile(id);
          if (cur.progress.length !== 7)
            throw new HttpError(400, 'Selesaikan ketujuh checkpoint terlebih dahulu.');
          let rewardCoins = 0;
          transaction(() => {
            // The durable completion transition is the claim: retries cannot mint more coins.
            const completed = db
              .prepare(
                'UPDATE responses SET completed_at=? WHERE alumni_id=? AND completed_at IS NULL',
              )
              .run(new Date().toISOString(), id);
            if (!completed.changes) return;
            db.prepare(
              'INSERT INTO user_wallets(alumni_id, coins_balance) VALUES(?,150) ON CONFLICT(alumni_id) DO UPDATE SET coins_balance=coins_balance+50, updated_at=CURRENT_TIMESTAMP',
            ).run(id);
            rewardCoins = 50;
            const sysId = randomUUID();
            const iso = new Date().toISOString();
            const broadcastText = `🎉 ${cur.nickname} baru saja menyelesaikan survei reuni dan mendapatkan Reunion Pass serta 50 Koin!`;
            db.prepare(
              'INSERT INTO chat_messages(id, alumni_id, visitor_id, nickname, text, is_system, created_at, created_ms) VALUES(?,?,?,?,?,1,?,?)',
            ).run(sysId, id, null, 'Sistem', broadcastText, iso, Date.now());
            db.prepare(
              'DELETE FROM chat_messages WHERE id NOT IN (SELECT id FROM chat_messages ORDER BY created_ms DESC LIMIT 100)',
            ).run();
          });
          return json({ ...profile(id), rewardCoins });
        }
        if (method === 'PATCH' && path === '/api/profile') {
          if (typeof body.consentPublic !== 'boolean')
            throw new HttpError(400, 'Persetujuan tidak valid.');
          db.prepare('UPDATE alumni SET consent_public=? WHERE id=?').run(
            body.consentPublic ? 1 : 0,
            id,
          );
          return json(profile(id));
        }
      }
      return json({ error: 'Endpoint tidak ditemukan.' }, 404);
    } catch (error) {
      const storageError = /SQLITE_|database is|disk I\/O|no such table/i.test(error.message);
      if (storageError) console.error('Database request failed:', error.message);
      return json(
        {
          error: storageError
            ? 'Penyimpanan sedang tidak tersedia. Coba lagi nanti.'
            : error.message?.includes('UNIQUE constraint')
              ? 'Data sudah terdaftar.'
              : error.message || 'Permintaan gagal.',
        },
        error.status || (storageError ? 503 : 400),
      );
    }
  };
}

const singleton = Symbol.for('xelograph.api');
export async function handleApiRequest(request) {
  try {
    globalThis[singleton] ||= createApiHandler();
    return await globalThis[singleton](request, { trustedProxy: true });
  } catch (error) {
    console.error('API initialization failed:', error.message);
    return json({ error: 'Penyimpanan belum siap. Hubungi panitia atau coba lagi nanti.' }, 503);
  }
}
