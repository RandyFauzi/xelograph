export const WORLD_BOUNDS: { minX: number; maxX: number; minZ: number; maxZ: number };
export function headingForMovement(dx: number, dz: number): number;
export const MISSION_ZONES: number[][];
export function isWalkable(x: number, z: number, unlocked?: number): boolean;
export function moveWithCollision(
  position: { x: number; z: number },
  delta: { x: number; z: number },
  unlocked?: number,
): { x: number; z: number };
export function inputDirection(
  horizontal: number,
  vertical: number,
  forward: { x: number; z: number },
): { x: number; z: number };
export function findPath(
  start: { x: number; z: number },
  target: { x: number; z: number },
  unlocked?: number,
): { x: number; z: number }[];
