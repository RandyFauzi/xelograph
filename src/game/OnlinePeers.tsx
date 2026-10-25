import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { avatarPartVisible } from './avatarParts.mjs';
import { headingForMovement } from './navigation.mjs';
import { COLORS, DEFAULT_AVATAR, type OnlinePeer } from '../types';

const reduceMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function OnlinePeerCharacter({
  peer,
  playing,
}: {
  peer: OnlinePeer;
  playing: boolean;
}) {
  const { scene } = useGLTF('/models/avatar.glb');
  const config = peer.avatar || DEFAULT_AVATAR;

  const model = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.visible = avatarPartVisible(o.name, config);
        const m = (o.material as THREE.MeshStandardMaterial).clone();
        if (m.name === 'AvatarShirt') m.color.set(COLORS[config.outfit] || COLORS.navy);
        if (m.name === 'AvatarSkin') m.color.set(COLORS[config.skin] || COLORS.warm);
        o.material = m;
      }
    });
    return copy;
  }, [scene, config.outfit, config.skin, config.hair, config.character]);

  useEffect(
    () => () => {
      model.traverse((o) => {
        if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose();
      });
    },
    [model],
  );

  const limbs = useMemo(
    () =>
      ['Arm_L', 'Arm_R', 'Leg_L', 'Leg_R'].map((name) => {
        const object = model.getObjectByName(name);
        return object ? { object, rest: object.quaternion.clone(), angle: 0 } : null;
      }),
    [model],
  );

  const group = useRef<THREE.Group>(null);
  const target = useRef({ x: peer.x, z: peer.z });
  const initialized = useRef(false);
  const moving = useRef(false);
  const swing = useMemo(() => new THREE.Quaternion(), []);
  const phase = useMemo(
    () =>
      peer.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) * 0.37,
    [peer.id],
  );

  useEffect(() => {
    target.current = { x: peer.x, z: peer.z };
    if (group.current && !initialized.current) {
      group.current.position.set(peer.x, 0.28, peer.z);
      initialized.current = true;
    }
  }, [peer.x, peer.z]);

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    const dx = target.current.x - g.position.x;
    const dz = target.current.z - g.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 14) {
      g.position.set(target.current.x, 0.28, target.current.z);
      moving.current = false;
    } else if (dist > 0.04) {
      moving.current = true;
      const step = Math.min(dist, dt * 3.8);
      g.position.x += (dx / dist) * step;
      g.position.z += (dz / dist) * step;
      g.position.y = 0.28;
      const desiredYaw = headingForMovement(dx, dz);
      const diff = Math.atan2(
        Math.sin(desiredYaw - g.rotation.y),
        Math.cos(desiredYaw - g.rotation.y),
      );
      g.rotation.y += diff * Math.min(1, dt * 10);
    } else {
      moving.current = false;
      if (!reduceMotion) {
        g.position.y = 0.28 + Math.sin(clock.elapsedTime * 2.2 + phase) * 0.008;
      }
    }

    if (!reduceMotion) {
      const t = clock.elapsedTime * 10 + phase;
      limbs.forEach((limb, i) => {
        if (!limb) return;
        const limbTarget = moving.current
          ? Math.sin(t + (i === 0 || i === 3 ? Math.PI : 0)) * 0.42
          : 0;
        limb.angle = THREE.MathUtils.lerp(limb.angle, limbTarget, Math.min(dt * 16, 1));
        swing.setFromAxisAngle(new THREE.Vector3(1, 0, 0), limb.angle);
        limb.object.quaternion.copy(limb.rest).multiply(swing);
      });
    }
  });

  return (
    <group ref={group} position={[peer.x, 0.28, peer.z]}>
      <primitive object={model} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.33, 0.4, 24]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.82} depthWrite={false} />
      </mesh>
      {playing && (
        <Html position={[0, 1.98, 0]} center zIndexRange={[8, 0]}>
          <span className="online-peer-label">
            <i />
            <b>{peer.nickname}</b>
            <small>ONLINE</small>
          </span>
        </Html>
      )}
    </group>
  );
}

export default function OnlinePeers({
  peers,
  playing,
}: {
  peers: OnlinePeer[];
  playing: boolean;
}) {
  const visiblePeers = useMemo(() => peers.slice(0, 5), [peers]);
  return (
    <group name="OnlinePeersGroup">
      {visiblePeers.map((peer) => (
        <OnlinePeerCharacter key={peer.id} peer={peer} playing={playing} />
      ))}
    </group>
  );
}
