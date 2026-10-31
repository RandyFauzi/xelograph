import { useState, useEffect, useRef } from 'react';
import {
  ArrowRight,
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  ShoppingBag,
  Coins,
  X,
  Search,
  Shirt,
  Glasses,
  HardHat,
  LoaderCircle,
  Eye,
  RotateCcw,
} from 'lucide-react';
import './shop.css';
import { api } from '../api';
import { campusAudio } from './audio';
import { AvatarPreview } from '../World';
import { DEFAULT_AVATAR } from '../types';
import type { AvatarConfig, Profile, StoreItem } from '../types';
import {
  fittingAvatar,
  toggleFittingItem,
  clearFittingSlot,
  type FittingSelection,
} from './shopPreview';

interface TopUpPackage {
  id: string;
  coins: number;
  price_idr: number;
}

const TOPUP_PACKAGES: TopUpPackage[] = [
  { id: 'pack_test', coins: 5, price_idr: 2000 },
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
  const [coins, setCoins] = useState(0);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [inventory, setInventory] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [tryOn, setTryOn] = useState<FittingSelection>({});
  const fittingRef = useRef<HTMLDivElement>(null);

  // Top Up State
  const [selectedPkg, setSelectedPkg] = useState<TopUpPackage>(TOPUP_PACKAGES[0]);
  const [saweriaUser, setSaweriaUser] = useState('randyfauzi24');
  const [copied, setCopied] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);

  // Duitku Dynamic QRIS State
  const [activeQris, setActiveQris] = useState<{
    orderId: string;
    reference: string;
    qrDataUrl: string;
    qrString: string;
    paymentUrl: string;
    amount: number;
    coins: number;
  } | null>(null);
  const [creatingQris, setCreatingQris] = useState(false);
  const [qrisSuccess, setQrisSuccess] = useState<number | null>(null);
  const [showSaweriaFallback, setShowSaweriaFallback] = useState(false);

  // Local active avatar state for 0ms instantaneous visual updates
  const [activeAvatar, setActiveAvatar] = useState<AvatarConfig>(() => {
    return profile?.avatar ? { ...profile.avatar } : { ...DEFAULT_AVATAR };
  });
  const previewAvatar = fittingAvatar(activeAvatar, tryOn);
  const triedItems = items.filter(
    (item) => tryOn[item.category] === item.id && activeAvatar[item.category] !== item.id,
  );
  const isTrying = triedItems.length > 0;
  useEffect(() => setTryOn({}), [profile?.id]);

  const handleTryOn = (item: StoreItem) => {
    setTryOn((selection) => toggleFittingItem(selection, item));
    campusAudio.play('tap');
    if (window.matchMedia('(max-width: 600px)').matches) {
      fittingRef.current?.scrollIntoView({
        block: 'nearest',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    }
  };

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
    setLoading(true);
    setLoadError('');
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
          setCoins(storeData.coins ?? 0);
          setItems(storeData.items || []);
          setInventory(storeData.inventory || []);

          if (storeData.equipped && storeData.equipped.length > 0) {
            const head = storeData.equipped.find(
              (id) =>
                id === 'topi_beret_bear' ||
                id.startsWith('hat_') ||
                storeData.items?.some((i) => i.id === id && i.category === 'headwear'),
            );
            const eye = storeData.equipped.find(
              (id) => id === 'pixel_sunglasses' || id === 'anime_sunglasses',
            );
            const outfit = storeData.equipped.find((id) => id.startsWith('row4_'));
            setActiveAvatar((prev) => ({
              ...prev,
              ...(head ? { headwear: head } : {}),
              ...(eye ? { eyewear: eye } : {}),
              ...(outfit ? { outfit } : {}),
            }));
          }
        }

        if (alive && topupData?.saweria_username) {
          setSaweriaUser(topupData.saweria_username);
        }
      } catch {
        if (alive) setLoadError('Koleksi belum dapat dimuat. Coba sekali lagi, ya.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [retry]);

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

  // Create Dynamic QRIS via Duitku
  const handleCreateDuitkuQris = async () => {
    if (busyItem !== null) return;
    if (!profile) {
      onJoin();
      return;
    }
    setCreatingQris(true);
    campusAudio.play('tap');
    try {
      const res = await api<{
        ok: boolean;
        orderId: string;
        reference: string;
        qrDataUrl: string;
        qrString: string;
        paymentUrl: string;
        amount: number;
        coins: number;
      }>('/store/topup/duitku/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: selectedPkg.id }),
      });
      if (res && res.ok) {
        setActiveQris({
          orderId: res.orderId,
          reference: res.reference,
          qrDataUrl: res.qrDataUrl,
          qrString: res.qrString,
          paymentUrl: res.paymentUrl,
          amount: res.amount,
          coins: res.coins,
        });
      }
    } catch (e: any) {
      onToast(e.message || 'Gagal memuat QRIS Duitku. Silakan coba lagi.');
    } finally {
      setCreatingQris(false);
    }
  };

  // Poll Duitku status while activeQris is displayed
  useEffect(() => {
    if (!activeQris) return;
    let alive = true;
    let timer: any = null;

    const pollStatus = async () => {
      try {
        const res = await api<{
          ok: boolean;
          status: 'pending' | 'completed' | 'failed';
          coins_awarded?: number;
          balance?: number;
        }>(`/store/topup/duitku/status?orderId=${activeQris.orderId}`);

        if (!alive) return;

        if (res && res.status === 'completed') {
          campusAudio.play('success');
          const coinsEarned = res.coins_awarded || activeQris.coins;
          setCoins((prev) => (res.balance !== undefined ? res.balance : prev + coinsEarned));
          setQrisSuccess(coinsEarned);
          onToast(
            `🎉 Pembayaran Rp ${activeQris.amount.toLocaleString('id-ID')} Berhasil! +${coinsEarned} Koin.`,
          );
          setActiveQris(null);
          return;
        }
      } catch {}

      if (alive) {
        timer = setTimeout(pollStatus, 2500);
      }
    };

    timer = setTimeout(pollStatus, 2500);

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [activeQris, onToast]);

  // Beli item: otomatis langsung dipakai tanpa perlu klik terpisah
  const handleBuy = async (item: StoreItem) => {
    if (busyItem !== null) return;
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

    let purchased = false;
    try {
      const res = await api<{ ok: boolean; coins: number; itemId: string }>('/store/buy', {
        method: 'POST',
        body: JSON.stringify({ itemId: item.id }),
      });
      if (!res.ok) throw new Error('Pembelian belum berhasil. Coba lagi.');
      // The purchase is committed independently of equipping. Never restore spent coins locally.
      purchased = true;
      setCoins(res.coins);
      setInventory((owned) => (owned.includes(item.id) ? owned : [...owned, item.id]));
      const updated = await api<Profile>('/store/equip', {
        method: 'POST',
        body: JSON.stringify({ itemId: item.id, slot: item.category, action: 'equip' }),
      });
      setActiveAvatar({ ...updated.avatar });
      setTryOn((selection) => clearFittingSlot(selection, item.category));
      onProfileUpdate(updated);
      campusAudio.play('success');
      onToast(`${item.name} berhasil dibeli dan dipakai!`);
    } catch (e) {
      onToast(
        purchased
          ? `Item sudah dibeli dan tersimpan di Milikku. Coba tombol Gunakan lagi. ${(e as Error).message}`
          : (e as Error).message,
      );
    } finally {
      setBusyItem(null);
    }
  };

  const handleEquip = async (item: StoreItem, action: 'equip' | 'unequip') => {
    if (!profile || busyItem !== null) return;
    setBusyItem(item.id);
    const prevAvatar = activeAvatar;
    const nextAvatar: AvatarConfig = {
      ...activeAvatar,
      [item.category]: action === 'equip' ? item.id : item.category === 'outfit' ? 'navy' : null,
    };
    setTryOn((selection) => clearFittingSlot(selection, item.category));
    setActiveAvatar(nextAvatar);
    campusAudio.play('tap');
    // Keep the immediate fitting-room update local. Refreshing /me before this write
    // completes can otherwise restore the old appearance in the parent/world.
    try {
      const updated = await api<Profile>('/store/equip', {
        method: 'POST',
        body: JSON.stringify({ itemId: item.id, slot: item.category, action }),
      });
      setActiveAvatar({ ...updated.avatar });
      onProfileUpdate(updated);
      onToast(
        action === 'equip' ? `${item.name} aktif digunakan!` : `${item.name} berhasil dilepas.`,
      );
    } catch (e) {
      setActiveAvatar(prevAvatar);
      onToast((e as Error).message);
    } finally {
      setBusyItem(null);
    }
  };

  const filteredItems = items.filter(
    (item) =>
      (category === 'all' || item.category === category) &&
      (!ownedOnly || inventory.includes(item.id)) &&
      item.name.toLocaleLowerCase('id-ID').includes(query.trim().toLocaleLowerCase('id-ID')),
  );
  const categories = [
    { id: 'all', label: 'Semua', icon: ShoppingBag },
    { id: 'headwear', label: 'Topi', icon: HardHat },
    { id: 'eyewear', label: 'Kacamata', icon: Glasses },
    { id: 'outfit', label: 'Pakaian', icon: Shirt },
  ];
  const getCleanTitle = (item: StoreItem) => {
    if (item.id === 'topi_beret_bear') return 'TOPI BERET';
    if (item.id === 'hat_01_cap_blue') return 'BASEBALL CAP';
    if (item.id === 'hat_02_snapback_red') return 'SNAPBACK RED';
    if (item.id === 'hat_03_beanie_black') return 'BLACK BEANIE';
    if (item.id === 'hat_04_bucket_safari') return 'SAFARI BUCKET';
    if (item.id === 'hat_05_snapback_black_red') return 'SNAPBACK DUAL';
    if (item.id === 'hat_06_fedora_brown') return 'CLASSIC FEDORA';
    if (item.id === 'hat_07_straw_luffy') return 'STRAW HAT';
    if (item.id === 'hat_08_visor_green') return 'TENNIS VISOR';
    if (item.id === 'hat_09_winter_pompom') return 'WINTER POMPOM';
    if (item.id === 'hat_10_sweatband_sports') return 'SWEATBAND';
    if (item.id === 'hat_11_crown_gold') return 'ROYAL CROWN';
    if (item.id === 'hat_12_bandana_pirate') return 'PIRATE BANDANA';
    if (item.id === 'pixel_sunglasses') return 'KACAMATA PIXEL';
    if (item.id === 'anime_sunglasses') return 'KACAMATA ANIME';
    if (item.id === 'row4_01_varsity_black') return 'VARSITY JACKET';
    if (item.id === 'row4_02_track_blue') return 'TRACK BLUE';
    if (item.id === 'row4_03_track_stripes') return 'TRACK STRIPES';
    if (item.id === 'row4_04_halfzip_cream') return 'HALF-ZIP CREAM';
    if (item.id === 'row4_05_halfzip_green') return 'HALF-ZIP GREEN';
    if (item.id === 'row4_06_polo_brown') return 'POLO SWEATER';
    if (item.id === 'row4_07_crewneck_charcoal') return 'CREWNECK';
    if (item.id === 'row4_08_formal_tie') return 'FORMAL TIE';
    return item.name.replace(/^(Topi|Kacamata)\s+/i, '').toUpperCase();
  };

  const renderCard = (item: StoreItem, theme: 'minis' | 'heroes') => {
    const isPreviewing = triedItems.some((tried) => tried.id === item.id);
    const isOwned = inventory.includes(item.id);
    const isEquipped =
      (item.category === 'headwear' && activeAvatar?.headwear === item.id) ||
      (item.category === 'eyewear' && activeAvatar?.eyewear === item.id) ||
      (item.category === 'outfit' && activeAvatar?.outfit === item.id);
    const isBusy = busyItem === item.id;
    const canAfford = coins >= item.price_coins;

    return (
      <div
        key={item.id}
        aria-busy={isBusy}
        className={`clash-card theme-${theme} ${isEquipped ? 'is-equipped' : ''} ${isOwned ? 'is-owned' : ''} ${isPreviewing ? 'is-trying' : ''}`}
      >
        <div className="clash-card-header">
          <span className="clash-card-title">{getCleanTitle(item)}</span>
          <span className="clash-card-subtag">
            {isPreviewing
              ? 'Sedang dicoba'
              : isEquipped
                ? 'Dipakai'
                : isOwned
                  ? 'Dimiliki'
                  : 'Koleksi avatar'}
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
          {!isEquipped && (
            <button
              type="button"
              className="shop-try-button"
              aria-pressed={isPreviewing}
              aria-label={`${isPreviewing ? 'Batal mencoba' : 'Coba'} ${item.name} di kamar pas`}
              disabled={busyItem !== null}
              onClick={() => handleTryOn(item)}
            >
              <Eye size={15} aria-hidden="true" />
              {isPreviewing ? 'Batal coba' : 'Coba dulu'}
            </button>
          )}
          {isOwned ? (
            isEquipped ? (
              <button
                type="button"
                className="clash-btn clash-btn-equipped"
                disabled={busyItem !== null}
                onClick={() => handleEquip(item, 'unequip')}
                title="Klik untuk melepas item"
              >
                <span className="clash-btn-label">
                  {isBusy ? <LoaderCircle size={15} className="shop-spin" /> : <Check size={15} />}{' '}
                  {isBusy ? 'Menyimpan…' : 'Dipakai · Lepas'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                className="clash-btn clash-btn-equip"
                disabled={busyItem !== null}
                onClick={() => handleEquip(item, 'equip')}
                title="Klik untuk otomatis mengaktifkan item ini"
              >
                <span className="clash-btn-label">{isBusy ? 'Menyimpan…' : 'Gunakan'}</span>
              </button>
            )
          ) : (
            <button
              type="button"
              className={`clash-btn clash-btn-buy ${!canAfford ? 'is-disabled' : ''}`}
              disabled={busyItem !== null}
              onClick={() => handleBuy(item)}
              title={
                !profile
                  ? 'Buat karakter untuk membeli item'
                  : !canAfford
                    ? 'Isi koin untuk membeli item ini'
                    : `Beli seharga ${item.price_coins} koin & langsung pakai`
              }
            >
              <Coins className="clash-coin-symbol" size={16} aria-hidden="true" />
              <span className="clash-coin-price">{item.price_coins}</span>
              <span className="clash-btn-buy-tag">
                {isBusy
                  ? 'Membeli…'
                  : !profile
                    ? 'Buat karakter'
                    : !canAfford
                      ? 'Isi koin'
                      : 'Beli & pakai'}
              </span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="clash-shop-wrapper">
      <header className="shop-header">
        <div className="shop-brand">
          <span className="shop-brand-icon">
            <ShoppingBag size={22} aria-hidden="true" />
          </span>
          <div>
            <span className="shop-eyebrow">XYLOGRAPH / AVATAR STORE</span>
            <h2>Gaya kecil, cerita baru.</h2>
          </div>
        </div>
        <div className="shop-header-actions">
          <div
            className="shop-wallet"
            aria-label={
              profile ? `Saldo ${coins} koin` : 'Buat karakter untuk memiliki dompet koin'
            }
          >
            <Coins size={20} aria-hidden="true" />
            <span>
              <small>Saldo koin</small>
              <strong>{profile ? (loading ? '…' : coins.toLocaleString('id-ID')) : '—'}</strong>
            </span>
          </div>
          <button
            type="button"
            className="clash-btn-close"
            onClick={onClose}
            aria-label="Tutup toko"
          >
            <X size={20} />
          </button>
        </div>
      </header>
      <nav className="shop-navigation" aria-label="Menu toko">
        <div className="shop-view-switch">
          <button
            type="button"
            aria-pressed={view === 'catalog'}
            onClick={() => setView('catalog')}
          >
            <ShoppingBag size={16} />
            Koleksi
          </button>
          <button type="button" aria-pressed={view === 'topup'} onClick={() => setView('topup')}>
            <Coins size={16} />
            Isi koin
          </button>
        </div>
        <span className="shop-player-label">Untuk {profile?.nickname || 'karakter barumu'}</span>
      </nav>

      {/* SHOP BODY: TOP UP VIEW OR CATALOG VIEW */}
      <div className="clash-shop-body">
        {loading ? (
          <div className="clash-shop-loading">
            <div className="clash-loading-spinner" />
            <span>Membuka gerai toko…</span>
          </div>
        ) : loadError ? (
          <div className="shop-empty" role="alert">
            <ShoppingBag size={28} />
            <h3>Toko sedang beristirahat</h3>
            <p>{loadError}</p>
            <button type="button" onClick={() => setRetry((n) => n + 1)}>
              Coba lagi <RefreshCw size={16} />
            </button>
          </div>
        ) : view === 'topup' ? (
          /* =======================================================
             TOP UP COIN VIEW (CLEAN, NO GIMMICK LABELS)
             ======================================================= */
          <div className="clash-topup-container">
            <div className="clash-section-header">
              <div className="clash-section-title-wrap">
                <Coins size={20} aria-hidden="true" />
                <h3 className="clash-section-title">PILIH JUMLAH KOIN</h3>
              </div>
              <span className="clash-section-tag">Pembayaran QRIS</span>
            </div>

            {/* Coin packages */}
            <div className="clash-topup-grid" role="group" aria-label="Pilih paket koin">
              {TOPUP_PACKAGES.map((pkg) => {
                const isSelected = selectedPkg.id === pkg.id;
                return (
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    disabled={creatingQris || !!activeQris}
                    key={pkg.id}
                    className={'clash-topup-card' + (isSelected ? ' is-selected' : '')}
                    onClick={() => {
                      campusAudio.play('tap');
                      setSelectedPkg(pkg);
                    }}
                  >
                    <span className="clash-topup-coin-icon">
                      <Coins size={28} aria-hidden="true" />
                    </span>
                    <span className="clash-topup-amount">
                      <strong>{pkg.coins}</strong> KOIN
                    </span>
                    <span className="clash-topup-price-badge">
                      Rp {pkg.price_idr.toLocaleString('id-ID')}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* SUCCESS BANNER */}
            {qrisSuccess && (
              <div className="clash-qris-success-banner">
                <span className="clash-qris-success-icon">🎉</span>
                <div className="clash-qris-success-text">
                  <strong>PEMBAYARAN BERHASIL!</strong>
                  <p>+{qrisSuccess} Koin telah ditambahkan ke saldo dompetmu.</p>
                </div>
                <button
                  type="button"
                  className="clash-btn-success-shop"
                  onClick={() => {
                    setQrisSuccess(null);
                    setView('catalog');
                  }}
                >
                  Belanja Item Avatar 🛍️
                </button>
              </div>
            )}

            {/* CHECKOUT CARD OR DYNAMIC QRIS SCREEN */}
            {profile ? (
              activeQris ? (
                /* =======================================================
                   ACTIVE DUITKU DYNAMIC QRIS DISPLAY
                   ======================================================= */
                <div className="clash-qris-display-card">
                  <div className="clash-qris-header">
                    <span className="clash-qris-badge">PEMBAYARAN QRIS</span>
                    <h4 className="clash-qris-price">
                      Rp {activeQris.amount.toLocaleString('id-ID')}
                    </h4>
                    <p className="clash-qris-sub">
                      Scan dengan aplikasi bank atau dompet digital. Pastikan nominal pembayaran
                      sesuai.
                    </p>
                  </div>

                  {/* QR CODE CONTAINER */}
                  <div className="clash-qris-qr-box">
                    <img
                      src={activeQris.qrDataUrl}
                      alt="QRIS Pembayaran Duitku"
                      className="clash-qris-image"
                    />
                    <div className="clash-qris-pulse">
                      <span className="clash-pulse-dot" />
                      <span>Menunggu scan m-Banking / e-Wallet...</span>
                    </div>
                  </div>

                  <div className="clash-qris-banks-row">
                    <span>BCA · Mandiri · BRI · BNI · GoPay · ShopeePay · OVO · Dana</span>
                  </div>

                  {/* ACTIONS */}
                  <div className="clash-qris-actions">
                    <a
                      href={activeQris.paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="clash-btn-open-payment"
                      onClick={() => campusAudio.play('tap')}
                    >
                      <ExternalLink size={16} />
                      <span>Buka Aplikasi Pembayaran ↗</span>
                    </a>
                    <button
                      type="button"
                      className="clash-btn-cancel-qris"
                      onClick={() => {
                        campusAudio.play('tap');
                        setActiveQris(null);
                      }}
                    >
                      ✕ Batal / Ganti Paket
                    </button>
                  </div>
                </div>
              ) : (
                /* =======================================================
                   READY TO CHECKOUT WITH DUITKU
                   ======================================================= */
                <div className="clash-topup-checkout">
                  <div className="clash-checkout-summary">
                    <span>Paket Terpilih:</span>
                    <strong>{selectedPkg.coins} Koin</strong>
                    <span className="clash-checkout-dot">·</span>
                    <strong className="clash-checkout-price">
                      Rp {selectedPkg.price_idr.toLocaleString('id-ID')}
                    </strong>
                  </div>

                  {/* PRIMARY ACTION: DUITKU DYNAMIC QRIS */}
                  <button
                    type="button"
                    className="clash-btn-duitku-qris"
                    onClick={handleCreateDuitkuQris}
                    disabled={creatingQris}
                  >
                    <span className="clash-btn-duitku-title">
                      {creatingQris ? 'Membuat QRIS...' : 'Buat kode pembayaran QRIS'}
                    </span>
                    <span className="clash-btn-duitku-sub">
                      {selectedPkg.coins} koin · Rp {selectedPkg.price_idr.toLocaleString('id-ID')}
                    </span>
                  </button>

                  {/* TOGGLE ALTERNATIVE SAWERIA */}
                  <div className="clash-saweria-toggle-wrap">
                    <button
                      type="button"
                      className="clash-btn-toggle-saweria"
                      onClick={() => setShowSaweriaFallback(!showSaweriaFallback)}
                    >
                      <span>
                        {showSaweriaFallback ? '▲ Tutup Pilihan Saweria' : '▼ Atau Gunakan Saweria'}
                      </span>
                    </button>
                  </div>

                  {showSaweriaFallback && (
                    <div className="clash-saweria-fallback-box">
                      <div className="clash-code-box">
                        <div className="clash-code-meta">
                          <small>KODE PESAN DI SAWERIA:</small>
                          <strong className="clash-code-text">TOPUP-{profile.id}</strong>
                        </div>
                        <button
                          type="button"
                          className={'clash-btn-copy' + (copied ? ' is-copied' : '')}
                          onClick={handleCopyCode}
                        >
                          {copied ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copied ? 'Tersalin!' : 'Salin'}</span>
                        </button>
                      </div>

                      <div className="clash-checkout-actions">
                        <a
                          href={`https://saweria.co/${saweriaUser}?amount=${selectedPkg.price_idr}&msg=TOPUP-${profile.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="clash-btn-saweria-pay"
                          onClick={() => campusAudio.play('tap')}
                        >
                          <span>Buka Saweria</span>
                          <ExternalLink size={16} />
                        </a>
                        <button
                          type="button"
                          className="clash-btn-check-pay"
                          onClick={handleManualCheck}
                          disabled={checkingPayment}
                        >
                          <RefreshCw size={14} className={checkingPayment ? 'is-spinning' : ''} />
                          <span>{checkingPayment ? 'Mengecek…' : 'Cek'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* LIVE LISTENING RADAR */}
                  <div className="clash-radar-notice">
                    <div className="clash-radar-dot" />
                    <span>Saldo diperbarui setelah pembayaran terkonfirmasi.</span>
                  </div>
                </div>
              )
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
          <div className="shop-catalog-layout">
            {/* LIVE 3D FITTING ROOM STAGE (KAMAR PAS) */}
            <div
              className={'clash-fitting-stage' + (isTrying ? ' is-trying' : '')}
              ref={fittingRef}
            >
              <div className="clash-fitting-model">
                <AvatarPreview config={previewAvatar} interactive />
              </div>
              <div className="clash-fitting-info">
                <div className="clash-fitting-badge">
                  <Sparkles size={13} /> {isTrying ? 'KAMAR PAS · PREVIEW' : 'AVATAR SAAT INI'}
                </div>
                <div className="clash-fitting-title">{profile?.nickname || 'Karakter Kamu'}</div>
                <div className="clash-fitting-slots">
                  <div className="clash-slot-pill">
                    <span>
                      <HardHat size={12} aria-hidden="true" /> Topi
                    </span>
                    <strong>
                      {items.find((i) => i.id === previewAvatar.headwear)?.name ||
                        (previewAvatar.headwear === 'topi_beret_bear'
                          ? 'Topi Beret Beruang'
                          : previewAvatar.headwear
                            ? 'Topi Khusus'
                            : 'Belum dipakai')}
                    </strong>
                  </div>
                  <div className="clash-slot-pill">
                    <span>
                      <Glasses size={12} aria-hidden="true" /> Kacamata
                    </span>
                    <strong>
                      {previewAvatar.eyewear === 'pixel_sunglasses'
                        ? 'Kacamata Pixel'
                        : previewAvatar.eyewear === 'anime_sunglasses'
                          ? 'Kacamata Anime'
                          : 'Belum dipakai'}
                    </strong>
                  </div>
                  <div className="clash-slot-pill">
                    <span>
                      <Shirt size={12} aria-hidden="true" /> Baju
                    </span>
                    <strong>
                      {items.find((i) => i.id === previewAvatar.outfit)?.name ||
                        (previewAvatar.outfit && previewAvatar.outfit.startsWith('row4_')
                          ? 'Baju Khusus'
                          : 'Baju Standar')}
                    </strong>
                  </div>
                </div>
                <div className="clash-fitting-hint">
                  Geser karakter untuk melihat dari sisi lain.
                </div>
                <div className="shop-fitting-notice" role="status">
                  {isTrying
                    ? `${triedItems.length} item sedang dicoba. Koin tidak berkurang.`
                    : 'Coba item gratis sebelum menentukan pilihan.'}
                </div>
                {isTrying && (
                  <>
                    <div className="shop-tried-items" aria-label="Item yang sedang dicoba">
                      {triedItems.map((item) => (
                        <span key={item.id}>{item.name}</span>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="shop-reset-fitting"
                      onClick={() => setTryOn({})}
                    >
                      <RotateCcw size={14} aria-hidden="true" />
                      Kembalikan tampilan
                    </button>
                  </>
                )}
              </div>
            </div>

            <section className="shop-catalog" aria-label="Katalog item avatar">
              <div className="shop-catalog-heading">
                <div>
                  <h3>Temukan gaya kamu</h3>
                  <p>Aksesoris dan pakaian untuk cerita berikutnya.</p>
                </div>
                <span className="shop-item-count" role="status">
                  {filteredItems.length} item
                </span>
              </div>
              <label className="shop-search">
                <Search size={17} aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Cari item toko"
                  placeholder="Cari nama item…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <div className="shop-filters">
                <div className="shop-categories" role="group" aria-label="Kategori item">
                  {categories.map(({ id, label, icon: Icon }) => (
                    <button
                      type="button"
                      key={id}
                      aria-pressed={category === id}
                      onClick={() => setCategory(id)}
                    >
                      <Icon size={15} aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="shop-owned-filter"
                  aria-pressed={ownedOnly}
                  onClick={() => setOwnedOnly(!ownedOnly)}
                >
                  <Check size={15} aria-hidden="true" />
                  Milikku
                </button>
              </div>
              <div className="clash-cards-grid">
                {filteredItems.map((item) =>
                  renderCard(item, item.category === 'headwear' ? 'minis' : 'heroes'),
                )}
              </div>
              {filteredItems.length === 0 && (
                <div className="shop-empty">
                  <ShoppingBag size={28} />
                  <h3>{ownedOnly ? 'Koleksimu dimulai di sini' : 'Belum ada yang cocok'}</h3>
                  <p>
                    {ownedOnly
                      ? 'Item yang sudah kamu miliki akan muncul di sini.'
                      : 'Coba kata kunci atau kategori lain.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCategory('all');
                      setQuery('');
                      setOwnedOnly(false);
                    }}
                  >
                    Lihat semua item <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* FOOTER BAR */}
      <footer className="clash-shop-footer">
        <div className="clash-footer-hint">
          <Sparkles size={14} className="clash-sparkle-icon" />
          <span>
            {view === 'topup'
              ? 'Koin ditambahkan setelah pembayaran terkonfirmasi.'
              : 'Aksesoris otomatis aktif & tersimpan pada karaktermu!'}
          </span>
        </div>
        <button
          type="button"
          className="clash-btn-done"
          onClick={onClose}
          title="Kembali ke petualangan kampus"
        >
          Kembali ke dunia <ArrowRight size={16} />
        </button>
      </footer>
    </div>
  );
}
