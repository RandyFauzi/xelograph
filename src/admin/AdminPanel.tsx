'use client';
import { useEffect, useMemo, useState } from 'react';
import { Shield, ArrowRight, Download, RefreshCw, Search, Lock } from 'lucide-react';
import { api, download } from '../api';
import { LABELS } from '../types';
type Row = {
  id: string;
  full_name: string;
  nickname: string;
  whatsapp: string | null;
  completed_at: string | null;
  sourceType: 'game' | 'legacy';
  sourceName?: string;
  sourceRow?: number;
  answers: Record<string, string | string[]>;
  raw?: Record<string, string>;
  mappingNotes?: string[];
};
const fields: Record<string, string> = {
  concept: 'Konsep game',
  attendance: 'Kehadiran',
  committee: 'Kepanitiaan',
  department: 'Bidang panitia',
  activities: 'Kegiatan game',
  production: 'Tim produksi',
  venue: 'Tempat',
  venueNote: 'Usulan tempat',
  contribution: 'Iuran',
  sponsor: 'Dukungan',
  message: 'Pesan',
};
function value(v: unknown): string {
  if (Array.isArray(v)) return v.map(value).join(', ') || 'Belum ada';
  return typeof v === 'string' ? LABELS[v] || v : 'Belum ada';
}
function attendance(v: unknown) {
  return (
    (
      { yes: 'Ingin hadir', maybe: 'Masih menyesuaikan', no: 'Tidak bisa hadir' } as Record<
        string,
        string
      >
    )[String(v)] || 'Belum ada'
  );
}
export default function AdminPanel() {
  const [code, setCode] = useState(''),
    [rows, setRows] = useState<Row[] | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [search, setSearch] = useState(''),
    [source, setSource] = useState('all');
  const load = async () => {
    const data = await api<Row[]>('/admin');
    setRows(data);
    setError('');
  };
  useEffect(() => {
    void load().catch(() => {});
  }, []);
  const filtered = useMemo(
    () =>
      rows?.filter(
        (row) =>
          (source === 'all' || row.sourceType === source) &&
          [row.full_name, row.nickname, row.whatsapp || '']
            .join(' ')
            .toLowerCase()
            .includes(search.toLowerCase()),
      ) || [],
    [rows, search, source],
  );
  const exported = () => {
    const columns = [
      'Nama',
      'WhatsApp',
      'Sumber',
      'Status',
      'Persetujuan bukber/reuni lama',
      ...Object.values(fields),
      'Jawaban asli',
      'Catatan pemetaan',
    ];
    const quote = (v: unknown) => {
      let s = String(v ?? '');
      if (/^\s*[=+@-]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };
    const content = [
      columns,
      ...filtered.map((row) => [
        row.full_name,
        row.whatsapp || '',
        row.sourceType === 'legacy' ? 'Survei lama' : 'Game',
        row.completed_at ? 'Selesai' : 'Draf',
        Object.entries(row.raw || {}).find(([k]) => k.toLowerCase().includes('setuju jika'))?.[1] ||
          '',
        ...Object.keys(fields).map((k) =>
          Array.isArray(row.answers[k])
            ? (row.answers[k] as string[]).map(value).join('; ')
            : row.answers[k] || '',
        ),
        JSON.stringify(row.raw || {}),
        (row.mappingNotes || []).join('; '),
      ]),
    ];
    download(
      'xylograph-responden.csv',
      '\uFEFF' + content.map((r) => r.map(quote).join(',')).join('\r\n'),
      'text/csv;charset=utf-8',
    );
  };
  return (
    <div className="respondent-page">
      <div className="eyebrow">XYLOGRAPH / PANITIA</div>
      <h1>Tabel Responden</h1>
      <p>Hasil survei dan jawaban asli dalam satu tempat.</p>
      {!rows ? (
        <form
          className="admin-login"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              await api('/admin/session', { method: 'POST', body: JSON.stringify({ code }) });
              setCode('');
              await load();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Shield size={28} />
          <h2>Akses admin</h2>
          <p>Masukkan kode akses panitia. Data responden hanya ditampilkan setelah masuk.</p>
          <label className="field">
            Kode admin
            <input
              type="password"
              required
              autoComplete="current-password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={128}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? 'Memeriksa…' : 'Buka tabel responden'}
            <ArrowRight size={17} />
          </button>
        </form>
      ) : (
        <>
          <div className="admin-toolbar">
            <button className="primary" onClick={exported}>
              <Download size={17} />
              Ekspor hasil filter
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RefreshCw size={17} />
              Perbarui
            </button>
            <button
              className="text-button"
              onClick={async () => {
                try {
                  await api('/admin/session', { method: 'DELETE' });
                  setRows(null);
                  setCode('');
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Lock size={16} />
              Keluar admin
            </button>
          </div>
          <div className="admin-stats">
            {[
              ['Total responden', rows.length],
              ['Survei lama', rows.filter((r) => r.sourceType === 'legacy').length],
              ['Dari game', rows.filter((r) => r.sourceType === 'game').length],
              ['Draf game', rows.filter((r) => r.sourceType === 'game' && !r.completed_at).length],
            ].map(([label, n]) => (
              <article key={label}>
                <p>{label}</p>
                <b>{n}</b>
              </article>
            ))}
          </div>
          <div className="respondent-tools">
            <label className="search">
              <Search size={18} />
              <input
                aria-label="Cari nama atau WhatsApp"
                placeholder="Cari nama atau WhatsApp…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label>
              Sumber
              <select value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="all">Semua sumber</option>
                <option value="legacy">Survei lama</option>
                <option value="game">Game</option>
              </select>
            </label>
            <span>{filtered.length} ditampilkan</span>
          </div>
          <p className="helper">
            Survei lama dianggap sudah diisi. Jawaban yang tidak ditanyakan dalam formulir lama
            tetap ditandai “Belum ada”; tidak diubah menjadi “Tidak”. Buka detail untuk melihat teks
            asli dan catatan pemetaan.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="table-scroll">
            <table className="respondent-table">
              <caption>Responden dan hasil survei</caption>
              <thead>
                <tr>
                  {[
                    'Alumni',
                    'WhatsApp',
                    'Sumber / status',
                    'Setuju bukber/reuni (lama)',
                    'Kehadiran',
                    'Kepanitiaan',
                    'Tempat',
                    'Jawaban lengkap',
                  ].map((t) => (
                    <th key={t}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <b>{row.full_name}</b>
                      <small>{row.nickname}</small>
                    </td>
                    <td>{row.whatsapp || 'Tidak tersedia'}</td>
                    <td>
                      <span className="source-tag">
                        {row.sourceType === 'legacy' ? 'Survei lama' : 'Game'}
                      </span>
                      <small>{row.completed_at ? 'Sudah diisi' : 'Draf'}</small>
                    </td>
                    <td>
                      {Object.entries(row.raw || {}).find(([k]) =>
                        k.toLowerCase().includes('setuju jika'),
                      )?.[1] || '—'}
                    </td>
                    <td>{attendance(row.answers.attendance)}</td>
                    <td>{value(row.answers.committee)}</td>
                    <td>
                      {value(row.answers.venue)}
                      {row.answers.venueNote && <small>{value(row.answers.venueNote)}</small>}
                    </td>
                    <td>
                      <details>
                        <summary>Lihat detail</summary>
                        <div className="response-detail">
                          <h3>Jawaban yang dipetakan</h3>
                          <dl>
                            {Object.entries(fields).map(([key, label]) => (
                              <div key={key}>
                                <dt>{label}</dt>
                                <dd>
                                  {key === 'attendance'
                                    ? attendance(row.answers[key])
                                    : value(row.answers[key])}
                                </dd>
                              </div>
                            ))}
                          </dl>
                          {row.raw && (
                            <>
                              <h3>Jawaban asli survei lama</h3>
                              <p>
                                {row.sourceName} · baris {row.sourceRow}
                              </p>
                              <dl>
                                {Object.entries(row.raw).map(([question, answer]) => (
                                  <div key={question}>
                                    <dt>{question}</dt>
                                    <dd>{answer || 'Kosong di sumber'}</dd>
                                  </div>
                                ))}
                              </dl>
                            </>
                          )}
                          {!!row.mappingNotes?.length && (
                            <>
                              <h3>Catatan pemetaan</h3>
                              <ul>
                                {row.mappingNotes.map((note, i) => (
                                  <li key={i}>{note}</li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <p className="empty-state">Tidak ada responden yang cocok.</p>}
          </div>
        </>
      )}
    </div>
  );
}
