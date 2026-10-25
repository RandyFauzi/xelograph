import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { hash, openDb, validateDatabasePath } from './db.mjs';
import { backup } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { normalizePhone, validateAvatar, validateAnswer, groupFor, badgesFor } from './domain.mjs';

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
async function readJson(request) {
  if (!request.body) return {};
  const reader = request.body.getReader();
  const chunks = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 16384) {
      await reader.cancel();
      throw new HttpError(413, 'Data terlalu besar.');
    }
    chunks.push(Buffer.from(value));
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new HttpError(400, 'Format data tidak valid.');
  }
}

/** Shared Web Request handler, run directly inside Next.js (no secondary server). */
export function createApiHandler({
  db = openDb(),
  demo = process.env.DEMO_MODE === 'true' ||
    (process.env.NODE_ENV !== 'production' && process.env.DEMO_MODE !== 'false'),
  adminToken = process.env.ADMIN_TOKEN,
  registrationOpen = process.env.PUBLIC_REGISTRATION !== 'false',
  publicOrigins = String(process.env.PUBLIC_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
} = {}) {
  const buckets = new Map();
  const profile = (id) => {
    const u = db.prepare('SELECT * FROM alumni WHERE id=?').get(id);
    if (!u) return null;
    const r = db.prepare('SELECT * FROM responses WHERE alumni_id=?').get(id);
    return {
      id: u.id,
      fullName: u.full_name,
      nickname: u.nickname,
      avatar: JSON.parse(u.avatar_json),
      consentPublic: !!u.consent_public,
      answers: JSON.parse(r?.answers_json || '{}'),
      completedAt: r?.completed_at || null,
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
      if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && origin) {
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
      if (++bucket.count > 1200)
        throw new HttpError(429, 'Terlalu banyak permintaan. Coba satu menit lagi.');
      if (buckets.size > 10000)
        for (const [key, value] of buckets) if (value.until < now) buckets.delete(key);
      if (method === 'GET' && path === '/api/config')
        return json({ demo, registrationOpen, mode: 'persistent', checkpoints: 7 });
      const body = !['GET', 'HEAD', 'OPTIONS'].includes(method) ? await readJson(request) : {};
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
      if (method === 'GET' && path === '/api/world') {
        const rows = db
          .prepare(
            'SELECT a.id,a.nickname,a.avatar_json,r.answers_json FROM alumni a JOIN responses r ON r.alumni_id=a.id WHERE a.consent_public=1 AND r.completed_at IS NOT NULL ORDER BY a.created_at',
          )
          .all();
        return json(
          rows.map((r) => {
            const answers = JSON.parse(r.answers_json);
            return {
              id: r.id,
              nickname: r.nickname,
              avatar: JSON.parse(r.avatar_json),
              group: groupFor(answers),
              badges: badgesFor(answers),
            };
          }),
        );
      }
      if (path === '/api/admin' || path.startsWith('/api/admin/')) {
        const token = String(request.headers.get('authorization') || '').replace(/^Bearer /, '');
        if (
          !adminToken ||
          !token ||
          !timingSafeEqual(Buffer.from(hash(token)), Buffer.from(hash(adminToken)))
        )
          throw new HttpError(403, 'Akses admin memerlukan token yang dikonfigurasi di server.');
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
          const rows = db
            .prepare(
              'SELECT a.id,a.full_name,a.nickname,a.whatsapp,a.consent_public,a.created_at,r.answers_json,r.completed_at FROM alumni a JOIN responses r ON r.alumni_id=a.id ORDER BY a.created_at DESC',
            )
            .all();
          return json(
            rows.map(({ answers_json, ...r }) => ({ ...r, answers: JSON.parse(answers_json) })),
          );
        }
        const deletion = path.match(/^\/api\/admin\/alumni\/([^/]+)$/);
        if (method === 'DELETE' && deletion) {
          transaction(() => {
            db.prepare('DELETE FROM invitations WHERE alumni_id=?').run(deletion[1]);
            db.prepare('DELETE FROM alumni WHERE id=?').run(deletion[1]);
          });
          return json({ ok: true });
        }
      }
      const answerMatch = path.match(/^\/api\/answers\/([^/]+)$/);
      if (['/api/me', '/api/complete', '/api/profile'].includes(path) || answerMatch) {
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
          if (profile(id).progress.length !== 7)
            throw new HttpError(400, 'Selesaikan ketujuh checkpoint terlebih dahulu.');
          db.prepare(
            'UPDATE responses SET completed_at=COALESCE(completed_at,?) WHERE alumni_id=?',
          ).run(new Date().toISOString(), id);
          return json(profile(id));
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
