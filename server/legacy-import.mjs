import { randomUUID } from 'node:crypto';
import { hash } from './db.mjs';
import { normalizePhone, groupFor, badgesFor } from './domain.mjs';
import { AVATAR_MODELS } from '../src/game/avatarCatalog.mjs';
const norm = (v) =>
  String(v || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
function cell(cells, fragment) {
  const key = Object.keys(cells).find((key) => norm(key).includes(fragment));
  return key ? String(cells[key] || '').trim() : '';
}
const choice = (value, choices) => choices[norm(value)];
function timestamp(value) {
  const number = Number(value);
  if (value && Number.isFinite(number) && number > 30000 && number < 100000)
    return new Date(Date.UTC(1899, 11, 30) + number * 86400000).toISOString().slice(0, 19);
  return value.slice(0, 100) || null;
}
function generatedAvatar(key) {
  const bytes = Buffer.from(hash(key), 'hex');
  const character = bytes[0] % 2 ? 'female' : 'male';
  return {
    character,
    hair: AVATAR_MODELS[character][bytes[1] % 3].id,
    outfit: ['sage', 'clay', 'navy', 'cream'][bytes[2] % 4],
    skin: ['light', 'warm', 'deep'][bytes[3] % 3],
  };
}

export function prepareLegacyRow(row, sheet) {
  if (!row || !row.cells || typeof row.cells !== 'object' || Array.isArray(row.cells))
    throw new Error('Baris impor tidak valid.');
  if (
    Object.keys(row.cells).length > 80 ||
    Object.values(row.cells).some((v) => typeof v !== 'string' || v.length > 20000)
  )
    throw new Error('Ukuran sel impor tidak valid.');
  const raw = row.cells,
    notes = [],
    answers = {};
  const fullName = cell(raw, 'nama lengkap');
  if (!fullName || fullName.length > 100)
    throw new Error(`Baris ${row.rowNumber}: nama tidak valid.`);
  const rawPhone = cell(raw, 'nomor whatsapp');
  let whatsapp = null;
  try {
    whatsapp = normalizePhone(/^8\d{8,12}$/.test(rawPhone) ? '62' + rawPhone : rawPhone);
    if (rawPhone.startsWith('8'))
      notes.push('Awalan 62 ditambahkan pada nomor seluler tanpa angka nol.');
  } catch {
    notes.push(
      'Kontak tidak tersedia atau disamarkan dalam survei lama; tidak dibuat nomor pengganti.',
    );
  }
  const oldAttendance = cell(raw, 'bisa hadir');
  const attendance = choice(oldAttendance, {
    'insyaallah hadir': 'yes',
    'insyaallah hadirpsi 1': 'yes',
    'ingin hadir, tetapi masih menyesuaikan jadwal': 'maybe',
    'tidak bisa hadir': 'no',
  });
  if (attendance) answers.attendance = attendance;
  else notes.push('Kehadiran belum memiliki padanan yang pasti.');
  if (norm(oldAttendance) === 'insyaallah hadirpsi 1')
    notes.push('Typo opsi hadir dinormalisasi menjadi Insyaallah hadir.');
  const committee = choice(cell(raw, 'menjadi panitia'), {
    'bersedia menjadi panitia aktif': 'active',
    'hanya bisa hadir sebagai peserta': 'participant',
    'bersedia membantu jika diperlukan': 'occasional',
    'belum bisa ikut berpartisipasi': 'unavailable',
  });
  if (committee) answers.committee = committee;
  const production = choice(cell(raw, 'berkontribusi dalam tim produksi'), {
    'bersedia terlibat aktif': 'yes',
    'bersedia membantu sesuai kemampuan': 'yes',
    'tertarik, tetapi ingin mengetahui detailnya terlebih dahulu': 'maybe',
    'belum bisa berkontribusi': 'no',
  });
  if (production) answers.production = production;
  const department = choice(cell(raw, 'bidang apa'), {
    'acara dan hiburan': 'acara',
    'konsumsi dan perlengkapan': 'logistik',
    transport: 'logistik',
    dokumentasi: 'dokumentasi',
    humas: 'humas',
    kreatif: 'kreatif',
  });
  if (department) answers.department = [department];
  else if (['participant', 'unavailable'].includes(committee)) answers.department = [];
  else
    notes.push('Bidang bebas disimpan di jawaban asli; tidak ditebak menjadi bidang panitia baru.');
  const venue = cell(raw, 'tempat mana');
  const mappedVenue = choice(venue, {
    'sekolah / aula man 2': 'sekolah',
    'restoran atau rumah makan': 'restoran',
    hotel: 'hotel',
  });
  if (mappedVenue) answers.venue = mappedVenue;
  else if (venue) {
    answers.venue = 'other';
    answers.venueNote = venue.slice(0, 1000);
  }
  const contribution = choice(cell(raw, 'iuran atau kontribusi'), {
    'bersedia sesuai kesepakatan bersama': 'yes',
    'ingin mengetahui rincian anggaran terlebih dahulu': 'details',
    'belum bisa berkontribusi': 'no',
    'bersedia jika nominalnya terjangkau': 'depends',
  });
  if (contribution) answers.contribution = contribution;
  const sponsor = choice(cell(raw, 'donatur atau sponsor'), {
    'bersedia ikut jadi donatur untuk membantu biaya acara.': 'donor',
    'untuk saat ini belum bisa ikut berkontribusi.': 'no',
    'bersedia jadi sponsor, mungkin melalui usaha atau perusahaan.': 'sponsor',
  });
  if (sponsor) answers.sponsor = sponsor;
  else
    notes.push(
      'Dukungan mencari donatur/sponsor disimpan sebagai jawaban asli, bukan komitmen menjadi sponsor.',
    );
  const message = cell(raw, 'masukan dan saran');
  if (message.length <= 1000) answers.message = message;
  else notes.push('Saran panjang dipertahankan utuh di jawaban asli.');
  notes.push(
    'Persetujuan bukber/reuni dan usulan konsep bebas dipertahankan sebagai pertanyaan survei lama; pilihan konsep/aktivitas game tidak dikarang.',
  );
  const submittedAt = timestamp(cell(raw, 'timestamp'));
  const key = hash(JSON.stringify([norm(fullName), whatsapp || norm(rawPhone), submittedAt]));
  return {
    sourceKey: key,
    fullName,
    nickname: fullName.split(/\s+/)[0].slice(0, 24),
    whatsapp,
    submittedAt,
    answers,
    raw,
    notes,
    avatar: generatedAvatar(key),
    sheetName: String(sheet).slice(0, 100),
    rowNumber: row.rowNumber,
  };
}

export function importLegacySurvey(db, payload, { publishAvatars = false, dryRun = false } = {}) {
  if (
    payload?.version !== 1 ||
    !Array.isArray(payload.sheets) ||
    !/^[a-f0-9]{64}$/.test(payload.fingerprint || '')
  )
    throw new Error('Format payload impor tidak dikenali.');
  if (typeof payload.sourceName !== 'string' || payload.sourceName.length > 200)
    throw new Error('Nama sumber tidak valid.');
  const source = payload.sheets.flatMap((sheet) => {
    if (!Array.isArray(sheet.rows)) throw new Error('Sheet tidak valid.');
    return sheet.rows.map((row) => prepareLegacyRow(row, sheet.name));
  });
  if (!source.length || source.length > 2000) throw new Error('Impor harus berisi 1–2000 respons.');
  const summary = {
    total: source.length,
    inserted: 0,
    duplicates: 0,
    linked: 0,
    published: 0,
    missingContacts: 0,
    rowsWithNotes: 0,
    sourceName: payload.sourceName,
  };
  const existing = db
    .prepare('SELECT summary_json FROM survey_imports WHERE source_hash=?')
    .get(payload.fingerprint);
  if (existing)
    return {
      ...JSON.parse(existing.summary_json),
      inserted: 0,
      duplicates: source.length,
      alreadyImported: true,
    };
  const rows = [],
    seen = new Set();
  for (const row of source) {
    if (
      seen.has(row.sourceKey) ||
      db.prepare('SELECT id FROM legacy_responses WHERE source_key=?').get(row.sourceKey)
    ) {
      summary.duplicates++;
      continue;
    }
    seen.add(row.sourceKey);
    row.existing = row.whatsapp
      ? db
          .prepare(
            'SELECT a.*,r.answers_json,r.completed_at FROM alumni a JOIN responses r ON r.alumni_id=a.id WHERE a.whatsapp=?',
          )
          .get(row.whatsapp)
      : null;
    summary.inserted++;
    if (row.existing) summary.linked++;
    if (!row.whatsapp) summary.missingContacts++;
    if (row.notes.length) summary.rowsWithNotes++;
    if (publishAvatars && (!row.existing || row.existing.consent_public)) summary.published++;
    rows.push(row);
  }
  if (dryRun) return summary;
  const importId = randomUUID();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(
      'INSERT INTO survey_imports(id,source_hash,source_name,summary_json) VALUES(?,?,?,?)',
    ).run(importId, payload.fingerprint, payload.sourceName, JSON.stringify(summary));
    for (const row of rows) {
      if (row.existing) {
        const current = JSON.parse(row.existing.answers_json);
        const merged = { ...row.answers, ...current };
        db.prepare('UPDATE responses SET answers_json=?,updated_at=? WHERE alumni_id=?').run(
          JSON.stringify(merged),
          new Date().toISOString(),
          row.existing.id,
        );
        // A previous completed survey waives the new journey; missing answers remain missing.
        if (!row.existing.completed_at) {
          db.prepare(
            'UPDATE responses SET completed_at=?,completion_basis=? WHERE alumni_id=?',
          ).run(row.submittedAt || new Date().toISOString(), 'legacy_import', row.existing.id);
          for (let i = 0; i < 7; i++)
            db.prepare(
              'INSERT OR IGNORE INTO checkpoint_progress(alumni_id,checkpoint) VALUES(?,?)',
            ).run(row.existing.id, i);
        }
        row.avatar = JSON.parse(row.existing.avatar_json);
      }
      db.prepare(
        'INSERT INTO legacy_responses(id,import_id,source_key,sheet_name,row_number,full_name,nickname,whatsapp,submitted_at,answers_json,raw_json,notes_json,avatar_json,published_by_admin,linked_alumni_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      ).run(
        randomUUID(),
        importId,
        row.sourceKey,
        row.sheetName,
        row.rowNumber,
        row.fullName,
        row.nickname,
        row.whatsapp,
        row.submittedAt,
        JSON.stringify(row.answers),
        JSON.stringify(row.raw),
        JSON.stringify(row.notes),
        JSON.stringify(row.avatar),
        publishAvatars ? 1 : 0,
        row.existing?.id || null,
      );
    }
    db.exec('COMMIT');
    return { ...summary, importId };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function publicLegacyAvatars(db) {
  return db
    .prepare(
      'SELECT id,nickname,avatar_json,answers_json FROM legacy_responses WHERE published_by_admin=1 AND linked_alumni_id IS NULL ORDER BY created_at,id',
    )
    .all()
    .map((row) => {
      const answers = JSON.parse(row.answers_json);
      return {
        id: 'legacy:' + row.id,
        nickname: row.nickname,
        avatar: JSON.parse(row.avatar_json),
        group: groupFor(answers),
        badges: badgesFor(answers),
      };
    });
}
export function adminRespondents(db) {
  const legacy = db
    .prepare(
      'SELECT l.*,i.source_name FROM legacy_responses l JOIN survey_imports i ON i.id=l.import_id ORDER BY l.created_at DESC,l.row_number',
    )
    .all();
  const linked = new Map(
    legacy.filter((r) => r.linked_alumni_id).map((r) => [r.linked_alumni_id, r]),
  );
  const source = (row) => ({
    sourceName: row.source_name,
    sourceRow: row.row_number,
    raw: JSON.parse(row.raw_json),
    mappingNotes: JSON.parse(row.notes_json),
  });
  const current = db
    .prepare(
      'SELECT a.id,a.full_name,a.nickname,a.whatsapp,a.consent_public,a.created_at,r.answers_json,r.completed_at,r.completion_basis FROM alumni a JOIN responses r ON r.alumni_id=a.id ORDER BY a.created_at DESC',
    )
    .all()
    .map(({ answers_json, ...row }) => ({
      ...row,
      answers: JSON.parse(answers_json),
      sourceType: row.completion_basis === 'legacy_import' ? 'legacy' : 'game',
      ...(linked.has(row.id) ? source(linked.get(row.id)) : {}),
    }));
  return [
    ...current,
    ...legacy
      .filter((r) => !r.linked_alumni_id)
      .map((r) => ({
        id: 'legacy:' + r.id,
        full_name: r.full_name,
        nickname: r.nickname,
        whatsapp: r.whatsapp,
        created_at: r.created_at,
        completed_at: r.submitted_at || r.created_at,
        sourceType: 'legacy',
        completion_basis: 'legacy_import',
        consent_public: r.published_by_admin,
        answers: JSON.parse(r.answers_json),
        ...source(r),
      })),
  ];
}
