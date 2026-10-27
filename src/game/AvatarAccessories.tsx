import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

export function TopiBeretBear({ scale = 0.92 }: { scale?: number }) {
  const { scene } = useGLTF('/models/topi_beret_bear.glb', false, true);
  const model = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return copy;
  }, [scene]);

  return (
    <group position={[0, 1.68, -0.03]} scale={scale}>
      <primitive object={model} />
    </group>
  );
}

export function PixelSunglasses({ scale = 0.9 }: { scale?: number }) {
  const { scene } = useGLTF('/models/pixel_sunglasses.glb', false, true);
  const model = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return copy;
  }, [scene]);

  return (
    <group position={[0, 1.42, 0.27]} scale={scale}>
      <primitive object={model} />
    </group>
  );
}

export function AnimeSunglasses({ scale = 0.9 }: { scale?: number }) {
  const { scene } = useGLTF('/models/anime_sunglasses.glb', false, true);
  const model = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return copy;
  }, [scene]);

  return (
    <group position={[0, 1.42, 0.27]} scale={scale}>
      <primitive object={model} />
    </group>
  );
}

export function AvatarAccessories({
  headwear,
  eyewear,
}: {
  headwear?: string | null;
  eyewear?: string | null;
}) {
  return (
    <>
      {headwear === 'topi_beret_bear' && <TopiBeretBear />}
      {eyewear === 'pixel_sunglasses' && <PixelSunglasses />}
      {eyewear === 'anime_sunglasses' && <AnimeSunglasses />}
    </>
  );
}

useGLTF.preload('/models/topi_beret_bear.glb', false, true);
useGLTF.preload('/models/pixel_sunglasses.glb', false, true);
useGLTF.preload('/models/anime_sunglasses.glb', false, true);
