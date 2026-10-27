import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { ShoppingBag } from 'lucide-react';
import { SHOP_BUILDING, shopProximity } from './shopBuilding.mjs';

function createShopSignTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Crisp clean white board with blue accent borders
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 128);

  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, 500, 116);

  ctx.strokeStyle = '#93c5fd';
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, 484, 100);

  // Big bold "SHOP" with shadow
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 68px "Arial Black", Impact, sans-serif';
  ctx.letterSpacing = '6px';

  ctx.fillStyle = '#1e3a8a';
  ctx.fillText('S H O P', 258, 67);
  ctx.fillStyle = '#2563eb';
  ctx.fillText('S H O P', 256, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export default function ShopBuilding({
  player,
  active,
  playing,
  onNear,
  onOpen,
}: {
  player: React.RefObject<THREE.Vector3>;
  active: boolean;
  playing: boolean;
  onNear: (near: boolean) => void;
  onOpen: () => void;
}) {
  const signTexture = useMemo(() => createShopSignTexture(), []);

  const latched = useRef(false),
    near = useRef(false),
    timer = useRef(0);

  useFrame((_, dt) => {
    timer.current += dt;
    if (timer.current < 0.1) return;
    timer.current = 0;
    const prox = shopProximity(player.current, latched.current, active);
    latched.current = prox.latched;
    if (near.current !== prox.near) {
      near.current = prox.near;
      onNear(prox.near);
    }
    if (prox.open) onOpen();
  });

  const handleTrigger = () => {
    if (!active) return;
    latched.current = true;
    onOpen();
  };

  return (
    <group position={[SHOP_BUILDING.x, 0, 0]}>
      {/* 3D Signboard covering KOPI & KENANGAN */}
      <mesh position={[0, 2.76, -10.33]} rotation={[0, 0, 0]}>
        <boxGeometry args={[3.8, 0.46, 0.08]} />
        <meshStandardMaterial
          map={signTexture || undefined}
          color="#ffffff"
          roughness={0.2}
          metalness={0.1}
        />
      </mesh>

      {/* Floating 3D Map Pin */}
      {playing && (
        <Html position={[0, 3.65, -10.4]} center zIndexRange={[9, 0]}>
          <button
            type="button"
            disabled={!active}
            className="map-pin shop-pin"
            onClick={(event) => {
              event.stopPropagation();
              handleTrigger();
            }}
            aria-label="Masuk ke Shop Toko Avatar"
          >
            <span>
              <ShoppingBag size={11} fill="currentColor" />
            </span>
            <b>Shop</b>
          </button>
        </Html>
      )}
    </group>
  );
}
