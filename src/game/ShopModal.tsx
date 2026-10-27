import { useState, useEffect } from 'react';
import { ShoppingBag, Coins, Check, ArrowRight, Sparkles } from 'lucide-react';
import { api } from '../api';
import { campusAudio } from './audio';
import type { AvatarConfig, Profile, StoreItem } from '../types';

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
  const [coins, setCoins] = useState(100);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [inventory, setInventory] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<'all' | 'headwear' | 'eyewear'>('all');

  const curAvatar = profile?.avatar;
  const [previewAvatar, setPreviewAvatar] = useState<AvatarConfig | null>(curAvatar || null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const data = await api<{
          coins: number;
          items: StoreItem[];
          inventory: string[];
          equipped: string[];
        }>('/store');
        if (alive && data) {
          setCoins(data.coins ?? 100);
          setItems(data.items || []);
          setInventory(data.inventory || []);
        }
      } catch {
        // Fallback or guest
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleBuy = async (item: StoreItem) => {
    if (!profile) {
      onJoin();
      return;
    }
    if (coins < item.price_coins) {
      onToast('Koin tidak cukup! Selesaikan misi untuk koin tambahan.');
      return;
    }
    setBusyItem(item.id);
    try {
      const res = await api<{ ok: boolean; coins: number; itemId: string }>('/store/buy', {
        method: 'POST',
        body: JSON.stringify({ itemId: item.id }),
      });
      if (res?.ok) {
        setCoins(res.coins);
        setInventory((prev) => [...prev, item.id]);
        campusAudio.play('success');
        onToast(`Berhasil membeli ${item.name}! 🎉`);

        // Automatically equip newly purchased item
        await handleEquip(item, 'equip');
      }
    } catch (e) {
      onToast((e as Error).message);
    } finally {
      setBusyItem(null);
    }
  };

  const handleEquip = async (item: StoreItem, action: 'equip' | 'unequip') => {
    if (!profile) return;
    setBusyItem(item.id);
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
        setPreviewAvatar(updated.avatar);
        campusAudio.play('tap');
        onToast(
          action === 'equip'
            ? `${item.name} berhasil dipakai!`
            : `${item.name} dilepas.`,
        );
      }
    } catch (e) {
      onToast((e as Error).message);
    } finally {
      setBusyItem(null);
    }
  };

  const filteredItems = items.filter(
    (item) => activeCategory === 'all' || item.category === activeCategory,
  );

  return (
    <div className="shop-showcase">
      <header className="shop-showcase-header">
        <div className="shop-title-area">
          <div className="dialog-eyebrow">
            <ShoppingBag size={14} /> FITTING ROOM &amp; TOKO AVATAR
          </div>
          <h2>
            Shop
            <br />
            <em>Aksesoris Kampus.</em>
          </h2>
        </div>
        <div className="shop-wallet-badge" role="status">
          <Coins size={18} className="shop-coin-icon" />
          <div>
            <small>SALDO KOIN</small>
            <strong>{coins} 🪙</strong>
          </div>
        </div>
      </header>

      <div className="shop-category-tabs">
        <button
          type="button"
          className={'shop-tab' + (activeCategory === 'all' ? ' is-active' : '')}
          onClick={() => setActiveCategory('all')}
        >
          Semua Aksesoris
        </button>
        <button
          type="button"
          className={'shop-tab' + (activeCategory === 'headwear' ? ' is-active' : '')}
          onClick={() => setActiveCategory('headwear')}
        >
          🎩 Topi &amp; Kepala
        </button>
        <button
          type="button"
          className={'shop-tab' + (activeCategory === 'eyewear' ? ' is-active' : '')}
          onClick={() => setActiveCategory('eyewear')}
        >
          🕶️ Kacamata
        </button>
      </div>

      <div className="shop-items-grid">
        {loading ? (
          <div className="shop-loading">Memuat katalog shop…</div>
        ) : filteredItems.length === 0 ? (
          <div className="shop-empty">Tidak ada item dalam kategori ini.</div>
        ) : (
          filteredItems.map((item) => {
            const isOwned = inventory.includes(item.id);
            const isEquipped =
              (item.category === 'headwear' && curAvatar?.headwear === item.id) ||
              (item.category === 'eyewear' && curAvatar?.eyewear === item.id);
            const isBusy = busyItem === item.id;

            return (
              <div
                key={item.id}
                className={'shop-item-card' + (isEquipped ? ' is-equipped' : '')}
              >
                <div className="shop-item-preview">
                  <img src={item.preview_url} alt={item.name} loading="lazy" />
                  {isEquipped && (
                    <span className="shop-equipped-tag">
                      <Check size={11} /> Dipakai
                    </span>
                  )}
                </div>
                <div className="shop-item-info">
                  <small className="shop-item-category">
                    {item.category === 'headwear' ? 'TOPI' : 'KACAMATA'}
                  </small>
                  <strong>{item.name}</strong>
                  <p>{item.description}</p>
                </div>
                <div className="shop-item-actions">
                  <span className="shop-item-price">
                    <Coins size={14} /> {item.price_coins} Koin
                  </span>
                  {isOwned ? (
                    isEquipped ? (
                      <button
                        type="button"
                        className="shop-action-btn is-unequip"
                        disabled={isBusy}
                        onClick={() => handleEquip(item, 'unequip')}
                      >
                        Lepas
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="shop-action-btn is-equip"
                        disabled={isBusy}
                        onClick={() => handleEquip(item, 'equip')}
                      >
                        Pakai
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      className="shop-action-btn is-buy"
                      disabled={isBusy || coins < item.price_coins}
                      onClick={() => handleBuy(item)}
                    >
                      Beli
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="shop-footer-bar">
        <div className="shop-footer-note">
          <Sparkles size={14} />
          <span>Aksesoris yang dipakai otomatis terlihat oleh pengunjung lain yang berpapasan!</span>
        </div>
        <button type="button" className="primary" onClick={onClose}>
          Selesai belanja <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}
