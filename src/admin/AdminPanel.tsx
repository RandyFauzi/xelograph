'use client';
import { useState } from 'react';
import { Shield, ArrowRight, Download, RefreshCw } from 'lucide-react';
import { api, download } from '../api';
import { LABELS } from '../types';
export default function AdminPanel() {
  const [token, setToken] = useState(''),
    [rows, setRows] = useState<any[] | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    try {
      setRows(await api('/admin', { headers: { Authorization: 'Bearer ' + token } }));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const completed = rows?.filter((r) => r.completed_at) || [];
  const exportCsv = () => {
    const cols = [
      'full_name',
      'nickname',
      'whatsapp',
      'completed_at',
      'concept',
      'attendance',
      'committee',
      'department',
      'activities',
      'production',
      'venue',
      'venueNote',
      'contribution',
      'sponsor',
      'message',
    ];
    const quote = (v: unknown) =>
      '"' +
      String(v ?? '')
        .replace(/^[=+@\-\t\r]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    download(
      'xylograph-alumni.csv',
      '\uFEFF' +
        [
          cols.map(quote).join(','),
          ...rows!.map((r) =>
            cols
              .map((k) =>
                quote(
                  Array.isArray(r.answers[k]) ? r.answers[k].join('; ') : (r[k] ?? r.answers[k]),
                ),
              )
              .join(','),
          ),
        ].join('\r\n'),
      'text/csv;charset=utf-8',
    );
  };
  return (
    <div className="page-content alternate">
      <div className="eyebrow">BEHIND THE GATHERING</div>
      <h1>
        Ruang
        <br />
        <span>para penggerak.</span>
      </h1>
      <p>Ringkasan aspirasi dan partisipasi alumni.</p>
      {!rows ? (
        <form
          className="admin-login"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <Shield size={26} />
          <h2>Akses khusus panitia</h2>
          <p>Masukkan token admin yang diatur pada server.</p>
          <label className="field">
            Token admin
            <input
              type="password"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? 'Memeriksa…' : 'Buka dashboard'}
            <ArrowRight size={17} />
          </button>
        </form>
      ) : (
        <>
          <div className="admin-toolbar">
            <button className="primary" onClick={exportCsv}>
              <Download size={17} />
              Ekspor CSV
            </button>
            <button className="secondary" onClick={load}>
              <RefreshCw size={16} />
              Perbarui
            </button>
            <button
              className="text-button"
              onClick={() => {
                setRows(null);
                setToken('');
              }}
            >
              Kunci dashboard
            </button>
          </div>
          <div className="admin-stats">
            {[
              ['Respons unik', rows.length],
              ['Survei selesai', completed.length],
              ['Ingin hadir', completed.filter((r) => r.answers.attendance === 'yes').length],
              [
                'Calon crew',
                completed.filter((r) => ['active', 'occasional'].includes(r.answers.committee))
                  .length,
              ],
            ].map(([l, n]) => (
              <article key={l}>
                <p>{l}</p>
                <b>{n}</b>
              </article>
            ))}
          </div>
          <div className="admin-breakdowns">
            {[
              ['Pilihan acara', 'concept', ['fun', 'bukber', 'both', 'unsure']],
              ['Venue', 'venue', ['sekolah', 'outdoor', 'restoran', 'hotel', 'other']],
              ['Iuran', 'contribution', ['yes', 'depends', 'details', 'no']],
              [
                'Bidang kepanitiaan',
                'department',
                ['acara', 'kreatif', 'logistik', 'humas', 'dokumentasi'],
              ],
            ].map(([title, key, opts]) => (
              <article key={title as string}>
                <h3>{title as string}</h3>
                {(opts as string[]).map((v) => {
                  const n = completed.filter((r) =>
                    Array.isArray(r.answers[key as string])
                      ? r.answers[key as string].includes(v)
                      : r.answers[key as string] === v,
                  ).length;
                  return (
                    <div className="breakdown" key={v}>
                      <span>{LABELS[v]}</span>
                      <b>{n}</b>
                      <div>
                        <i
                          style={{
                            width: (completed.length ? (n / completed.length) * 100 : 0) + '%',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </article>
            ))}
          </div>
          <p className="helper">
            Ringkasan kategori memakai survei selesai. Ekspor memuat seluruh respons termasuk draf.
            Dukungan dan kehadiran dihitung terpisah.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Alumni</th>
                  <th>WhatsApp</th>
                  <th>Pilihan</th>
                  <th>Kehadiran</th>
                  <th>Partisipasi</th>
                  <th>Status</th>
                  <th>Pesan</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <b>{r.full_name}</b>
                      <small>{r.nickname}</small>
                    </td>
                    <td>{r.whatsapp}</td>
                    <td>{LABELS[r.answers.concept] || '—'}</td>
                    <td>
                      {{ yes: 'Ingin hadir', maybe: 'Mungkin', no: 'Belum bisa' }[
                        r.answers.attendance as string
                      ] || '—'}
                    </td>
                    <td>{LABELS[r.answers.committee] || '—'}</td>
                    <td>{r.completed_at ? 'Selesai' : 'Draf'}</td>
                    <td className="message-cell">{r.answers.message || '—'}</td>
                    <td>
                      <button
                        className="delete-button"
                        onClick={async () => {
                          if (
                            !window.confirm(
                              'Hapus permanen data ' + r.full_name + ' beserta jawaban dan sesi?',
                            )
                          )
                            return;
                          try {
                            await api('/admin/alumni/' + r.id, {
                              method: 'DELETE',
                              headers: { Authorization: 'Bearer ' + token },
                            });
                            load();
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <p className="empty-state">Belum ada respons.</p>}
          </div>
        </>
      )}
    </div>
  );
}
