export const KOLAM_BECABUR: {
  x: number;
  z: number;
  y: number;
  scale: number;
  radius: number;
  exitRadius: number;
  walkTarget: { x: number; z: number };
  model: string;
  preview: string;
  video: string;
  driveUrl: string;
  title: string;
};
export function kolamProximity(
  position: { x: number; z: number },
  latched: boolean,
  active: boolean,
): { near: boolean; open: boolean; latched: boolean };
