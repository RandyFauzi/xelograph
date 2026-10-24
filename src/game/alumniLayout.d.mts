export const COMMONS: { minX: number; maxX: number; minZ: number; maxZ: number };
export function layoutAlumni(
  alumni: { id: string; group: string }[],
): Map<string, [number, number, number]>;
