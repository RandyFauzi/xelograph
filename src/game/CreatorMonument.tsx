import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
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
  const { scene } = useGLTF(CREATOR_MONUMENT.model, false, true);
  const model = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        object.material = Array.isArray(object.material)
          ? object.material.map((m) => m.clone())
          : object.material.clone();
      }
    });
    return copy;
  }, [scene]);
  useEffect(
    () => () => {
      model.traverse((object) => {
        if (object instanceof THREE.Mesh)
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            material.dispose();
      });
    },
    [model],
  );
  const crystal = useMemo(() => {
    const mesh = model.getObjectByName('CreatorCrystal') as
      THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | undefined;
    return mesh ? { mesh, y: mesh.position.y, emission: mesh.material.emissiveIntensity } : null;
  }, [model]);
  const particles = useRef<THREE.Points>(null);
  const specks = useMemo(() => new Float32Array(18), []);
  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const latched = useRef(false),
    near = useRef(false),
    timer = useRef(0);
  useFrame((_, dt) => {
    const time = _.clock.elapsedTime;
    const animate =
      active &&
      !reducedMotion &&
      Math.hypot(player.current.x - CREATOR_MONUMENT.x, player.current.z - CREATOR_MONUMENT.z) < 10;
    if (crystal) {
      crystal.mesh.position.y = crystal.y + (animate ? Math.sin(time * 1.4) * 0.012 : 0);
      crystal.mesh.material.emissiveIntensity =
        crystal.emission * (animate ? 0.9 + Math.sin(time * 1.2) * 0.1 : 1);
    }
    if (particles.current) {
      particles.current.visible = animate;
      if (animate) {
        for (let i = 0; i < 6; i++) {
          specks[i * 3] = Math.cos(i * 2.4 + time * 0.16) * 0.32;
          specks[i * 3 + 1] = 0.2 + ((time * 0.07 + i / 6) % 1) * 0.58;
          specks[i * 3 + 2] = Math.sin(i * 2.4 + time * 0.16) * 0.28;
        }
        particles.current.geometry.attributes.position.needsUpdate = true;
      }
    }
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
    <group
      position={[CREATOR_MONUMENT.x, 0.12, CREATOR_MONUMENT.z]}
      rotation={[0, 0.18, 0]}
      onClick={(event) => {
        if (!active) return;
        event.stopPropagation();
        if (near.current) {
          latched.current = true;
          onOpen();
        } else onWalk({ x: CREATOR_MONUMENT.x, z: CREATOR_MONUMENT.z + 1.3 });
      }}
    >
      <primitive object={model} />
      <points ref={particles} raycast={() => {}}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[specks, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#88c6ce"
          size={0.015}
          transparent
          opacity={0.28}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
    </group>
  );
}
