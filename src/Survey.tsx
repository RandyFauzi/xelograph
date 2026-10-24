import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Flag,
  CalendarDays,
  Users,
  Sparkles,
  MapPin,
  Heart,
  MessageSquare,
  LoaderCircle,
} from 'lucide-react';
import { CHECKPOINTS, LABELS, type Answers, type Profile } from './types';
import { api } from './api';
export const ICONS = [Flag, CalendarDays, Users, Sparkles, MapPin, Heart, MessageSquare];
export function Survey({
  index,
  profile,
  onSaved,
  onBack,
}: {
  index: number;
  profile: Profile;
  onSaved: (p: Profile) => void;
  onBack: () => void;
}) {
  const [a, setA] = useState<Answers>({
    department: [],
    activities: [],
    production: 'no',
    sponsor: 'no',
    ...profile.answers,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const cp = CHECKPOINTS[index],
    Icon = ICONS[index];
  const field = (key: string, values: string[], multi = false) => (
    <div className={'options ' + (multi ? 'multi' : '')}>
      {values.map((v) => {
        const selected = multi ? ((a[key] as string[]) || []).includes(v) : a[key] === v;
        return (
          <button
            type="button"
            key={v}
            className={'option ' + (selected ? 'selected' : '')}
            aria-pressed={selected}
            onClick={() =>
              setA((prev) => ({
                ...prev,
                [key]: multi
                  ? selected
                    ? (prev[key] as string[]).filter((x) => x !== v)
                    : [...((prev[key] as string[]) || []), v]
                  : v,
              }))
            }
          >
            <span>{LABELS[v]}</span>
            <span className="option-check">{selected && <Check size={14} />}</span>
          </button>
        );
      })}
    </div>
  );
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const p = await api<Profile>('/answers/' + index, { method: 'PUT', body: JSON.stringify(a) });
      onSaved(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="dialog-eyebrow">
        <Icon size={17} /> CHECKPOINT {String(index + 1).padStart(2, '0')} / 07
      </div>
      <h2>{cp.name}</h2>
      <p className="dialog-description">{cp.description}</p>
      <div className="survey-body">
        {index === 0 && (
          <>
            <h3>Reuni seperti apa yang kamu inginkan?</h3>
            <p className="helper">
              Ini masih penjajakan. Pilihanmu membantu panitia menentukan arah.
            </p>
            <div className="concept-notes">
              <span>
                <b>Fun Reunion</b>Fun walk, hiburan & kumpul alumni.
                <small>Rencana akhir Januari 2027</small>
              </span>
              <span>
                <b>Bukber Reunion</b>Buka bersama & menyambung cerita.
                <small>Rencana Ramadan 2027 · tanggal menyusul</small>
              </span>
            </div>
            {field('concept', ['fun', 'bukber', 'both', 'unsure'])}
          </>
        )}
        {index === 1 && (
          <>
            <h3>Kalau rencana pilihanmu terlaksana, kamu bisa hadir?</h3>
            <p className="helper">Boleh berubah nanti. Jawab sesuai perkiraanmu sekarang.</p>
            <div className="options">
              {[
                ['yes', 'Aku ingin hadir'],
                ['maybe', 'Mungkin, lihat jadwal dulu'],
                ['no', 'Belum bisa hadir'],
              ].map(([v, l]) => (
                <button
                  key={v}
                  className={'option ' + (a.attendance === v ? 'selected' : '')}
                  onClick={() => setA({ ...a, attendance: v })}
                  aria-pressed={a.attendance === v}
                >
                  {l}
                  <span className="option-check">{a.attendance === v && <Check size={14} />}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {index === 2 && (
          <>
            <h3>Mau ikut mewujudkan reuni ini?</h3>
            {field('committee', ['active', 'occasional', 'participant', 'unavailable'])}
            {['active', 'occasional'].includes(a.committee as string) && (
              <>
                <h3>Bidang yang menarik buatmu</h3>
                <p className="helper">Boleh pilih lebih dari satu.</p>
                {field(
                  'department',
                  ['acara', 'kreatif', 'logistik', 'humas', 'dokumentasi'],
                  true,
                )}
              </>
            )}
            <p className="helper">Kesediaan membantu tersimpan terpisah dari kehadiranmu.</p>
          </>
        )}
        {index === 3 && (
          <>
            <h3>Apa yang ingin kamu temukan di reuni?</h3>
            <p className="helper">Pilih satu atau beberapa kegiatan.</p>
            {field(
              'activities',
              ['games', 'doorprize', 'musik', 'sharing', 'nostalgia', 'olahraga'],
              true,
            )}
            <h3>Mau bergabung di tim produksi / proyek kreatif?</h3>
            {field('production', ['yes', 'maybe', 'no'])}
          </>
        )}
        {index === 4 && (
          <>
            <h3>Tempat mana yang terasa paling pas?</h3>
            {field('venue', ['sekolah', 'outdoor', 'restoran', 'hotel', 'other'])}
            {a.venue === 'other' && (
              <label className="field">
                Usulan tempat
                <input
                  maxLength={1000}
                  value={a.venueNote || ''}
                  onChange={(e) => setA({ ...a, venueNote: e.target.value })}
                  placeholder="Nama tempat atau suasana yang kamu bayangkan"
                />
              </label>
            )}
          </>
        )}
        {index === 5 && (
          <>
            <h3>Bagaimana dengan iuran acara?</h3>
            {field('contribution', ['yes', 'depends', 'details', 'no'])}
            <h3>Ingin ikut mendukung lebih jauh?</h3>
            {field('sponsor', ['donor', 'sponsor', 'no'])}
            <p className="helper">
              Ini pernyataan minat. Tidak ada pembayaran atau komitmen nominal di sini.
            </p>
          </>
        )}
        {index === 6 && (
          <>
            <h3>Satu pesan untuk Xelograph?</h3>
            <label className="field">
              Ide, harapan, atau kenangan kecil
              <textarea
                rows={5}
                maxLength={1000}
                value={a.message || ''}
                onChange={(e) => setA({ ...a, message: e.target.value })}
                placeholder="Masih ingat waktu kita…"
              />
            </label>
            <p className="helper">
              Opsional · {String(a.message || '').length}/1.000 · Pesan hanya dibaca panitia.
            </p>
            <div className="note">
              Setelah ini, jejakmu akan menjadi bagian dari dunia Xelograph. Kamu tetap bisa
              memperbarui jawaban kapan saja.
            </div>
          </>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button className="text-button" onClick={onBack}>
          <ArrowLeft size={16} /> Kembali ke dunia
        </button>
        <button className="primary" onClick={save} disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}{' '}
          {busy ? 'Menyimpan…' : index === 6 ? 'Simpan & selesaikan' : 'Selesaikan misi'}
          <ArrowRight size={16} />
        </button>
      </div>
    </>
  );
}
