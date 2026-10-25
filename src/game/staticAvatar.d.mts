import type { Object3D, Group } from 'three';
export function createStaticAvatar(
  source: Object3D,
  config: { hair: string; character?: string; outfitColor: string; skinColor: string },
): Group;
