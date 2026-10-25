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
};

export const PENTOL_PORTIONS: Array<{
  id: string;
  label: string;
  badge: string;
  desc: string;
}>;

export const PENTOL_TOPPINGS: Array<{
  id: string;
  label: string;
  emoji: string;
}>;

export const PENTOL_SAUCES: Array<{
  id: string;
  label: string;
}>;

export const MASBRO_QUOTES: string[];

export function pentolProximity(
  position: { x: number; z: number },
  latched: boolean,
  active: boolean,
): { near: boolean; open: boolean; latched: boolean };
