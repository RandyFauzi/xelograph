import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { avatarPartVisible } from './avatarParts.mjs';
import { headingForMovement, isWalkable } from './navigation.mjs';
import { COLORS, DEFAULT_AVATAR, type OnlinePeer } from '../types';
import { AvatarAccessories } from './AvatarAccessories';

const reduceMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function OnlinePeerCharacter({
  peer,
  playing,
  bubbleText,
}: {
  peer: OnlinePeer;
  playing: boolean;
  bubbleText?: string;
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
  const netState = useRef({
    x: peer.x,
    z: peer.z,
    vx: peer.vx || 0,
    vz: peer.vz || 0,
    moving: !!peer.moving,
    sincePacket: 0,
  });
  const initialized = useRef(false);
  const moving = useRef(false);
  const moveHold = useRef(0);
  const swing = useMemo(() => new THREE.Quaternion(), []);
  const phase = useMemo(
    () =>
      peer.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) * 0.37,
    [peer.id],
  );

  useEffect(() => {
    const prev = netState.current;
    const dx = peer.x - prev.x;
    const dz = peer.z - prev.z;
    const dist = Math.hypot(dx, dz);
    // Estimate velocity from position delta if server vx/vz wasn't non-zero
    const inferredVx = dist > 0.04 && dist < 12 ? dx / 0.85 : 0;
    const inferredVz = dist > 0.04 && dist < 12 ? dz / 0.85 : 0;
    netState.current = {
      x: peer.x,
      z: peer.z,
      vx: peer.vx || inferredVx,
      vz: peer.vz || inferredVz,
      moving: Boolean(peer.moving || dist > 0.05),
      sincePacket: 0,
    };
    if (dist > 0.05 || peer.moving) {
      moveHold.current = 0.45;
    }
    if (group.current && !initialized.current) {
      group.current.position.set(peer.x, 0.28, peer.z);
      initialized.current = true;
    }
  }, [peer.x, peer.z, peer.vx, peer.vz, peer.moving]);

  useFrame(({ clock }, rawDt) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.1);
    const net = netState.current;
    net.sincePacket += dt;

    // Gentle dead-reckoning extrapolation up to 0.55s when actively moving
    const lead = net.moving ? Math.min(net.sincePacket, 0.55) * 0.55 : 0;
    let targetX = net.x + net.vx * lead;
    let targetZ = net.z + net.vz * lead;
    if (!isWalkable(targetX, targetZ, 6)) {
      targetX = net.x;
      targetZ = net.z;
    }

    const dx = targetX - g.position.x;
    const dz = targetZ - g.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 15) {
      g.position.set(net.x, 0.28, net.z);
      moveHold.current = 0;
      moving.current = false;
    } else if (dist > 0.025) {
      moveHold.current = Math.max(moveHold.current, 0.32);
      // Smooth adaptive speed: glides steadily without stopping between 800ms packets
      const speed = THREE.MathUtils.clamp(dist * 3.4 + 1.8, 2.4, 7.8);
      const step = Math.min(dist, speed * dt);
      g.position.x = THREE.MathUtils.damp(
        g.position.x,
        g.position.x + (dx / dist) * step,
        18,
        dt,
      );
      g.position.z = THREE.MathUtils.damp(
        g.position.z,
        g.position.z + (dz / dist) * step,
        18,
        dt,
      );
      g.position.y = 0.28;
      if (dist > 0.04) {
        const desiredYaw = headingForMovement(dx, dz);
        const diff = Math.atan2(
          Math.sin(desiredYaw - g.rotation.y),
          Math.cos(desiredYaw - g.rotation.y),
        );
        g.rotation.y += diff * Math.min(1, dt * 12);
      }
    } else {
      moveHold.current = Math.max(0, moveHold.current - dt);
      if (moveHold.current <= 0 && !reduceMotion) {
        g.position.y = 0.28 + Math.sin(clock.elapsedTime * 2.2 + phase) * 0.008;
      }
    }

    moving.current = moveHold.current > 0;

    if (!reduceMotion) {
      const t = clock.elapsedTime * 10.5 + phase;
      limbs.forEach((limb, i) => {
        if (!limb) return;
        const limbTarget = moving.current
          ? Math.sin(t + (i === 0 || i === 3 ? Math.PI : 0)) * 0.44
          : 0;
        limb.angle = THREE.MathUtils.lerp(limb.angle, limbTarget, Math.min(dt * 14, 1));
        swing.setFromAxisAngle(new THREE.Vector3(1, 0, 0), limb.angle);
        limb.object.quaternion.copy(limb.rest).multiply(swing);
      });
    }
  });

  return (
    <group ref={group} position={[peer.x, 0.28, peer.z]}>
      <primitive object={model} />
      <AvatarAccessories headwear={config.headwear} eyewear={config.eyewear} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.33, 0.4, 24]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.82} depthWrite={false} />
      </mesh>
      {playing && (
        <>
          <Html position={[0, 1.98, 0]} center zIndexRange={[8, 0]}>
            <span className="online-peer-label">
              <i />
              <b>{peer.nickname || 'Teman Alumni'}</b>
              <small>ONLINE</small>
            </span>
          </Html>
          {bubbleText && (
            <Html position={[0, 2.45, 0]} center zIndexRange={[14, 0]}>
              <div className="chat-speech-bubble" role="status">
                <p>{bubbleText}</p>
              </div>
            </Html>
          )}
        </>
      )}
    </group>
  );
}

export default function OnlinePeers({
  peers,
  playing,
  activeBubbles = {},
}: {
  peers: OnlinePeer[];
  playing: boolean;
  activeBubbles?: Record<string, string>;
}) {
  const visiblePeers = useMemo(() => peers.slice(0, 5), [peers]);
  return (
    <group name="OnlinePeersGroup">
      {visiblePeers.map((peer) => {
        const bubbleText =
          activeBubbles[peer.id.toLowerCase()] ||
          (peer.nickname ? activeBubbles[peer.nickname.toLowerCase().trim()] : undefined) ||
          (peer.alumniId ? activeBubbles[peer.alumniId.toLowerCase()] : undefined);
        return (
          <OnlinePeerCharacter
            key={peer.id}
            peer={peer}
            playing={playing}
            bubbleText={bubbleText}
          />
        );
      })}
    </group>
  );
}
