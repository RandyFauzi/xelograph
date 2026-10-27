import { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
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
import { CREATOR_MONUMENT } from './game/creatorMonument.mjs';
import { KOLAM_BECABUR } from './game/kolamBecabur.mjs';
import { GEROBAK_PENTOL, PAKLE_DIALOGUES } from './game/gerobakPentol.mjs';
import ShopModal from './game/ShopModal';
import AvatarOptions from './AvatarOptions';
import { api, download } from './api';
import {
  CHECKPOINTS,
  COLORS,
  DEFAULT_AVATAR,
  LABELS,
  type AvatarConfig,
  type Profile,
  type Alumnus,
  type OnlinePeer,
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
  | 'join'
  | 'resume'
  | 'survey'
  | 'pass'
  | 'privacy'
  | 'quests'
  | 'alumni'
  | 'settings'
  | 'creator'
  | 'kolam'
  | 'pentol'
  | 'shop'
  | 'avatar'
  | null;
export default function App() {
  const [audioPrefs, setAudioPrefs] = useState<AudioPreferences>(loadAudioPreferences),
    [entered, setEntered] = useState(false),
    [overview, setOverview] = useState(false),
    [travel, setTravel] = useState<TravelRequest | null>(null),
    [modal, setModal] = useState<Modal>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [guestIdentity, setGuestIdentity] = useState<{ nickname: string; avatar: AvatarConfig }>(() => {
      try {
        const raw = localStorage.getItem('xel-guest-identity');
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            nickname: typeof parsed?.nickname === 'string' ? parsed.nickname.slice(0, 24) : '',
            avatar: parsed?.avatar ? { ...DEFAULT_AVATAR, ...parsed.avatar } : DEFAULT_AVATAR,
          };
        }
      } catch {}
      return { nickname: '', avatar: DEFAULT_AVATAR };
    }),
    [alumni, setAlumni] = useState<Alumnus[]>([]),
    [onlineCount, setOnlineCount] = useState(1),
    [onlinePeers, setOnlinePeers] = useState<OnlinePeer[]>([]),
    playerPositionRef = useRef<{
      x: number;
      z: number;
      vx?: number;
      vz?: number;
      moving?: boolean;
    }>({ x: 0, z: 14, vx: 0, vz: 0, moving: false }),
    presenceMetaRef = useRef({
      nickname: 'Teman Alumni',
      avatar: DEFAULT_AVATAR,
      alumniId: null as string | null,
      entered: false,
    }),
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
          setDemo(config.demo && !config.registrationOpen);
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
  const updateGuestIdentity = useCallback(
    (next: { nickname: string; avatar: AvatarConfig }) => {
      setGuestIdentity(next);
      try {
        localStorage.setItem('xel-guest-identity', JSON.stringify(next));
      } catch {}
    },
    [],
  );
  useEffect(() => {
    presenceMetaRef.current = {
      nickname: profile?.nickname || guestIdentity.nickname.trim() || 'Teman Alumni',
      avatar: profile?.avatar || guestIdentity.avatar || DEFAULT_AVATAR,
      alumniId: profile?.id || null,
      entered,
    };
  }, [profile, guestIdentity, entered]);
  useEffect(() => {
    let alive = true;
    let inFlight = false;
    let vid = '';
    try {
      vid = sessionStorage.getItem('xel-visitor-id') || '';
      if (!vid) {
        vid =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessionStorage.setItem('xel-visitor-id', vid);
      }
    } catch {
      vid = 'anon-' + Math.random().toString(36).slice(2);
    }
    const ping = async () => {
      if (document.hidden || inFlight) return;
      inFlight = true;
      try {
        const res = await api<{ online: number; peers?: OnlinePeer[] }>('/presence', {
          method: 'POST',
          body: JSON.stringify({
            visitorId: vid,
            nickname: presenceMetaRef.current.nickname,
            avatar: presenceMetaRef.current.avatar,
            alumniId: presenceMetaRef.current.alumniId,
            playing: presenceMetaRef.current.entered,
            x: playerPositionRef.current.x,
            z: playerPositionRef.current.z,
            vx: playerPositionRef.current.vx || 0,
            vz: playerPositionRef.current.vz || 0,
            moving: Boolean(playerPositionRef.current.moving),
          }),
        });
        if (!alive) return;
        if (typeof res?.online === 'number') setOnlineCount(Math.max(1, res.online));
        if (Array.isArray(res?.peers)) setOnlinePeers(res.peers.slice(0, 5));
      } catch {
      } finally {
        inFlight = false;
      }
    };
    void ping();
    const interval = setInterval(ping, 850);
    const onVisibility = () => {
      if (!document.hidden) void ping();
    };
    const onLeave = () => {
      try {
        const blob = new Blob([JSON.stringify({ visitorId: vid, leave: true })], {
          type: 'application/json',
        });
        navigator.sendBeacon?.('/api/presence', blob);
      } catch {}
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onLeave);
    return () => {
      alive = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onLeave);
    };
  }, []);
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
      campusAudio.visibility(document.hidden);
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
        guestNickname={guestIdentity.nickname.trim() || undefined}
        guestAvatar={guestIdentity.avatar}
        alumni={alumni}
        onlineCount={onlineCount}
        onlinePeers={onlinePeers}
        playerPositionRef={playerPositionRef}
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
            className={
              'modal ' +
              (modal === 'join' || modal === 'avatar' || modal === 'kolam' || modal === 'shop'
                ? 'wide'
                : '')
            }
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === 'avatar'
                ? 'Pengaturan karakter tersimpan'
                : modal === 'creator'
                  ? 'Dibuat oleh Randy Fauzi'
                  : modal === 'kolam'
                    ? 'Kenangan Kolam Becabur'
                    : modal === 'pentol'
                      ? 'Pentol Bakwan Pakle'
                      : modal === 'shop'
                        ? 'Shop Toko Avatar'
                        : modal === 'survey'
                      ? CHECKPOINTS[index].name
                      : modal === 'join'
                        ? 'Buat karakter'
                        : modal === 'pass'
                          ? 'Reunion pass'
                          : 'Xylograph'
            }
          >
            <button
              className="modal-close"
              aria-label="Tutup dialog"
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            {modal === 'avatar' && profile && (
              <AvatarSettings
                key={profile.id + ':' + profile.avatarRevision}
                profile={profile}
                onSaved={(saved) => {
                  setProfile(saved);
                  void refresh();
                  setModal('pass');
                  setToast(
                    'Karakter tersimpan. Preview, pemain, dan avatar alumni memakai pengaturan yang sama.',
                  );
                }}
              />
            )}
            {modal === 'creator' && (
              <div className="creator-credit">
                <img
                  src={CREATOR_MONUMENT.asset}
                  alt="Monumen Dibuat Oleh Randy Fauzi"
                  width="144"
                  height="144"
                />
                <div className="dialog-eyebrow">BEHIND THIS LITTLE WORLD</div>
                <h2>
                  Dibuat oleh
                  <br />
                  Randy Fauzi.
                </h2>
                <p>
                  Dunia kecil ini dibuat dengan ide, kode, dan sedikit nostalgia. Punya ide dunia
                  interaktif atau website sendiri?
                </p>
                <a
                  className="primary"
                  href={CREATOR_MONUMENT.portfolio}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Mau buat seperti ini juga? <ArrowRight size={17} />
                </a>
                <small>Portofolio Randy · terbuka di tab baru</small>
              </div>
            )}
            {modal === 'kolam' && (
              <div className="kolam-showcase">
                <div className="kolam-showcase-header">
                  <img
                    src={KOLAM_BECABUR.preview}
                    alt="Miniatur 3D Kolam Becabur"
                    width="72"
                    height="72"
                  />
                  <div>
                    <div className="dialog-eyebrow">SPOT KENANGAN · KOLAM SEBELAH KANAN</div>
                    <h2>
                      Kolam
                      <br />
                      <em>Becabur.</em>
                    </h2>
                  </div>
                </div>
                <p className="dialog-description">
                  Salah satu sudut paling ikonik yang penuh tawa dan cerita tak terlupakan. Putar
                  kembali momen seru cebur kolam bersama teman-teman.
                </p>
                <div className="kolam-video-frame">
                  <video
                    src={KOLAM_BECABUR.video}
                    poster={KOLAM_BECABUR.preview}
                    controls
                    autoPlay
                    playsInline
                    preload="metadata"
                    onPlay={() => campusAudio.visibility(true)}
                    onPause={() => campusAudio.visibility(document.hidden)}
                    onEnded={() => campusAudio.visibility(document.hidden)}
                  >
                    Browser kamu belum mendukung pemutar video langsung.
                  </video>
                </div>
                <div className="kolam-drive-cta">
                  <p>
                    Teman-teman yang masih punya video lama yang lucu-lucu bisa langsung kirim &amp;
                    upload sendiri ke sini ya!
                  </p>
                  <div className="kolam-showcase-actions">
                    <a
                      className="kolam-drive-button"
                      href={KOLAM_BECABUR.driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Upload Video ke Google Drive <ArrowRight size={16} />
                    </a>
                    <button
                      type="button"
                      className="primary"
                      onClick={() => {
                        campusAudio.visibility(document.hidden);
                        setModal(null);
                      }}
                    >
                      Lanjutkan menjelajah <ArrowRight size={17} />
                    </button>
                  </div>
                </div>
              </div>
            )}
            {modal === 'pentol' && (
              <PakleNpcDialog
                nickname={profile?.nickname || guestIdentity.nickname || 'Teman Alumni'}
                onClose={() => setModal(null)}
              />
            )}
            {modal === 'shop' && (
              <ShopModal
                profile={profile}
                onProfileUpdate={(updated) => {
                  setProfile(updated);
                  void refresh();
                }}
                onToast={setToast}
                onClose={() => setModal(null)}
                onJoin={() => setModal('join')}
              />
            )}
            {modal === 'quests' && (
              <QuestJournal profile={profile} onCheckpoint={openCheckpoint} onTravel={goTo} />
            )}
            {modal === 'alumni' && (
              <AlumniDirectory
                alumni={alumni}
                onlineCount={onlineCount}
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
                initialIdentity={guestIdentity}
                onDraftIdentity={updateGuestIdentity}
                onDone={(p) => {
                  setProfile(p);
                  updateGuestIdentity({ nickname: p.nickname, avatar: p.avatar });
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
                onExplore={() => {
                  setEntered(true);
                  setModal(null);
                  setToast('Jawaban survei sebelumnya sudah tercatat. Selamat menjelajah!');
                }}
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
                    Xylograph mengumpulkan aspirasi alumni untuk merencanakan reuni 2027. Konsep Fun
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
                    Progres dapat dilanjutkan dari browser yang sama selama sesi masih tersimpan.
                    Untuk pindah perangkat, koreksi identitas, atau penghapusan data, hubungi
                    panitia. Pengelola dan masa penyimpanan harus ditetapkan panitia sebelum
                    peluncuran publik.
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
                <button
                  className="primary edit-avatar-button"
                  onClick={async () => {
                    try {
                      const current = await api<Profile>('/me');
                      setProfile(current);
                      setModal('avatar');
                    } catch (error) {
                      setToast((error as Error).message);
                    }
                  }}
                >
                  Ubah karakter <ArrowRight size={17} />
                </button>
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
                    onClick={() => {
                      setEntered(false);
                      setModal(null);
                    }}
                  >
                    <LogOut size={16} /> Kembali ke menu
                  </button>
                  <button
                    className="primary"
                    onClick={() => {
                      download('xylograph-reunion-pass.svg', passSvg(profile), 'image/svg+xml');
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
function AvatarSettings({
  profile,
  onSaved,
}: {
  profile: Profile;
  onSaved: (profile: Profile) => void;
}) {
  const [avatar, setAvatar] = useState<AvatarConfig>(profile.avatar);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <>
      <div className="dialog-eyebrow">
        <Leaf size={16} /> YOUR SAVED CHARACTER
      </div>
      <h2>Karakterku.</h2>
      <p className="dialog-description">
        Pilih model dan warna. Setelah disimpan, karakter ini dipakai saat bermain, kembali masuk,
        dan muncul di dunia alumni.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          try {
            onSaved(
              await api<Profile>('/avatar', {
                method: 'PATCH',
                body: JSON.stringify({ avatar, expectedRevision: profile.avatarRevision }),
              }),
            );
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset className="avatar-editor-fields" disabled={busy}>
          <div className="creator-grid avatar-editor-grid">
            <div className="creator-avatar">
              <Preview config={avatar} />
              <span>PREVIEW KARAKTER</span>
            </div>
            <AvatarOptions avatar={avatar} setAvatar={setAvatar} />
          </div>
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="helper">
          Tersimpan di database · versi {profile.avatarRevision}. Perubahan pada preview baru
          disimpan setelah menekan tombol di bawah.
        </p>
        <div className="dialog-actions">
          <button className="primary" disabled={busy}>
            {busy ? 'Menyimpan…' : 'Simpan karakter'}
            <Check size={17} />
          </button>
        </div>
      </form>
    </>
  );
}
function Join({
  initialIdentity,
  onDraftIdentity,
  onDone,
  onResume,
  onExplore,
}: {
  initialIdentity: { nickname: string; avatar: AvatarConfig };
  onDraftIdentity: (identity: { nickname: string; avatar: AvatarConfig }) => void;
  onDone: (p: Profile) => void;
  onResume: () => void;
  onExplore: () => void;
}) {
  const [avatar, setAvatar] = useState<AvatarConfig>(initialIdentity.avatar || DEFAULT_AVATAR),
    [nickname, setNickname] = useState(initialIdentity.nickname || ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [imported, setImported] = useState(false);
  const handleAvatarChange = (nextAvatar: AvatarConfig) => {
    setAvatar(nextAvatar);
    onDraftIdentity({ nickname, avatar: nextAvatar });
  };
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
          const nick = String(f.get('nickname') || '').trim();
          onDraftIdentity({ nickname: nick, avatar });
          setImported(false);
          try {
            onDone(
              await api('/join', {
                method: 'POST',
                body: JSON.stringify({
                  fullName: f.get('fullName'),
                  nickname: nick,
                  whatsapp: f.get('whatsapp'),
                  avatar,
                  consentData: f.has('consentData'),
                  consentPublic: f.has('consentPublic'),
                }),
              }),
            );
          } catch (err) {
            if ((err as { code?: string }).code === 'legacy_registered') {
              setImported(true);
              setError('');
            } else setError((err as Error).message);
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
            <AvatarOptions avatar={avatar} setAvatar={handleAvatarChange} />
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
                value={nickname}
                onChange={(e) => {
                  const val = e.target.value;
                  setNickname(val);
                  onDraftIdentity({ nickname: val, avatar });
                }}
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
            <p className="helper">
              Progres tersimpan otomatis setelah kamu menyimpan jawaban. Gunakan browser yang sama
              untuk melanjutkan.
            </p>
            <label className="checkbox">
              <input name="consentData" type="checkbox" required />
              Saya setuju data digunakan panitia untuk perencanaan reuni Xylograph.
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
        {imported && (
          <div className="note">
            <p>Jawaban survei sebelumnya sudah tercatat. Kamu tidak perlu mengisi ulang.</p>
            <button type="button" className="primary" onClick={onExplore}>
              Sudah tercatat · Jelajahi dunia <ArrowRight size={17} />
            </button>
          </div>
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
  const [error, setError] = useState(''),
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
        Lanjutkan petualangan dari browser yang kamu gunakan saat membuat karakter.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            onDone(await api('/me'));
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="helper">
          Progres tersimpan di server dan dikenali melalui sesi browser ini. Jika sesi sudah hilang
          atau kamu berpindah perangkat, hubungi panitia untuk bantuan.
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
function PakleNpcDialog({
  nickname,
  onClose,
}: {
  nickname: string;
  onClose: () => void;
}) {
  const [lineIndex, setLineIndex] = useState(0);
  const greetingName =
    nickname && nickname !== 'Teman Alumni' ? `Nak ${nickname}` : 'Bosku';

  return (
    <div className="pakle-npc-dialog">
      <div className="pakle-npc-header">
        <img
          src={GEROBAK_PENTOL.preview}
          alt="Gerobak Pentol Bakwan Pakle"
          width="88"
          height="88"
        />
        <div>
          <div className="dialog-eyebrow">NPC · DEPAN GERBANG SEKOLAH</div>
          <h2>
            Pentol Bakwan
            <br />
            <em>Pakle.</em>
          </h2>
        </div>
      </div>

      <div className="pakle-speech-bubble" role="status">
        <span className="pakle-speaker-tag">Pakle menyapa {greetingName}:</span>
        <p>{PAKLE_DIALOGUES[lineIndex % PAKLE_DIALOGUES.length]}</p>
      </div>

      <div className="pakle-npc-actions">
        <button
          type="button"
          className="pakle-talk-button"
          onClick={() => setLineIndex((i) => (i + 1) % PAKLE_DIALOGUES.length)}
        >
          Dengar cerita Pakle lagi ({(lineIndex % PAKLE_DIALOGUES.length) + 1}/
          {PAKLE_DIALOGUES.length})
        </button>
        <button type="button" className="primary" onClick={onClose}>
          Lanjut jalan <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}

function passSvg(p: Profile) {
  const esc = (s: string) =>
    s.replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
    );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960"><rect width="720" height="960" rx="32" fill="#f4f1e7"/><rect x="28" y="28" width="664" height="904" rx="20" fill="none" stroke="#314b40"/><text x="60" y="98" font-family="sans-serif" font-size="26" fill="#314b40">xylograph / REUNION 2027</text><circle cx="360" cy="310" r="120" fill="${COLORS[p.avatar.outfit]}"/><text x="360" y="342" text-anchor="middle" font-size="90" font-family="sans-serif" fill="#fff">${esc(p.nickname[0].toUpperCase())}</text><text x="360" y="510" text-anchor="middle" font-size="44" font-family="sans-serif" fill="#314b40">${esc(p.nickname)}</text><text x="360" y="570" text-anchor="middle" font-size="20" font-family="sans-serif" fill="#314b40">${esc(LABELS[p.answers.concept as string] || 'Cerita sedang dimulai')}</text><path d="M60 630H660" stroke="#c4cbb9"/><text x="360" y="710" text-anchor="middle" font-size="20" font-family="sans-serif" fill="#314b40">${p.completedAt ? 'JOURNEY COMPLETE' : 'JOURNEY IN PROGRESS'} · ${p.progress.length}/7</text><text x="360" y="820" text-anchor="middle" font-size="19" font-family="sans-serif" fill="#314b40">Tempat lama. Cerita baru.</text><text x="360" y="865" text-anchor="middle" font-size="14" font-family="sans-serif" fill="#6b7568">Pass survei aspirasi · Bukan tiket acara</text></svg>`;
}
