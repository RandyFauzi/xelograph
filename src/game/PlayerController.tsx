import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  inputDirection,
  moveWithCollision,
  MISSION_ZONES,
  headingForMovement,
} from './navigation.mjs';
import { campusAudio } from './audio';
import { createJumpState, stepJump } from './jump.mjs';
export type PathPoint = { x: number; z: number };
export function usePlayerMotion({
  group,
  position,
  path,
  keys,
  stick,
  active,
  unlocked,
  onNear,
  mapDot,
}: {
  group: React.RefObject<THREE.Group | null>;
  position: React.RefObject<THREE.Vector3>;
  path: React.RefObject<PathPoint[]>;
  keys: React.RefObject<Set<string>>;
  stick: React.RefObject<{ x: number; y: number }>;
  active: boolean;
  unlocked: number;
  onNear: (i: number) => void;
  mapDot: React.RefObject<SVGCircleElement | null>;
}) {
  const { camera } = useThree();
  const walking = useRef(false),
    forward = useRef(new THREE.Vector3()),
    elapsed = useRef(0),
    lastNear = useRef(-1),
    jump = useRef(createJumpState()),
    footstep = useRef(0);
  useEffect(() => {
    if (!active) {
      path.current = [];
      keys.current.clear();
      stick.current = { x: 0, y: 0 };
      walking.current = false;
      jump.current = createJumpState();
      if (group.current) {
        group.current.position.y = 0.28;
        position.current.copy(group.current.position);
      }
    }
  }, [active, path, keys, stick]);
  useFrame((_, rawDt) => {
    if (!group.current) return;
    const dt = Math.min(rawDt, 0.04),
      p = group.current.position;
    elapsed.current += dt;
    if (!active) {
      walking.current = false;
      return;
    }
    let hx =
      (keys.current.has('d') || keys.current.has('arrowright') ? 1 : 0) -
      (keys.current.has('a') || keys.current.has('arrowleft') ? 1 : 0) +
      stick.current.x;
    let vy =
      (keys.current.has('s') || keys.current.has('arrowdown') ? 1 : 0) -
      (keys.current.has('w') || keys.current.has('arrowup') ? 1 : 0) +
      stick.current.y;
    let dx = 0,
      dz = 0;
    const speed = keys.current.has('shift') ? 6 : 3.6;
    if (Math.hypot(hx, vy) > 0.08) {
      path.current = [];
      camera.getWorldDirection(forward.current);
      const d = inputDirection(hx, vy, forward.current);
      dx = d.x * speed * dt;
      dz = d.z * speed * dt;
    } else if (path.current.length) {
      const target = path.current[0],
        x = target.x - p.x,
        z = target.z - p.z,
        len = Math.hypot(x, z);
      if (len < 0.1) path.current.shift();
      else {
        const step = Math.min(speed * dt, len);
        dx = (x / len) * step;
        dz = (z / len) * step;
      }
    }
    const moved = moveWithCollision(p, { x: dx, z: dz }, unlocked);
    walking.current = Math.hypot(moved.x - p.x, moved.z - p.z) > 0.0001;
    if (walking.current) {
      const target = headingForMovement(moved.x - p.x, moved.z - p.z);
      group.current.rotation.y +=
        Math.atan2(
          Math.sin(target - group.current.rotation.y),
          Math.cos(target - group.current.rotation.y),
        ) * Math.min(dt * 14, 1);
    } else if (dx || dz) path.current = [];
    const wasAirborne = jump.current.height > 0;
    jump.current = stepJump(jump.current, dt, keys.current.delete('jump'));
    if (!wasAirborne && jump.current.velocity > 0) campusAudio.play('jump');
    if (wasAirborne && jump.current.height === 0) campusAudio.play('land');
    footstep.current += dt;
    if (
      walking.current &&
      jump.current.height === 0 &&
      footstep.current > (keys.current.has('shift') ? 0.22 : 0.34)
    ) {
      campusAudio.play('step');
      footstep.current = 0;
    }
    p.y = 0.28 + jump.current.height;
    p.x = moved.x;
    p.z = moved.z;
    position.current.copy(p);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      group.current.children[0].position.y = walking.current
        ? Math.sin(elapsed.current * 16) * 0.035
        : Math.sin(elapsed.current * 2) * 0.01;
    mapDot.current?.setAttribute('cx', String((p.x + 25) * 2));
    mapDot.current?.setAttribute('cy', String((p.z + 21) * (100 / 56)));
    let near = -1;
    MISSION_ZONES.forEach(([x, z], i) => {
      if (i <= unlocked && Math.hypot(p.x - x, p.z - z) < 2.25) near = i;
    });
    if (near !== lastNear.current) {
      lastNear.current = near;
      onNear(near);
    }
  });
  return walking;
}
export function CameraFollow({
  controls,
  position,
  playing,
  overview,
}: {
  controls: React.RefObject<any>;
  position: React.RefObject<THREE.Vector3>;
  playing: boolean;
  overview: boolean;
}) {
  const { camera } = useThree();
  const tween = useRef(0),
    goal = useRef(new THREE.Vector3()),
    delta = useRef(new THREE.Vector3()),
    offset = useRef(new THREE.Vector3());
  useEffect(() => {
    tween.current = 1.6;
  }, [playing, overview]);
  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    if (playing && !overview) goal.current.copy(position.current);
    else goal.current.set(0, 0, 0);
    goal.current.y = playing && !overview ? position.current.y + 1.05 : 0.65;
    delta.current
      .copy(goal.current)
      .sub(c.target)
      .multiplyScalar(Math.min(dt * 4, 1));
    camera.position.add(delta.current);
    c.target.add(delta.current);
    if (tween.current > 0) {
      tween.current -= dt;
      offset.current.copy(camera.position).sub(c.target);
      const distance =
        playing && !overview
          ? window.innerWidth < 760
            ? 15
            : 23
          : window.innerWidth < 760
            ? 63
            : 62;
      offset.current.setLength(
        THREE.MathUtils.lerp(offset.current.length(), distance, Math.min(dt * 3, 1)),
      );
      camera.position.copy(c.target).add(offset.current);
    }
    c.update();
  });
  return null;
}
