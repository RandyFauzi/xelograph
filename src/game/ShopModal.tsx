import { useState, useEffect } from 'react';
import { ArrowRight, Sparkles, Copy, Check, ExternalLink, RefreshCw } from 'lucide-react';
import { api } from '../api';
import { campusAudio } from './audio';
import { AvatarPreview } from '../World';
import { DEFAULT_AVATAR } from '../types';
import type { AvatarConfig, Profile, StoreItem } from '../types';

interface TopUpPackage {
  id: string;
  coins: number;
  price_idr: number;
}

const TOPUP_PACKAGES: TopUpPackage[] = [
  { id: 'pack_100', coins: 100, price_idr: 20000 },
  { id: 'pack_250', coins: 250, price_idr: 50000 },
  { id: 'pack_600', coins: 600, price_idr: 100000 },
];

export default function ShopModal({
  profile,
  onProfileUpdate,
  onToast,
  onClose,
  onJoin,
}: {
  profile: Profile | null;
  onProfileUpdate: (updated: Profile) => void;
  onToast: (msg: string) => void;
  onClose: () => void;
  onJoin: () => void;
}) {
  const [view, setView] = useState<'catalog' | 'topup'>('catalog');
  const [coins, setCoins] = useState(100);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [inventory, setInventory] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyItem, setBusyItem] = useState<string | null>(null);

  // Top Up State
  const [selectedPkg, setSelectedPkg] = useState<TopUpPackage>(TOPUP_PACKAGES[0]);
  const [saweriaUser, setSaweriaUser] = useState('randyfauzi24');
  const [copied, setCopied] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);

  // Local active avatar state for 0ms instantaneous visual updates
  const [activeAvatar, setActiveAvatar] = useState<AvatarConfig>(() => {
    return profile?.avatar ? { ...profile.avatar } : { ...DEFAULT_AVATAR };
  });

  // Keep local avatar in sync if parent profile changes
  useEffect(() => {
    if (profile?.avatar) {
      setActiveAvatar((prev) => {
        if (
          prev.headwear === profile.avatar.headwear &&
          prev.eyewear === profile.avatar.eyewear &&
          prev.outfit === profile.avatar.outfit &&
          prev.hair === profile.avatar.hair
        ) {
          return prev;
        }
        return { ...profile.avatar };
      });
    }
  }, [profile?.avatar]);

  // Initial load: catalog items & packages
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [storeData, topupData] = await Promise.all([
          api<{
            coins: number;
            items: StoreItem[];
            inventory: string[];
            equipped: string[];
          }>('/store'),
          api<{
            packages: TopUpPackage[];
            saweria_username: string;
          }>('/store/topup/packages').catch(() => null),
        ]);

        if (alive && storeData) {
          setCoins(storeData.coins ?? 100);
          setItems(storeData.items || []);
          setInventory(storeData.inventory || []);

          if (storeData.equipped && storeData.equipped.length > 0) {
            const head = storeData.equipped.find((id) => id === 'topi_beret_bear');
            const eye = storeData.equipped.find(
              (id) => id === 'pixel_sunglasses' || id === 'anime_sunglasses',
            );
            setActiveAvatar((prev) => ({
              ...prev,
              ...(head ? { headwear: head } : {}),
              ...(eye ? { eyewear: eye } : {}),
            }));
          }
        }

        if (alive && topupData?.saweria_username) {
          setSaweriaUser(topupData.saweria_username);
        }
      } catch {
        // Fallback for guest
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Poll for incoming coins while top-up view is active
  useEffect(() => {
    if (view !== 'topup' || !profile) return;
    let alive = true;
    const interval = setInterval(async () => {
      try {
        const res = await api<{ coins: number }>('/store');
        if (alive && res && res.coins > coins) {
          setCoins(res.coins);
          campusAudio.play('success');
          onToast(`🎉 Pembayaran berhasil! Saldo kamu sekarang ${res.coins} Koin.`);
          setView('catalog');
        }
      } catch {
        // Silent poll error
      }
    }, 3500);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [view, coins, profile, onToast]);

  const handleCopyCode = () => {
    if (!profile) return;
    const code = `TOPUP-${profile.id}`;
    void navigator.clipboard.writeText(code);
    campusAudio.play('tap');
    setCopied(true);
    onToast('Kode pesan berhasil disalin ke clipboard! 📋');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleManualCheck = async () => {
    setCheckingPayment(true);
    campusAudio.play('tap');
    try {
      const res = await api<{ coins: number }>('/store');
      if (res && res.coins > coins) {
        setCoins(res.coins);
        campusAudio.play('success');
        onToast(`🎉 Pembayaran terverifikasi! Saldo bertambah.`);
        setView('catalog');
      } else {
        onToast('Belum ada pembayaran baru yang terdeteksi. Silakan selesaikan scan QRIS.');
      }
    } catch (e) {
      onToast((e as Error).message);
    } finally {
      setCheckingPayment(false);
    }
  };

  // Beli item: otomatis langsung dipakai tanpa perlu klik terpisah
  const handleBuy = async (item: StoreItem) => {
    if (!profile) {
      onJoin();
      return;
    }
    if (coins < item.price_coins) {
      campusAudio.play('tap');
      onToast('Koin tidak cukup! Silakan isi ulang koin.');
      setView('topup');
      return;
    }
    setBusyItem(item.id);

    // Optimistic instant equip & coin deduct
    const prevCoins = coins;
    const prevInv = inventory;
    const prevAvatar = activeAvatar;

    setCoins((c) => Math.max(0, c - item.price_coins));
    setInventory((inv) => (inv.includes(item.id) ? inv : [...inv, item.id]));

    const nextAvatar: AvatarConfig = {
      ...activeAvatar,
      [item.category]: item.id,
    };
    setActiveAvatar(nextAvatar);
    onProfileUpdate({
      ...profile,
      avatar: nextAvatar,
    });
    campusAudio.play('success');
    onToast(`Berhasil dibeli & langsung dipakai: ${item.name}! ✨`);

    try {
      const res = await api<{ ok: boolean; coins: number; itemId: string }>('/store/buy', {
        method: 'POST',
        body: JSON.stringify({ itemId: item.id }),
      });
      if (res?.ok) {
        setCoins(res.coins);
        const updated = await api<Profile>('/store/equip', {
          method: 'POST',
          body: JSON.stringify({
            itemId: item.id,
            slot: item.category,
            action: 'equip',
          }),
        });
        if (updated) {
          onProfileUpdate(updated);
        }
      }
    } catch (e) {
      setCoins(prevCoins);
      setInventory(prevInv);
      setActiveAvatar(prevAvatar);
      onProfileUpdate({ ...profile, avatar: prevAvatar });
      onToast((e as Error).message);
    } finally {
      setBusyItem(null);
    }
  };

  // Gunakan / Lepas item: otomatis aktif seketika (0ms)
  const handleEquip = async (item: StoreItem, action: 'equip' | 'unequip') => {
    if (!profile) return;
    setBusyItem(item.id);

    const prevAvatar = activeAvatar;
    const nextAvatar: AvatarConfig = {
      ...activeAvatar,
      [item.category]: action === 'equip' ? item.id : null,
    };

    setActiveAvatar(nextAvatar);
    onProfileUpdate({
      ...profile,
      avatar: nextAvatar,
    });
    campusAudio.play('tap');
    onToast(
      action === 'equip'
        ? `${item.name} aktif digunakan! ✨`
        : `${item.name} berhasil dilepas.`,
    );

    try {
      const updated = await api<Profile>('/store/equip', {
        method: 'POST',
        body: JSON.stringify({
          itemId: item.id,
          slot: item.category,
          action,
        }),
      });
      if (updated) {
        onProfileUpdate(updated);
      }
    } catch (e) {
      setActiveAvatar(prevAvatar);
      onProfileUpdate({ ...profile, avatar: prevAvatar });
      onToast((e as Error).message);
    } finally {
      setBusyItem(null);
    }
  };

  const headwearItems = items.filter((i) => i.category === 'headwear');
  const eyewearItems = items.filter((i) => i.category === 'eyewear');
  const otherItems = items.filter(
    (i) => i.category !== 'headwear' && i.category !== 'eyewear',
  );

  const getCleanTitle = (item: StoreItem) => {
    if (item.id === 'topi_beret_bear') return 'TOPI BERET';
    if (item.id === 'pixel_sunglasses') return 'KACAMATA PIXEL';
    if (item.id === 'anime_sunglasses') return 'KACAMATA ANIME';
    return item.name.replace(/^(Topi|Kacamata)\s+/i, '').toUpperCase();
  };

  const renderCard = (item: StoreItem, theme: 'minis' | 'heroes') => {
    const isOwned = inventory.includes(item.id);
    const isEquipped =
      (item.category === 'headwear' && activeAvatar?.headwear === item.id) ||
      (item.category === 'eyewear' && activeAvatar?.eyewear === item.id);
    const isBusy = busyItem === item.id;
    const canAfford = coins >= item.price_coins;

    return (
      <div
        key={item.id}
        className={`clash-card theme-${theme} ${isEquipped ? 'is-equipped' : ''} ${isOwned ? 'is-owned' : ''}`}
      >
        <div className="clash-card-header">
          <span className="clash-card-title">{getCleanTitle(item)}</span>
          <span className="clash-card-subtag">
            {isEquipped ? '✓ Sedang Dipakai' : isOwned ? 'Dimiliki' : '1 Tersedia'}
          </span>
        </div>

        <div className="clash-card-preview">
          <div className="clash-preview-halo" />
          <img
            src={item.preview_url}
            alt={item.name}
            className="clash-preview-img"
            loading="lazy"
          />
        </div>

        <div className="clash-card-footer">
          {isOwned ? (
            isEquipped ? (
              <button
                type="button"
                className="clash-btn clash-btn-equipped"
                disabled={isBusy}
                onClick={() => handleEquip(item, 'unequip')}
                title="Klik untuk melepas item"
              >
                <span className="clash-btn-label">✓ SEDANG DIGUNAKAN</span>
              </button>
            ) : (
              <button
                type="button"
                className="clash-btn clash-btn-equip"
                disabled={isBusy}
                onClick={() => handleEquip(item, 'equip')}
                title="Klik untuk otomatis mengaktifkan item ini"
              >
                <span className="clash-btn-label">⚡ GUNAKAN</span>
              </button>
            )
          ) : (
            <button
              type="button"
              className={`clash-btn clash-btn-buy ${!canAfford ? 'is-disabled' : ''}`}
              disabled={isBusy || (!profile ? false : !canAfford)}
              onClick={() => handleBuy(item)}
              title={!canAfford ? 'Koin belum cukup (Klik untuk top-up)' : `Beli seharga ${item.price_coins} koin & langsung pakai`}
            >
              <span className="clash-coin-symbol">🪙</span>
              <span className="clash-coin-price">{item.price_coins}</span>
              <span className="clash-btn-buy-tag">BELI &amp; PAKAI</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="clash-shop-wrapper">
      {/* CANOPY AWNING & TOP STATUS BAR */}
      <header className="clash-shop-header">
        <div className="clash-awning-canvas-wrap">
          <svg
            className="clash-awning-svg"
            viewBox="0 0 720 76"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="awning-dark" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e40af" />
                <stop offset="60%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
              <linearGradient id="awning-light" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0284c7" />
                <stop offset="60%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0ea5e9" />
              </linearGradient>
              <filter id="awning-shadow" x="-5%" y="0%" width="110%" height="150%">
                <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#020617" floodOpacity="0.45" />
              </filter>
            </defs>

            {/* 6 Scalloped canopy panels across 720 width (120px each) */}
            <path d="M 0,0 L 120,0 L 120,40 Q 60,72 0,40 Z" fill="url(#awning-dark)" />
            <path d="M 120,0 L 240,0 L 240,40 Q 180,72 120,40 Z" fill="url(#awning-light)" />
            <path d="M 240,0 L 360,0 L 360,40 Q 300,72 240,40 Z" fill="url(#awning-dark)" />
            <path d="M 360,0 L 480,0 L 480,40 Q 420,72 360,40 Z" fill="url(#awning-light)" />
            <path d="M 480,0 L 600,0 L 600,40 Q 540,72 480,40 Z" fill="url(#awning-dark)" />
            <path d="M 600,0 L 720,0 L 720,40 Q 660,72 600,40 Z" fill="url(#awning-light)" />

            {/* Turquoise rim highlight */}
            <path
              d="M 0,40 Q 60,72 120,40 Q 180,72 240,40 Q 300,72 360,40 Q 420,72 480,40 Q 540,72 600,40 Q 660,72 720,40"
              fill="none"
              stroke="#22d3ee"
              strokeWidth="6"
              strokeLinecap="round"
              filter="url(#awning-shadow)"
            />
          </svg>
        </div>

        {/* TOP STATUS BAR (OVERLAY) */}
        <div className="clash-topbar">
          <div className="clash-pill clash-pill-player" title="Identitas Anda">
            <span className="clash-player-badge">
              {profile ? profile.nickname.charAt(0).toUpperCase() : '👤'}
            </span>
            <span className="clash-player-name">
              {profile?.nickname || 'Tamu Alumni'}
            </span>
          </div>

          <div className="clash-shop-badge">
            <span>{view === 'topup' ? 'ISI ULANG KOIN' : 'TOKO AVATAR'}</span>
          </div>

          <div className="clash-pill clash-pill-coins" title="Saldo Koin">
            <span className="clash-coin-symbol">🪙</span>
            <strong className="clash-coin-num">{coins.toLocaleString('id-ID')}</strong>
            <button
              type="button"
              className={'clash-btn-topup-toggle' + (view === 'topup' ? ' is-active' : '')}
              onClick={() => {
                campusAudio.play('tap');
                setView(view === 'catalog' ? 'topup' : 'catalog');
              }}
              title={view === 'catalog' ? 'Buka Menu Isi Ulang Koin' : 'Kembali ke Katalog Toko'}
            >
              {view === 'catalog' ? '+ ISI' : 'TOKO'}
            </button>
          </div>

          <button
            type="button"
            className="clash-btn-close"
            onClick={onClose}
            aria-label="Tutup Shop"
            title="Tutup Shop"
          >
            ✕
          </button>
        </div>
      </header>

      {/* SHOP BODY: TOP UP VIEW OR CATALOG VIEW */}
      <div className="clash-shop-body">
        {loading ? (
          <div className="clash-shop-loading">
            <div className="clash-loading-spinner" />
            <span>Membuka gerai toko…</span>
          </div>
        ) : view === 'topup' ? (
          /* =======================================================
             TOP UP COIN VIEW (CLEAN, NO GIMMICK LABELS)
             ======================================================= */
          <div className="clash-topup-container">
            <div className="clash-section-header">
              <div className="clash-section-title-wrap">
                <span className="clash-section-icon">🪙</span>
                <h3 className="clash-section-title">PILIH JUMLAH KOIN</h3>
              </div>
              <span className="clash-section-tag">QRIS Nasional</span>
            </div>

            {/* 3 PACKAGE CARDS */}
            <div className="clash-topup-grid">
              {TOPUP_PACKAGES.map((pkg, idx) => {
                const isSelected = selectedPkg.id === pkg.id;
                return (
                  <div
                    key={pkg.id}
                    className={'clash-topup-card' + (isSelected ? ' is-selected' : '')}
                    onClick={() => {
                      campusAudio.play('tap');
                      setSelectedPkg(pkg);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="clash-topup-coin-icon">
                      {idx === 0 && <span className="topup-icon-coin">🪙</span>}
                      {idx === 1 && <span className="topup-icon-stack">🪙🪙</span>}
                      {idx === 2 && <span className="topup-icon-chest">🪙🪙🪙</span>}
                    </div>
                    <div className="clash-topup-amount">
                      <strong>{pkg.coins}</strong> KOIN
                    </div>
                    <div className="clash-topup-price-badge">
                      Rp {pkg.price_idr.toLocaleString('id-ID')}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CHECKOUT CARD */}
            {profile ? (
              <div className="clash-topup-checkout">
                <div className="clash-checkout-summary">
                  <span>Paket Terpilih:</span>
                  <strong>{selectedPkg.coins} Koin</strong>
                  <span className="clash-checkout-dot">·</span>
                  <strong className="clash-checkout-price">
                    Rp {selectedPkg.price_idr.toLocaleString('id-ID')}
                  </strong>
                </div>

                {/* STEP 1: REFERENCE MESSAGE CODE */}
                <div className="clash-code-box">
                  <div className="clash-code-meta">
                    <small>KODE PESAN WAJIB DI SAWERIA:</small>
                    <strong className="clash-code-text">TOPUP-{profile.id}</strong>
                  </div>
                  <button
                    type="button"
                    className={'clash-btn-copy' + (copied ? ' is-copied' : '')}
                    onClick={handleCopyCode}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copied ? 'Tersalin!' : 'Salin Kode'}</span>
                  </button>
                </div>

                {/* INSTRUCTIONS */}
                <div className="clash-topup-instructions">
                  <p>
                    1. Salin kode pesan di atas (<code>TOPUP-{profile.id}</code>).
                    <br />
                    2. Buka Saweria &amp; tempelkan kode tersebut di kolom <strong>Pesan</strong>.
                    <br />
                    3. Scan QRIS dengan m-Banking (BCA, Mandiri, BRI) atau e-Wallet (GoPay, OVO, Dana).
                  </p>
                </div>

                {/* STEP 2: OPEN SAWERIA BUTTON */}
                <div className="clash-checkout-actions">
                  <a
                    href={`https://saweria.co/${saweriaUser}?amount=${selectedPkg.price_idr}&msg=TOPUP-${profile.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="clash-btn-saweria-pay"
                    onClick={() => campusAudio.play('tap')}
                  >
                    <span>Buka Pembayaran QRIS (Saweria)</span>
                    <ExternalLink size={16} />
                  </a>

                  <button
                    type="button"
                    className="clash-btn-check-pay"
                    onClick={handleManualCheck}
                    disabled={checkingPayment}
                    title="Cek apakah pembayaran sudah masuk"
                  >
                    <RefreshCw size={14} className={checkingPayment ? 'is-spinning' : ''} />
                    <span>{checkingPayment ? 'Mengecek…' : 'Cek Status Pembayaran'}</span>
                  </button>
                </div>

                {/* LIVE LISTENING RADAR */}
                <div className="clash-radar-notice">
                  <div className="clash-radar-dot" />
                  <span>
                    Sistem mendeteksi pembayaran otomatis. Koin akan langsung masuk tanpa perlu keluar.
                  </span>
                </div>
              </div>
            ) : (
              /* GUEST NOTICE */
              <div className="clash-guest-box">
                <p>
                  Kamu sedang menjelajah sebagai <strong>Tamu</strong>. Buat karakter alumni
                  terlebih dahulu agar koin yang kamu beli tersimpan permanen di akunmu.
                </p>
                <button type="button" className="clash-btn-join-trigger" onClick={onJoin}>
                  Buat Karakter Sekarang <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* =======================================================
             CATALOG VIEW (AVATAR ITEMS & FITTING ROOM)
             ======================================================= */
          <>
            {/* LIVE 3D FITTING ROOM STAGE (KAMAR PAS) */}
            <div className="clash-fitting-stage">
              <div className="clash-fitting-model">
                <AvatarPreview config={activeAvatar} />
              </div>
              <div className="clash-fitting-info">
                <div className="clash-fitting-badge">
                  <Sparkles size={13} /> KAMAR PAS LIVE
                </div>
                <div className="clash-fitting-title">
                  {profile?.nickname || 'Karakter Kamu'}
                </div>
                <div className="clash-fitting-slots">
                  <div className="clash-slot-pill">
                    <span>🎩 Topi:</span>
                    <strong>
                      {activeAvatar.headwear === 'topi_beret_bear'
                        ? 'Topi Beret Beruang'
                        : 'Belum Pakai'}
                    </strong>
                  </div>
                  <div className="clash-slot-pill">
                    <span>🕶️ Kacamata:</span>
                    <strong>
                      {activeAvatar.eyewear === 'pixel_sunglasses'
                        ? 'Kacamata Pixel'
                        : activeAvatar.eyewear === 'anime_sunglasses'
                          ? 'Kacamata Anime'
                          : 'Belum Pakai'}
                    </strong>
                  </div>
                </div>
                <div className="clash-fitting-hint">
                  ✓ Tombol Gunakan langsung mengaktifkan aksesoris di karaktermu!
                </div>
              </div>
            </div>

            {/* HEADWEAR SECTION (MINIS THEME) */}
            {headwearItems.length > 0 && (
              <div className="clash-section-box">
                <div className="clash-section-header">
                  <div className="clash-section-title-wrap">
                    <span className="clash-section-icon">🧢</span>
                    <h3 className="clash-section-title">TOPI &amp; KEPALA</h3>
                  </div>
                  <span className="clash-section-tag">Koleksi Kepala</span>
                </div>
                <div className="clash-cards-grid">
                  {headwearItems.map((item) => renderCard(item, 'minis'))}
                </div>
              </div>
            )}

            {/* EYEWEAR SECTION (HEROES THEME) */}
            {eyewearItems.length > 0 && (
              <div className="clash-section-box">
                <div className="clash-section-header">
                  <div className="clash-section-title-wrap">
                    <span className="clash-section-icon">🕶️</span>
                    <h3 className="clash-section-title">KACAMATA &amp; AKSESORIS</h3>
                  </div>
                  <span className="clash-section-tag">Koleksi Wajah</span>
                </div>
                <div className="clash-cards-grid">
                  {eyewearItems.map((item) => renderCard(item, 'heroes'))}
                </div>
              </div>
            )}

            {/* OTHER ITEMS (IF ANY) */}
            {otherItems.length > 0 && (
              <div className="clash-section-box">
                <div className="clash-section-header">
                  <div className="clash-section-title-wrap">
                    <span className="clash-section-icon">✨</span>
                    <h3 className="clash-section-title">ITEM LAINNYA</h3>
                  </div>
                </div>
                <div className="clash-cards-grid">
                  {otherItems.map((item) => renderCard(item, 'heroes'))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* FOOTER BAR */}
      <footer className="clash-shop-footer">
        <div className="clash-footer-hint">
          <Sparkles size={14} className="clash-sparkle-icon" />
          <span>
            {view === 'topup'
              ? 'Scan QRIS Saweria dan koin otomatis bertambah ke akunmu.'
              : 'Aksesoris otomatis aktif & tersimpan pada karaktermu!'}
          </span>
        </div>
        <button
          type="button"
          className="clash-btn-done"
          onClick={onClose}
          title="Kembali ke petualangan kampus"
        >
          ✓ Kembali Menjelajah <ArrowRight size={16} />
        </button>
      </footer>
    </div>
  );
}
