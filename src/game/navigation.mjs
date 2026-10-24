export const WORLD_BOUNDS = { minX: -24, maxX: 24, minZ: -20, maxZ: 34 };
// Blender's -Y face direction exports to glTF +Z. Yaw zero therefore faces +Z.
export function headingForMovement(dx, dz) {
  return Math.atan2(dx, dz);
}
export const MISSION_ZONES = [
  [-6, 6],
  [-9, 1],
  [-8, -4],
  [7, -4],
  [10, 1],
  [7, 6],
  [0, -5.3],
];
// Runtime X/Z coordinates correspond to Blender X/-Y.
const rectangles = [
  [-5.4, 5.4, 32.3, 34],
  [-10.4, -1.6, -10.7, -6.15],
  [1.75, 9.05, -10.7, -6.15],
  [16.3, 21.7, -14.4, -10.6],
];
const circles = [
  [0, -1, 1.45],
  [10, 6, 2.2],
  [18, 12, 2.8],
];
export function isWalkable(x, z, unlocked = 6) {
  return (
    x >= WORLD_BOUNDS.minX &&
    x <= WORLD_BOUNDS.maxX &&
    z >= WORLD_BOUNDS.minZ &&
    z <= WORLD_BOUNDS.maxZ &&
    !rectangles.some(([l, r, t, b]) => x >= l && x <= r && z >= t && z <= b) &&
    !circles.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r) &&
    !MISSION_ZONES.some(([cx, cz], i) => i > unlocked && Math.hypot(x - cx, z - cz) < 1.9)
  );
}
export function moveWithCollision(position, delta, unlocked = 6) {
  const x = position.x + delta.x,
    z = position.z + delta.z;
  if (isWalkable(x, z, unlocked)) return { x, z };
  if (isWalkable(x, position.z, unlocked)) return { x, z: position.z };
  if (isWalkable(position.x, z, unlocked)) return { x: position.x, z };
  return { x: position.x, z: position.z };
}
export function inputDirection(horizontal, vertical, forward) {
  const length = Math.hypot(forward.x, forward.z) || 1,
    fx = forward.x / length,
    fz = forward.z / length;
  const x = -fz * horizontal - fx * vertical,
    z = fx * horizontal - fz * vertical;
  const magnitude = Math.hypot(x, z);
  return magnitude > 1 ? { x: x / magnitude, z: z / magnitude } : { x, z };
}
export function findPath(start, target, unlocked = 6) {
  const step = 0.8,
    key = (x, z) => x + ',' + z;
  const snap = (v) => Math.round(v / step),
    sx = snap(start.x),
    sz = snap(start.z),
    tx = snap(target.x),
    tz = snap(target.z);
  if (!isWalkable(target.x, target.z, unlocked)) return [];
  const queue = [[sx, sz]],
    visited = new Set([key(sx, sz)]),
    parents = new Map();
  let found = null;
  for (let head = 0; head < queue.length && head < 7000; head++) {
    const [x, z] = queue[head];
    if (x === tx && z === tz) {
      found = [x, z];
      break;
    }
    for (const [dx, dz] of [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      const nx = x + dx,
        nz = z + dz,
        k = key(nx, nz);
      if (visited.has(k) || !isWalkable(nx * step, nz * step, unlocked)) continue;
      if (
        dx &&
        dz &&
        (!isWalkable(x * step, nz * step, unlocked) || !isWalkable(nx * step, z * step, unlocked))
      )
        continue;
      visited.add(k);
      parents.set(k, [x, z]);
      queue.push([nx, nz]);
    }
  }
  if (!found) return [];
  const path = [];
  let current = found;
  while (current[0] !== sx || current[1] !== sz) {
    path.push({ x: current[0] * step, z: current[1] * step });
    current = parents.get(key(...current));
    if (!current) return [];
  }
  path.reverse();
  path.push({ x: target.x, z: target.z });
  return path;
}
