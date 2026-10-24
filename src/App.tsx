import { useCallback, useEffect, useState, lazy, Suspense } from 'react';
import {
  ArrowRight,
  Route,
  Check,
  X,
  Download,
  Shield,
  LogOut,
  Leaf,
  Flag,
  LoaderCircle,
} from 'lucide-react';
import AvatarPortrait from './AvatarPortrait';
import {
  GameScreen,
  QuestJournal,
  AlumniDirectory,
  GameSettings,
  type TravelRequest,
} from './GameScreen';
import { Survey } from './Survey';
import { campusAudio, loadAudioPreferences, type AudioPreferences } from './game/audio';
import { api, download } from './api';
import {
  CHECKPOINTS,
  COLORS,
  DEFAULT_AVATAR,
  LABELS,
  type AvatarConfig,
  type Profile,
  type Alumnus,
} from './types';
const AvatarPreview = lazy(() => import('./World').then((m) => ({ default: m.AvatarPreview })));
function Preview({ config }: { config: AvatarConfig }) {
  return (
    <Suspense fallback={<AvatarPortrait config={config} />}>
      <AvatarPreview config={config} />
    </Suspense>
  );
}

type Modal =
  'join' | 'resume' | 'survey' | 'pass' | 'privacy' | 'quests' | 'alumni' | 'settings' | null;
