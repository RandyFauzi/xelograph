export const GEROBAK_PENTOL: {
  x: number;
  z: number;
  y: number;
  scale: number;
  rotationY: number;
  radius: number;
  exitRadius: number;
  walkTarget: { x: number; z: number };
  model: string;
  preview: string;
  title: string;
  npcName: string;
};

export const PAKLE_DIALOGUES: string[];

export function pentolProximity(
  position: { x: number; z: number },
  latched: boolean,
  active: boolean,
): { near: boolean; open: boolean; latched: boolean };
