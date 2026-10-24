import express from 'express';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, hash } from './db.mjs';
import { normalizePhone, validateAvatar, validateAnswer, groupFor, badgesFor } from './domain.mjs';

export function createApp({
  db = openDb(),
  demo = process.env.DEMO_MODE === 'true' ||
    (process.env.NODE_ENV !== 'production' && process.env.DEMO_MODE !== 'false'),
  adminToken = process.env.ADMIN_TOKEN,
  publicOrigins = String(process.env.PUBLIC_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'X-Frame-Options': 'DENY',
    });
    if (req.path.startsWith('/api')) res.set('Cache-Control', 'no-store');
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.headers.origin &&
      new URL(req.headers.origin).host !== req.headers.host &&
      !(
        ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip) &&
        publicOrigins.includes(req.headers.origin)
      )
    )
      return res.status(403).json({ error: 'Origin tidak diizinkan.' });
    next();
  });
  const buckets = new Map();
  app.use('/api', (req, res, next) => {
    const key = req.ip,
      now = Date.now();
    let b = buckets.get(key);
    if (!b || now > b.until) {
      b = { count: 0, until: now + 60000 };
      buckets.set(key, b);
    }
    if (++b.count > 1200)
      return res.status(429).json({ error: 'Terlalu banyak permintaan. Coba satu menit lagi.' });
    if (buckets.size > 10000) for (const [k, v] of buckets) if (v.until < now) buckets.delete(k);
    next();
  });
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
  const auth = (req, res, next) => {
    const token = req.headers.cookie
      ?.split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith('xel_session='))
      ?.slice(12);
    const s =
      token &&
      db
        .prepare('SELECT alumni_id FROM sessions WHERE token_hash=? AND expires_at>?')
        .get(hash(token), Date.now());
    if (!s)
      return res
        .status(401)
        .json({ error: 'Sesi berakhir. Masuk kembali dengan kode undanganmu.' });
    req.alumniId = s.alumni_id;
    next();
  };
  function makeSession(res, id) {
    const token = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());
    db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(
      hash(token),
      id,
      Date.now() + 30 * 86400000,
    );
    res.cookie('xel_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 86400000,
      path: '/',
    });
  }
  app.get('/api/config', (_q, res) => res.json({ demo, mode: 'persistent', checkpoints: 7 }));
  app.get('/api/me', auth, (req, res) => res.json(profile(req.alumniId)));
  app.post('/api/join', (req, res) => {
    const { fullName, nickname, whatsapp, avatar, consentPublic, consentData, invitation } =
      req.body;
    const code = String(invitation || '')
      .trim()
      .toUpperCase();
    const inv = db.prepare('SELECT * FROM invitations WHERE code_hash=?').get(hash(code));
    if (!inv && !(demo && code === 'XEL-DEMO'))
      return res
        .status(403)
        .json({ error: 'Kode undangan tidak valid. Hubungi panitia untuk mendapatkan kode.' });
    if (inv?.alumni_id) {
      makeSession(res, inv.alumni_id);
      return res.json(profile(inv.alumni_id));
    }
    if (!consentData) throw new Error('Persetujuan pengolahan data diperlukan.');
    if (
      typeof fullName !== 'string' ||
      fullName.trim().length < 3 ||
      fullName.length > 100 ||
      typeof nickname !== 'string' ||
      !nickname.trim() ||
      nickname.length > 24
    )
      throw new Error('Lengkapi nama (3–100 karakter) dan panggilan (1–24 karakter).');
    const phone = normalizePhone(whatsapp),
      av = validateAvatar(avatar);
    if (db.prepare('SELECT id FROM alumni WHERE whatsapp=?').get(phone))
      return res.status(409).json({
        error:
          'Nomor sudah terdaftar. Gunakan kode undangan asli untuk melanjutkan; hubungi panitia jika hilang.',
      });
    const id = randomUUID();
    db.exec('BEGIN IMMEDIATE');
    try {
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
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    makeSession(res, id);
    res.status(201).json(profile(id));
  });
  app.post('/api/resume', (req, res) => {
    const inv = db.prepare('SELECT alumni_id FROM invitations WHERE code_hash=?').get(
      hash(
        String(req.body.invitation || '')
          .trim()
          .toUpperCase(),
      ),
    );
    if (!inv?.alumni_id)
      return res.status(403).json({ error: 'Kode belum terdaftar atau tidak valid.' });
    makeSession(res, inv.alumni_id);
    res.json(profile(inv.alumni_id));
  });
  app.post('/api/logout', (_q, res) => {
    const token = _q.headers.cookie
      ?.split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith('xel_session='))
      ?.slice(12);
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));
    res.clearCookie('xel_session', { path: '/' });
    res.json({ ok: true });
  });
  app.put('/api/answers/:index', auth, (req, res) => {
    const index = Number(req.params.index),
      answer = validateAnswer(index, req.body);
    const old = profile(req.alumniId),
      answers = { ...old.answers, ...answer };
    const nextCheckpoint = Array.from({ length: 7 }, (_, i) => i).find(
      (i) => !old.progress.includes(i),
    );
    if (nextCheckpoint !== undefined && index > nextCheckpoint) {
      return res.status(400).json({ error: 'Selesaikan misi sebelumnya untuk membuka area ini.' });
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE responses SET answers_json=?, updated_at=? WHERE alumni_id=?').run(
        JSON.stringify(answers),
        new Date().toISOString(),
        req.alumniId,
      );
      db.prepare('INSERT OR IGNORE INTO checkpoint_progress(alumni_id,checkpoint) VALUES(?,?)').run(
        req.alumniId,
        index,
      );
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    res.json(profile(req.alumniId));
  });
  app.post('/api/complete', auth, (req, res) => {
    const p = profile(req.alumniId);
    if (p.progress.length !== 7) throw new Error('Selesaikan ketujuh checkpoint terlebih dahulu.');
    db.prepare('UPDATE responses SET completed_at=COALESCE(completed_at,?) WHERE alumni_id=?').run(
      new Date().toISOString(),
      req.alumniId,
    );
    res.json(profile(req.alumniId));
  });
  app.patch('/api/profile', auth, (req, res) => {
    if (typeof req.body.consentPublic !== 'boolean') throw new Error('Persetujuan tidak valid.');
    db.prepare('UPDATE alumni SET consent_public=? WHERE id=?').run(
      req.body.consentPublic ? 1 : 0,
      req.alumniId,
    );
    res.json(profile(req.alumniId));
  });
  app.get('/api/world', (_q, res) => {
    const rows = db
      .prepare(
        'SELECT a.id,a.nickname,a.avatar_json,r.answers_json FROM alumni a JOIN responses r ON r.alumni_id=a.id WHERE a.consent_public=1 AND r.completed_at IS NOT NULL ORDER BY a.created_at',
      )
      .all();
    res.json(
      rows.map((r) => {
        const a = JSON.parse(r.answers_json);
        return {
          id: r.id,
          nickname: r.nickname,
          avatar: JSON.parse(r.avatar_json),
          group: groupFor(a),
          badges: badgesFor(a),
        };
      }),
    );
  });
  const admin = (req, res, next) => {
    const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
    if (
      !adminToken ||
      !token ||
      !timingSafeEqual(Buffer.from(hash(token)), Buffer.from(hash(adminToken)))
    )
      return res
        .status(403)
        .json({ error: 'Akses admin memerlukan token yang dikonfigurasi di server.' });
    next();
  };
  app.get('/api/admin', admin, (_q, res) => {
    const rows = db
      .prepare(
        'SELECT a.id,a.full_name,a.nickname,a.whatsapp,a.consent_public,a.created_at,r.answers_json,r.completed_at FROM alumni a JOIN responses r ON r.alumni_id=a.id ORDER BY a.created_at DESC',
      )
      .all();
    res.json(rows.map(({ answers_json, ...r }) => ({ ...r, answers: JSON.parse(answers_json) })));
  });
  app.delete('/api/admin/alumni/:id', admin, (req, res) => {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('DELETE FROM invitations WHERE alumni_id=?').run(req.params.id);
      db.prepare('DELETE FROM alumni WHERE id=?').run(req.params.id);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    res.json({ ok: true });
  });
  const dist = resolve('dist');
  if (process.env.API_ONLY !== 'true' && existsSync(dist)) {
    app.use(express.static(dist));
    app.get('/{*path}', (_q, res) => res.sendFile(resolve(dist, 'index.html')));
  }
  app.use((err, req, res, _next) => {
    console.error(err.message);
    res.status(err.type === 'entity.too.large' ? 413 : 400).json({
      error: err.message?.includes('UNIQUE constraint')
        ? 'Data sudah terdaftar.'
        : err.message || 'Permintaan gagal.',
    });
  });
  return app;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createApp().listen(Number(process.env.PORT || 3001), process.env.HOST || '127.0.0.1', () =>
    console.log(
      'Xelograph server: http://' +
        (process.env.HOST || '127.0.0.1') +
        ':' +
        (process.env.PORT || 3001),
    ),
  );
}