export default function App() {
  const [audioPrefs, setAudioPrefs] = useState<AudioPreferences>(loadAudioPreferences),
    [entered, setEntered] = useState(false),
    [overview, setOverview] = useState(false),
    [travel, setTravel] = useState<TravelRequest | null>(null),
    [modal, setModal] = useState<Modal>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [alumni, setAlumni] = useState<Alumnus[]>([]),
    [demo, setDemo] = useState(false),
    [index, setIndex] = useState(0),
    [focusId, setFocusId] = useState<string | null>(null),
    [error, setError] = useState(''),
    [toast, setToast] = useState(''),
    [light, setLight] = useState(false),
    [ready, setReady] = useState(false);
  useEffect(() => {
    campusAudio.configure(audioPrefs);
    try {
      localStorage.setItem('xel-audio', JSON.stringify(audioPrefs));
    } catch {}
  }, [audioPrefs]);
  useEffect(() => {
    const unlock = () => {
      void campusAudio.unlock();
    };
    const visibility = () => campusAudio.visibility(document.hidden);
    const tap = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) campusAudio.play('tap');
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    window.addEventListener('pointerdown', tap);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
      window.removeEventListener('pointerdown', tap);
      document.removeEventListener('visibilitychange', visibility);
      campusAudio.visibility(true);
    };
  }, []);
  const changeAudio = (prefs: AudioPreferences) => {
    campusAudio.configure(prefs);
    setAudioPrefs(prefs);
    if (prefs.enabled) void campusAudio.unlock();
  };
  const refresh = useCallback(async () => {
    try {
      setAlumni(await api('/world'));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    let alive = true;
    Promise.all([
      api('/config'),
      fetch('/api/me').then(async (r) => (r.ok ? r.json() : null)),
      api('/world'),
    ])
      .then(([config, p, world]) => {
        if (alive) {
          setDemo(config.demo);
          setProfile(p);
          setAlumni(world);
          setReady(true);
        }
      })
      .catch((e) => {
        setError(e.message);
        setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const id = setInterval(refresh, 60000);
    return () => clearInterval(id);
  }, [refresh]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    if (!modal) return;
    const old = document.activeElement as HTMLElement;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModal(null);
      if (e.key === 'Tab') {
        const els = Array.from(
          document.querySelectorAll<HTMLElement>(
            '.modal button:not(:disabled),.modal input,.modal textarea,.modal select,.modal a[href]',
          ),
        ).filter((el) => el.offsetParent !== null);
        if (!els.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    const t = setTimeout(
      () => document.querySelector<HTMLElement>('.modal input,.modal button')?.focus(),
      50,
    );
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handler);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handler);
      old?.focus();
    };
  }, [modal]);
  const openCheckpoint = useCallback(
    (i: number) => {
      const current = profile
        ? CHECKPOINTS.findIndex((_, step) => !profile.progress.includes(step))
        : 0;
      if (current >= 0 && i > current) {
        setToast('Selesaikan ' + CHECKPOINTS[current].name + ' untuk membuka area ini.');
        return;
      }
      setIndex(i);
      setModal(profile ? 'survey' : 'join');
    },
    [profile],
  );
  const next = profile ? CHECKPOINTS.findIndex((_, i) => !profile.progress.includes(i)) : 0;
  const saved = async (p: Profile) => {
    setProfile(p);
    campusAudio.play('success');
    setToast('Checkpoint tersimpan. Satu langkah lebih dekat.');
    if (p.progress.length < 7) {
      setModal(null);
      setEntered(true);
      setToast(
        'Misi selesai! Area ' +
          (CHECKPOINTS.findIndex((_, i) => !p.progress.includes(i)) + 1) +
          ' terbuka. Lanjutkan perjalananmu.',
      );
    } else {
      try {
        const done = await api<Profile>('/complete', { method: 'POST' });
        setProfile(done);
        setModal('pass');
        refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    }
  };
  const goTo = (i: number) => {
    if (next >= 0 && i > next) {
      setToast('Area ini terbuka setelah misi sebelumnya selesai.');
      return;
    }
    setFocusId(null);
    setOverview(false);
    setEntered(true);
    setModal(null);
    setTravel({ index: i, nonce: Date.now() });
    setToast('Ikuti jalan menuju ' + CHECKPOINTS[i].name + '.');
  };
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen();
      else setToast('Gunakan menu browser untuk menambahkan permainan ke layar utama.');
    } catch {
      setToast('Layar penuh tidak tersedia di browser ini.');
    }
  };
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        ['m', 'o'].includes(e.key.toLowerCase()) &&
        entered &&
        !modal &&
        !(e.target as HTMLElement).matches('input,textarea,select')
      ) {
        e.preventDefault();
        if (e.key.toLowerCase() === 'o') setOverview((v) => !v);
        else setModal('quests');
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [entered, modal]);
  return (
    <div className="game-app">
      <GameScreen
        profile={profile}
        alumni={alumni}
        demo={demo}
        entered={entered}
        paused={!!modal}
        ready={ready}
        light={light}
        travel={travel}
        focusId={focusId}
        overview={overview}
        audioEnabled={audioPrefs.enabled}
        onAudioToggle={() => changeAudio({ ...audioPrefs, enabled: !audioPrefs.enabled })}
        onOverview={() => setOverview((v) => !v)}
        onEnter={() => {
          setEntered(true);
          setToast(
            'Geser joystick atau gunakan WASD. Datangi area bercahaya untuk memulai cerita.',
          );
        }}
        onJoin={() => setModal('join')}
        onResume={() => setModal('resume')}
        onPanel={setModal}
        onCheckpoint={openCheckpoint}
        onTravel={goTo}
        onError={setToast}
      />
      {error && (
        <div className="game-error" role="alert">
          <span>{error}</span>
          <button
            onClick={() => {
              setError('');
              refresh();
            }}
          >
            Coba lagi
          </button>
          <button aria-label="Tutup pesan" onClick={() => setError('')}>
            <X size={16} />
          </button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <section
            className={'modal ' + (modal === 'join' ? 'wide' : '')}
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === 'survey'
                ? CHECKPOINTS[index].name
                : modal === 'join'
                  ? 'Buat karakter'
                  : modal === 'pass'
                    ? 'Reunion pass'
                    : 'Xelograph'
            }
          >
            <button
              className="modal-close"
              aria-label="Tutup dialog"
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            {modal === 'quests' && (
              <QuestJournal profile={profile} onCheckpoint={openCheckpoint} onTravel={goTo} />
            )}
            {modal === 'alumni' && (
              <AlumniDirectory
                alumni={alumni}
                onFind={(a) => {
                  setOverview(false);
                  setFocusId(a.id);
                  setEntered(true);
                  setModal(null);
                  setToast('Menuju ' + a.nickname + '.');
                }}
              />
            )}
            {modal === 'settings' && (
              <GameSettings
                light={light}
                audioPrefs={audioPrefs}
                onAudioChange={changeAudio}
                onLight={() => {
                  setLight(!light);
                  setEntered(true);
                  setModal(null);
                }}
                onPrivacy={() => setModal('privacy')}
                onTitle={() => {
                  setEntered(false);
                  setModal(null);
                }}
                onFullscreen={fullscreen}
              />
            )}
            {modal === 'join' && (
              <Join
                demo={demo}
                onDone={(p) => {
                  setProfile(p);
                  setEntered(true);
                  setModal(null);
                  setToast('Selamat datang! Geser joystick atau gunakan WASD untuk berjalan.');
                  setIndex(
                    p.progress.length === 7
                      ? 6
                      : CHECKPOINTS.findIndex((_, i) => !p.progress.includes(i)),
                  );
                }}
                onResume={() => setModal('resume')}
              />
            )}
            {modal === 'resume' && (
              <Resume
                onDone={(p) => {
                  setProfile(p);
                  setModal(null);
                  setEntered(true);
                  setToast('Selamat datang kembali, ' + p.nickname + '.');
                }}
                onJoin={() => setModal('join')}
              />
            )}
            {modal === 'survey' && profile && (
              <Survey
                key={index}
                index={index}
                profile={profile}
                onSaved={saved}
                onBack={() => setModal(null)}
              />
            )}
            {modal === 'privacy' && (
              <>
                <div className="dialog-eyebrow">
                  <Shield size={16} /> YOUR STORY, YOUR CHOICE
                </div>
                <h2>
                  Ruang kecil.
                  <br />
                  Kepercayaan besar.
                </h2>
                <div className="privacy-copy">
                  <p>
                    Xelograph mengumpulkan aspirasi alumni untuk merencanakan reuni 2027. Konsep Fun
                    Reunion dan Bukber masih berupa rencana, bukan pengumuman acara resmi.
                  </p>
                  <h3>Data yang disimpan</h3>
                  <p>
                    Nama lengkap, panggilan, WhatsApp, konfigurasi avatar, persetujuan, dan jawaban
                    survei. WhatsApp dan pesan hanya tersedia bagi panitia berwenang.
                  </p>
                  <h3>Avatar yang menetap</h3>
                  <p>
                    Jika kamu setuju, nama panggilan, avatar, area, dan badge partisipasi tampil
                    kepada pengunjung setelah survei selesai. Avatar bukan indikator sedang online.
                    Kamu bisa menarik izin tampil melalui Reunion Pass.
                  </p>
                  <h3>Akses & penghapusan</h3>
                  <p>
                    Simpan kode undanganmu secara pribadi untuk melanjutkan dari perangkat lain.
                    Untuk koreksi identitas, kode hilang, atau penghapusan data, hubungi panitia
                    yang memberimu undangan. Pengelola dan masa penyimpanan harus ditetapkan panitia
                    sebelum peluncuran publik.
                  </p>
                  <div className="note">
                    Mode 1 · Persistent Alumni World. Gerakan pemain berjalan di perangkatnya
                    sendiri. Tidak ada sinkronisasi multiplayer.
                  </div>
                </div>
              </>
            )}
            {modal === 'pass' && profile && (
              <>
                <div className="dialog-eyebrow">
                  <Flag size={16} /> {profile.completedAt ? 'YOUR REUNION PASS' : 'YOUR CHARACTER'}
                </div>
                <div className="reunion-pass">
                  <span className="section-index">XEL / REUNION 2027</span>
                  <div className="pass-avatar">
                    <Preview config={profile.avatar} />
                  </div>
                  <h2>{profile.nickname}</h2>
                  <p>
                    {profile.completedAt
                      ? 'Satu nama. Banyak kenangan. Sampai bertemu kembali.'
                      : 'Perjalananmu sedang berlangsung.'}
                  </p>
                  <div className="pass-details">
                    <span>
                      RENCANA PILIHAN
                      <b>{LABELS[profile.answers.concept as string] || 'Belum dipilih'}</b>
                    </span>
                    <span>
                      KEHADIRAN
                      <b>
                        {(
                          {
                            yes: 'Ingin hadir',
                            maybe: 'Mungkin hadir',
                            no: 'Belum bisa hadir',
                          } as Record<string, string>
                        )[profile.answers.attendance as string] || 'Belum dipilih'}
                      </b>
                    </span>
                    <span>
                      PARTISIPASI
                      <b>{LABELS[profile.answers.committee as string] || 'Belum dipilih'}</b>
                    </span>
                  </div>
                  <div className="pass-stamp">
                    {profile.completedAt ? 'JOURNEY COMPLETE' : 'JOURNEY IN PROGRESS'}
                    <b>{profile.progress.length} / 7 CHECKPOINTS</b>
                  </div>
                </div>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={profile.consentPublic}
                    onChange={async (e) => {
                      try {
                        const p = await api<Profile>('/profile', {
                          method: 'PATCH',
                          body: JSON.stringify({ consentPublic: e.target.checked }),
                        });
                        setProfile(p);
                        refresh();
                      } catch (e) {
                        setToast((e as Error).message);
                      }
                    }}
                  />
                  Tampilkan avatar dan nama panggilanku di dunia alumni.
                </label>
                <div className="dialog-actions">
                  <button
                    className="text-button"
                    onClick={async () => {
                      try {
                        await api('/logout', { method: 'POST' });
                        setProfile(null);
                        setModal(null);
                      } catch (e) {
                        setToast((e as Error).message);
                      }
                    }}
                  >
                    <LogOut size={16} /> Keluar
                  </button>
                  <button
                    className="primary"
                    onClick={() => {
                      download('xelograph-reunion-pass.svg', passSvg(profile), 'image/svg+xml');
                      setToast('Reunion pass berhasil diunduh.');
                    }}
                  >
                    <Download size={16} /> Simpan pass
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Join({
  demo,
  onDone,
  onResume,
}: {
  demo: boolean;
  onDone: (p: Profile) => void;
  onResume: () => void;
}) {
  const [avatar, setAvatar] = useState<AvatarConfig>(DEFAULT_AVATAR),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <>
      <div className="dialog-eyebrow">
        <Leaf size={16} /> EVERY STORY STARTS WITH YOU
      </div>
      <h2>Hai, teman lama.</h2>
      <p className="dialog-description">
        Buat versi kecil dirimu. Mari masuk ke cerita berikutnya.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          const f = new FormData(e.currentTarget);
          try {
            onDone(
              await api('/join', {
                method: 'POST',
                body: JSON.stringify({
                  fullName: f.get('fullName'),
                  nickname: f.get('nickname'),
                  whatsapp: f.get('whatsapp'),
                  invitation: f.get('invitation'),
                  avatar,
                  consentData: f.has('consentData'),
                  consentPublic: f.has('consentPublic'),
                }),
              }),
            );
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="creator-grid">
          <div className="creator-left">
            <div className="creator-avatar">
              <Preview config={avatar} />
              <span>YOUR LITTLE SELF</span>
            </div>
            <div className="avatar-options">
              <label>Warna pakaian</label>
              <div className="swatches">
                {(['sage', 'clay', 'navy', 'cream'] as const).map((v) => (
                  <button
                    type="button"
                    key={v}
                    aria-label={'Pakaian ' + v}
                    aria-pressed={avatar.outfit === v}
                    className={avatar.outfit === v ? 'chosen' : ''}
                    style={{ background: COLORS[v] }}
                    onClick={() => setAvatar({ ...avatar, outfit: v })}
                  >
                    {avatar.outfit === v && <Check size={15} />}
                  </button>
                ))}
              </div>
              <label>Warna kulit</label>
              <div className="swatches">
                {(['light', 'warm', 'deep'] as const).map((v) => (
                  <button
                    type="button"
                    key={v}
                    aria-label={'Warna kulit ' + v}
                    aria-pressed={avatar.skin === v}
                    className={avatar.skin === v ? 'chosen' : ''}
                    style={{ background: COLORS[v] }}
                    onClick={() => setAvatar({ ...avatar, skin: v })}
                  >
                    {avatar.skin === v && <Check size={15} />}
                  </button>
                ))}
              </div>
              <label>Gaya rambut</label>
              <div className="hair-options">
                {(['short', 'bob', 'cap'] as const).map((v) => (
                  <button
                    type="button"
                    key={v}
                    aria-pressed={avatar.hair === v}
                    className={avatar.hair === v ? 'selected' : ''}
                    onClick={() => setAvatar({ ...avatar, hair: v })}
                  >
                    {{ short: 'Pendek', bob: 'Bob', cap: 'Topi' }[v]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="field">
              Nama lengkap
              <input
                name="fullName"
                autoComplete="name"
                required
                minLength={3}
                maxLength={100}
                placeholder="Nama yang dulu ada di absensi"
              />
            </label>
            <label className="field">
              Nama panggilan
              <input
                name="nickname"
                required
                maxLength={24}
                placeholder="Teman-teman memanggilmu…"
              />
            </label>
            <label className="field">
              Nomor WhatsApp
              <input
                name="whatsapp"
                type="tel"
                autoComplete="tel"
                required
                placeholder="08xxxxxxxxxx"
              />
              <small>Hanya terlihat oleh panitia. Tidak tampil di dunia.</small>
            </label>
            <label className="field">
              Kode undangan
              <input
                name="invitation"
                autoComplete="off"
                required
                placeholder={demo ? 'Uji lokal: XEL-DEMO' : 'Kode pribadi dari panitia'}
              />
              <small>
                {demo
                  ? 'Kode demo hanya untuk uji di perangkat ini.'
                  : 'Simpan kode ini untuk masuk kembali di perangkat lain.'}
              </small>
            </label>
            <label className="checkbox">
              <input name="consentData" type="checkbox" required />
              Saya setuju data digunakan panitia untuk perencanaan reuni Xelograph.
            </label>
            <label className="checkbox">
              <input name="consentPublic" type="checkbox" />
              Tampilkan nama panggilan dan avatarku kepada pengunjung setelah selesai.
            </label>
          </div>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="text-button" onClick={onResume}>
            Sudah pernah masuk?
          </button>
          <button className="primary" disabled={busy}>
            {busy ? <LoaderCircle size={17} className="spin" /> : <ArrowRight size={17} />}{' '}
            {busy ? 'Menyiapkan karaktermu…' : 'Mulai petualangan'}
          </button>
        </div>
      </form>
    </>
  );
}
function Resume({ onDone, onJoin }: { onDone: (p: Profile) => void; onJoin: () => void }) {
  const [code, setCode] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <>
      <div className="dialog-eyebrow">
        <Route size={16} /> PICK UP WHERE YOU LEFT OFF
      </div>
      <h2>
        Selamat datang
        <br />
        kembali.
      </h2>
      <p className="dialog-description">
        Masukkan kode undangan pribadi yang kamu pakai saat pertama masuk.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            onDone(
              await api('/resume', { method: 'POST', body: JSON.stringify({ invitation: code }) }),
            );
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          Kode undangan
          <input
            required
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="XEL-…"
          />
        </label>
        <p className="helper">
          Kode demo tidak mendukung pemulihan lintas perangkat. Gunakan sesi browser yang sama, atau
          minta kode pribadi dari panitia.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="text-button" onClick={onJoin}>
            Buat karakter baru
          </button>
          <button className="primary" disabled={busy}>
            {busy ? 'Memeriksa…' : 'Lanjutkan cerita'}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </>
  );
}
function passSvg(p: Profile) {
  const esc = (s: string) =>
    s.replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
    );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960"><rect width="720" height="960" rx="32" fill="#f4f1e7"/><rect x="28" y="28" width="664" height="904" rx="20" fill="none" stroke="#314b40"/><text x="60" y="98" font-family="sans-serif" font-size="26" fill="#314b40">xelograph / REUNION 2027</text><circle cx="360" cy="310" r="120" fill="${COLORS[p.avatar.outfit]}"/><text x="360" y="342" text-anchor="middle" font-size="90" font-family="sans-serif" fill="#fff">${esc(p.nickname[0].toUpperCase())}</text><text x="360" y="510" text-anchor="middle" font-size="44" font-family="sans-serif" fill="#314b40">${esc(p.nickname)}</text><text x="360" y="570" text-anchor="middle" font-size="20" font-family="sans-serif" fill="#314b40">${esc(LABELS[p.answers.concept as string] || 'Cerita sedang dimulai')}</text><path d="M60 630H660" stroke="#c4cbb9"/><text x="360" y="710" text-anchor="middle" font-size="20" font-family="sans-serif" fill="#314b40">${p.completedAt ? 'JOURNEY COMPLETE' : 'JOURNEY IN PROGRESS'} · ${p.progress.length}/7</text><text x="360" y="820" text-anchor="middle" font-size="19" font-family="sans-serif" fill="#314b40">Tempat lama. Cerita baru.</text><text x="360" y="865" text-anchor="middle" font-size="14" font-family="sans-serif" fill="#6b7568">Pass survei aspirasi · Bukan tiket acara</text></svg>`;
}
