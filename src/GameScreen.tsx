import { lazy, Suspense, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Compass,
  Flag,
  Fullscreen,
  Leaf,
  Lock,
  Map,
  Navigation,
  Route,
  Search,
  Settings,
  Shield,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  CHECKPOINTS,
  DEFAULT_AVATAR,
  type AvatarConfig,
  type Profile,
  type Alumnus,
  type OnlinePeer,
} from './types';
import type { AudioPreferences } from './game/audio';
import AvatarPortrait from './AvatarPortrait';
import { ICONS } from './Survey';
import ChatRoom from './game/ChatRoom';
import { useChat } from './game/useChat';
const World = lazy(() => import('./World'));
export type TravelRequest = { index: number; nonce: number };
export function GameScreen({
  profile,
  guestNickname,
  guestAvatar,
  alumni,
  onlineCount = 1,
  onlinePeers = [],
  playerPositionRef,
  demo,
  entered,
  paused,
  ready,
  light,
  travel,
  focusId,
  overview,
  onOverview,
  audioEnabled,
  onAudioToggle,
  onEnter,
  onJoin,
  onResume,
  onPanel,
  onCheckpoint,
  onTravel,
  onError,
}: {
  profile: Profile | null;
  guestNickname?: string;
  guestAvatar?: AvatarConfig;
  alumni: Alumnus[];
  onlineCount?: number;
  onlinePeers?: OnlinePeer[];
  playerPositionRef?: React.RefObject<{
    x: number;
    z: number;
    vx?: number;
    vz?: number;
    moving?: boolean;
  }>;
  demo: boolean;
  entered: boolean;
  paused: boolean;
  ready: boolean;
  light: boolean;
  travel: TravelRequest | null;
  focusId: string | null;
  overview: boolean;
  onOverview: () => void;
  audioEnabled: boolean;
  onAudioToggle: () => void;
  onEnter: () => void;
  onJoin: () => void;
  onResume: () => void;
  onPanel: (
    panel: 'quests' | 'alumni' | 'settings' | 'pass' | 'creator' | 'kolam' | 'pentol' | 'shop',
  ) => void;
  onCheckpoint: (i: number) => void;
  onTravel: (i: number) => void;
  onError: (message: string) => void;
}) {
  const chat = useChat({
    profile,
    guestNickname,
    enabled: entered,
  });
  const next = profile ? CHECKPOINTS.findIndex((_, i) => !profile.progress.includes(i)) : 0;
  const quest = CHECKPOINTS[next < 0 ? 6 : next];
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen();
      else onError('Gunakan Tambahkan ke layar utama pada menu browser untuk tampilan penuh.');
    } catch {
      onError('Layar penuh tidak tersedia. Permainan tetap bisa dimainkan di browser.');
    }
  };
  return (
    <div className={'game-screen ' + (!entered ? 'at-title' : 'is-playing')}>
      <div className="game-viewport">
        {light ? (
          <div className="light-game">
            <Leaf size={36} />
            <h2>Perjalanan Xylograph</h2>
            <p>Pilih misi untuk melanjutkan cerita.</p>
            <div>
              {CHECKPOINTS.map((c, i) => (
                <button key={i} disabled={next >= 0 && i > next} onClick={() => onCheckpoint(i)}>
                  <span>
                    {profile?.progress.includes(i) ? (
                      <Check size={16} />
                    ) : (
                      String(i + 1).padStart(2, '0')
                    )}
                  </span>
                  {c.name}
                  <ArrowRight size={17} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="game-loading">
                <span className="loading-emblem">x</span>
                <p>Menyiapkan dunia reuni…</p>
              </div>
            }
          >
            <World
              avatar={profile?.avatar || guestAvatar || DEFAULT_AVATAR}
              nickname={profile?.nickname || guestNickname}
              alumni={alumni}
              onlinePeers={onlinePeers}
              activeBubbles={chat.activeBubbles}
              playerPositionRef={playerPositionRef}
              progress={profile?.progress || []}
              onCheckpoint={onCheckpoint}
              active={entered && !paused && !overview}
              playing={entered}
              demo={demo}
              focusId={focusId}
              travel={travel}
              registered={!!profile}
              overview={overview}
              onNavigate={onTravel}
              onOverview={onOverview}
              onCreator={() => onPanel('creator')}
              onKolam={() => onPanel('kolam')}
              onPentol={() => onPanel('pentol')}
              onShop={() => onPanel('shop')}
            />
          </Suspense>
        )}
      </div>
      <div className="game-vignette" />
      {!entered ? (
        <>
          <div className="title-shade" />
          <header className="title-header">
            <span className="game-logo">
              xylograph<span>REUNION WORLD</span>
            </span>
            <span className="game-edition">A WORLD THAT REMEMBERS YOU</span>
            <button
              className="game-icon"
              aria-label="Pengaturan permainan"
              onClick={() => onPanel('settings')}
            >
              <Settings size={19} />
            </button>
          </header>
          <section className="title-menu">
            <span className="title-kicker">
              <span /> PULANG SEJENAK. BERTEMU KEMBALI.
            </span>
            <h1>
              Say Haii
              <br />
              <em>Again.</em>
            </h1>
            <p>
              Jalan-jalan di sekolah lama, temukan teman,
              <br />
              dan ikut menentukan reuni berikutnya.
            </p>
            <div className="title-buttons">
              <button
                className="play-button"
                onClick={profile ? onEnter : onJoin}
                disabled={!ready}
              >
                {!ready
                  ? 'Menyiapkan dunia…'
                  : profile
                    ? 'Lanjutkan petualangan'
                    : 'Mulai petualangan'}
                <ArrowRight size={21} />
              </button>
              <button className="explore-button" onClick={onEnter}>
                Jelajahi dulu
                <Compass size={18} />
              </button>
              <div className="title-account-links">
                {!profile && (
                  <button className="title-resume" onClick={onResume}>
                    Sudah punya karakter? Lanjutkan cerita
                    <ArrowUpRight size={14} />
                  </button>
                )}
                <Link className="title-admin-link" href="/admin" prefetch={false}>
                  <Shield size={15} aria-hidden="true" />
                  Dashboard admin
                </Link>
              </div>
            </div>
            <div className="title-footnote">
              <span>
                <Route size={14} /> 7 misi kecil
              </span>
              <i />
              <span>
                <Users size={14} /> Teman yang menetap
              </span>
              <i />
              <span className="title-online-tag" role="status">
                <b className="hud-online-dot" /> {onlineCount} sedang online
              </span>
            </div>
          </section>
          <div className="title-world-caption">
            <span className="caption-rule" />
            <small>SEKOLAH LAMA, KENANGAN YANG SAMA.</small>
            <b>Xylograph Reunion World</b>
            <span>Taman sekolah · Edisi 2027</span>
          </div>
          <div className="title-bottom">
            <span>MODE 01 / PERSISTENT ALUMNI WORLD</span>
            <span>Satu perjalanan. Tujuh cerita. Satu reuni.</span>
          </div>
        </>
      ) : (
        <>
          <header className="game-hud">
            <button
              className="player-card"
              onClick={() => (profile ? onPanel('pass') : onJoin())}
              aria-label={profile ? 'Lihat profil dan reunion pass' : 'Buat karakter sendiri'}
            >
              <span className="hud-portrait">
                <AvatarPortrait config={profile?.avatar || guestAvatar || DEFAULT_AVATAR} />
              </span>
              <span>
                <small>{profile ? 'SELAMAT DATANG KEMBALI' : 'SEDANG MENJELAJAH'}</small>
                <b>{profile?.nickname || guestNickname || 'Teman baru'}</b>
                <em>
                  {profile?.completedAt
                    ? 'Alumni · cerita tersimpan'
                    : profile
                      ? 'Alumni Xylograph'
                      : 'Buat karakter untuk menyimpan cerita'}
                </em>
              </span>
              <span className="player-level">
                {profile?.progress.length || 0}
                <small>/7</small>
              </span>
            </button>
            <div className="game-location">
              <Compass size={17} />
              <span>
                Xylograph<small>SCHOOL & GARDENS</small>
              </span>
            </div>
            <nav className="hud-actions" aria-label="Menu permainan">
              <button
                type="button"
                className="hud-online-pill"
                aria-label={`${onlineCount} orang sedang online sekarang`}
                title={`${onlineCount} orang sedang online sekarang`}
                onClick={() => onPanel('alumni')}
              >
                <span className="hud-online-dot" />
                <b>{onlineCount}</b>
                <span>online</span>
              </button>
              <button
                className="game-icon"
                aria-label="Temukan teman alumni"
                onClick={() => onPanel('alumni')}
              >
                <Users size={20} />
                <span>{alumni.length}</span>
              </button>
              <button
                className="game-icon"
                aria-label="Pandangan seluruh kampus"
                aria-pressed={overview}
                onClick={onOverview}
              >
                <Map size={20} />
              </button>
              <button
                className="game-icon"
                aria-label={audioEnabled ? 'Matikan suara' : 'Aktifkan suara'}
                aria-pressed={audioEnabled}
                onClick={onAudioToggle}
              >
                {audioEnabled ? <Volume2 size={19} /> : <VolumeX size={19} />}
              </button>
              <button
                className="game-icon fullscreen-button"
                aria-label="Layar penuh"
                onClick={fullscreen}
              >
                <Fullscreen size={19} />
              </button>
              <button
                className="game-icon"
                aria-label="Pengaturan"
                onClick={() => onPanel('settings')}
              >
                <Settings size={19} />
              </button>
            </nav>
          </header>
          <aside className="quest-tracker">
            <div className="quest-track-heading">
              <span>
                <Flag size={12} />
                {profile?.completedAt ? 'PETUALANGAN SELESAI' : 'MISI UTAMA'}
              </span>
              <button onClick={() => onPanel('quests')} aria-label="Buka seluruh misi">
                •••
              </button>
            </div>
            <button className="tracked-quest" onClick={() => onTravel(next < 0 ? 6 : next)}>
              <span className="quest-diamond">
                {profile?.completedAt ? <Check size={16} /> : String(next + 1).padStart(2, '0')}
              </span>
              <span>
                <b>{profile?.completedAt ? 'Selamat datang di rumah.' : quest.name}</b>
                <small>
                  {profile?.completedAt ? 'Jelajahi dan temukan teman lamamu.' : quest.place}
                </small>
              </span>
              <ArrowRight size={16} />
            </button>
            <div className="quest-track-bottom">
              <div className="quest-beads">
                {CHECKPOINTS.map((_, i) => (
                  <i key={i} className={profile?.progress.includes(i) ? 'filled' : ''} />
                ))}
              </div>
              {!profile?.completedAt && (
                <button onClick={() => onTravel(next < 0 ? 6 : next)}>
                  <Navigation size={12} />
                  Tunjukkan jalan
                </button>
              )}
            </div>
          </aside>
          <div className="game-bottom-center">
            <span className="world-presence">
              <i />
              <b>{onlineCount} sedang online</b>
              <span>·</span>
              {alumni.length
                ? `${alumni.length} jejak alumni tersimpan`
                : 'Dunia kecil. Cerita yang menunggu.'}
            </span>
            <button className="journal-shortcut" onClick={() => onPanel('quests')}>
              <Map size={16} />
              <span>Buka peta & misi</span>
              <kbd>M</kbd>
            </button>
          </div>
          {!profile && (
            <button className="guest-create" onClick={onJoin}>
              Buat karakterku
              <ArrowUpRight size={16} />
            </button>
          )}
          <ChatRoom
            profile={profile}
            messages={chat.messages}
            unreadCount={chat.unreadCount}
            isOpen={chat.isOpen}
            sending={chat.sending}
            onToggleOpen={chat.toggleOpen}
            onSendMessage={chat.sendMessage}
            onJoin={onJoin}
          />
        </>
      )}
      {demo && <span className="game-demo">MODE UJI</span>}
    </div>
  );
}
export function QuestJournal({
  profile,
  onCheckpoint,
  onTravel,
}: {
  profile: Profile | null;
  onCheckpoint: (i: number) => void;
  onTravel: (i: number) => void;
}) {
  const next = profile ? CHECKPOINTS.findIndex((_, i) => !profile.progress.includes(i)) : 0;
  return (
    <>
      <div className="dialog-eyebrow">
        <Map size={16} /> JURNAL PETUALANGAN
      </div>
      <h2>
        Selangkah demi
        <br />
        <em>selangkah.</em>
      </h2>
      <p className="dialog-description">
        Pertanyaan muncul saat kamu mencapai area misi. Selesaikan satu cerita untuk membuka area
        berikutnya.
      </p>
      <div className="quest-journal">
        {CHECKPOINTS.map((c, i) => {
          const Icon = ICONS[i],
            done = profile?.progress.includes(i),
            locked = next >= 0 && i > next;
          return (
            <article
              key={i}
              className={(done ? 'quest-finished ' : '') + (locked ? 'quest-locked' : '')}
            >
              <span className="journal-symbol">
                {done ? <Check size={20} /> : locked ? <Lock size={19} /> : <Icon size={20} />}
              </span>
              <div>
                <small>
                  AREA 0{i + 1} · {locked ? 'BELUM TERBUKA' : c.place}
                </small>
                <h3>{c.name}</h3>
                <p>
                  {locked
                    ? 'Selesaikan cerita di area sebelumnya.'
                    : done
                      ? 'Kenangan tersimpan. Area sudah terbuka.'
                      : c.description}
                </p>
                {!locked && (
                  <div>
                    <button onClick={() => onTravel(i)}>
                      <Navigation size={13} />
                      Pergi ke lokasi
                    </button>
                    {done && (
                      <button onClick={() => onCheckpoint(i)}>
                        Lihat jawaban
                        <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
export function AlumniDirectory({
  alumni,
  onlineCount = 1,
  onFind,
}: {
  alumni: Alumnus[];
  onlineCount?: number;
  onFind: (a: Alumnus) => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = alumni.filter((a) => a.nickname.toLowerCase().includes(search.toLowerCase()));
  return (
    <>
      <div className="dialog-eyebrow">
        <Users size={16} /> TEMAN DALAM DUNIA INI
      </div>
      <h2>
        Wajah lama.
        <br />
        <em>Cerita yang baru.</em>
      </h2>
      <div className="alumni-online-banner" role="status">
        <span className="alumni-online-badge">
          <span className="hud-online-dot" />
          <b>{onlineCount} orang sedang online sekarang</b>
        </span>
        <small>{alumni.length} jejak alumni di dunia ini</small>
      </div>
      <label className="game-search">
        <Search size={17} />
        <input
          aria-label="Cari nama alumni"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Siapa yang kamu cari?"
        />
      </label>
      <div className="game-alumni-list">
        {filtered.map((a) => (
          <button key={a.id} onClick={() => onFind(a)}>
            <span className="friend-portrait">
              <AvatarPortrait config={a.avatar} />
            </span>
            <span>
              <b>{a.nickname}</b>
              <small>
                {a.group === 'crew'
                  ? 'Crew camp'
                  : a.group === 'supporter'
                    ? 'Supporter garden'
                    : 'Gathering plaza'}
              </small>
              <em>{a.badges.join(' · ')}</em>
            </span>
            <Navigation size={17} />
          </button>
        ))}
      </div>
      {!filtered.length && (
        <div className="game-empty">
          <Users size={32} />
          <h3>{alumni.length ? 'Belum ketemu namanya.' : 'Jadilah cerita pertama.'}</h3>
          <p>
            {alumni.length
              ? 'Coba cari nama panggilan yang lain.'
              : 'Selesaikan misi dan izinkan avatar tampil agar temanmu bisa menemukanmu di sini.'}
          </p>
        </div>
      )}
    </>
  );
}
export function GameSettings({
  light,
  audioPrefs,
  onAudioChange,
  onLight,
  onPrivacy,
  onTitle,
  onFullscreen,
}: {
  light: boolean;
  audioPrefs: AudioPreferences;
  onAudioChange: (prefs: AudioPreferences) => void;
  onLight: () => void;
  onPrivacy: () => void;
  onTitle: () => void;
  onFullscreen: () => void;
}) {
  return (
    <>
      <div className="dialog-eyebrow">
        <Settings size={16} /> MENU PERMAINAN
      </div>
      <h2>
        Istirahat
        <br />
        <em>sebentar.</em>
      </h2>
      <div className="settings-list">
        <Link className="settings-admin-link" href="/admin" prefetch={false}>
          <Shield size={20} aria-hidden="true" />
          <span>
            Dashboard admin<small>Lihat hasil survei dengan kode akses.</small>
          </span>
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
        <button onClick={onFullscreen}>
          <Fullscreen size={20} />
          <span>
            Layar penuh<small>Lebih dekat dengan duniamu.</small>
          </span>
          <ArrowUpRight size={17} />
        </button>
        <button onClick={onLight}>
          <Leaf size={20} />
          <span>
            {light ? 'Kembali ke dunia 3D' : 'Gunakan mode ringan'}
            <small>Semua misi tetap bisa dijawab.</small>
          </span>
          <ArrowRight size={17} />
        </button>
        <button onClick={onPrivacy}>
          <Shield size={20} />
          <span>
            Privasi & data<small>Pilihanmu, ceritamu.</small>
          </span>
          <ArrowRight size={17} />
        </button>
        <button onClick={onTitle}>
          <Compass size={20} />
          <span>
            Kembali ke menu awal<small>Jawaban yang disimpan tetap aman.</small>
          </span>
          <ArrowRight size={17} />
        </button>
      </div>
      <fieldset className="audio-settings">
        <legend>Suasana & suara</legend>
        <label className="audio-toggle">
          <span>Aktifkan audio</span>
          <input
            type="checkbox"
            checked={audioPrefs.enabled}
            onChange={(e) => onAudioChange({ ...audioPrefs, enabled: e.target.checked })}
          />
        </label>
        <label>
          Musik latar <output>{Math.round(audioPrefs.music * 100)}%</output>
          <input
            aria-label="Volume musik latar"
            type="range"
            min="0"
            max="100"
            value={Math.round(audioPrefs.music * 100)}
            onChange={(e) => onAudioChange({ ...audioPrefs, music: Number(e.target.value) / 100 })}
          />
        </label>
        <label>
          Efek suara <output>{Math.round(audioPrefs.effects * 100)}%</output>
          <input
            aria-label="Volume efek suara"
            type="range"
            min="0"
            max="100"
            value={Math.round(audioPrefs.effects * 100)}
            onChange={(e) =>
              onAudioChange({ ...audioPrefs, effects: Number(e.target.value) / 100 })
            }
          />
        </label>
        <p>
          Melodi dan efek dibuat khusus untuk dunia ini. Musik mulai setelah interaksi pertama dan
          berhenti saat tab tidak aktif.
        </p>
      </fieldset>
      <div className="controls-guide">
        <h3>Cara menjelajah</h3>
        <p>
          <kbd>W A S D</kbd> / panah untuk berjalan · <kbd>Shift</kbd> berlari · <kbd>E</kbd>{' '}
          interaksi · <kbd>Space</kbd> loncat · <kbd>M</kbd> misi · <kbd>O</kbd> lihat seluruh peta.
        </p>
        <p>
          HP: geser joystick kiri untuk berjalan, geser dunia untuk kamera. Ketuk tanah atau gunakan
          “Tunjukkan jalan” untuk berjalan otomatis.
        </p>
      </div>
    </>
  );
}
