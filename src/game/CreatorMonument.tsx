import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { CREATOR_MONUMENT, creatorProximity } from './creatorMonument.mjs';

export default function CreatorMonument({
  player,
  active,
  onNear,
  onOpen,
  onWalk,
}: {
  player: React.RefObject<THREE.Vector3>;
  active: boolean;
  onNear: (near: boolean) => void;
  onOpen: () => void;
  onWalk: (point: { x: number; z: number }) => void;
}) {
  const texture = useTexture(CREATOR_MONUMENT.asset);
  const latched = useRef(false),
    near = useRef(false),
    timer = useRef(0);
  useFrame((_, dt) => {
    timer.current += dt;
    if (timer.current < 0.1) return;
    timer.current = 0;
    const state = creatorProximity(player.current, latched.current, active);
    latched.current = state.latched;
    if (near.current !== state.near) {
      near.current = state.near;
      onNear(state.near);
    }
    if (state.open) onOpen();
  });
  return (
    <Billboard position={[CREATOR_MONUMENT.x, 2.13, CREATOR_MONUMENT.z]} follow lockX lockZ>
      <mesh
        onClick={(event) => {
          if (!active) return;
          event.stopPropagation();
          if (near.current) {
            latched.current = true;
            onOpen();
          } else onWalk({ x: CREATOR_MONUMENT.x, z: CREATOR_MONUMENT.z + 2.2 });
        }}
      >
        <planeGeometry args={[3.5, 3.5]} />
        <meshBasicMaterial
          map={texture}
          transparent
          alphaTest={0.025}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </Billboard>
  );
}
