export const CREATOR_MONUMENT: {
  x: number;
  z: number;
  radius: number;
  exitRadius: number;
  asset: string;
  portfolio: string;
};
export function creatorProximity(
  position: { x: number; z: number },
  latched: boolean,
  active: boolean,
): { near: boolean; open: boolean; latched: boolean };
