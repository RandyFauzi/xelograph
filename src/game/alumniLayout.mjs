export const COMMONS = { minX: -13, maxX: 13, minZ: 20, maxZ: 32 };
export function layoutAlumni(alumni) {
  const result = new Map(),
    groups = ['crew', 'plaza', 'supporter']
      .map((group) => ({ group, members: alumni.filter((a) => a.group === group) }))
      .filter((g) => g.members.length);
  const total = alumni.length;
  if (!total) return result;
  let start = COMMONS.minX;
  for (let gi = 0; gi < groups.length; gi++) {
    const { members } = groups[gi],
      remaining = groups.length - gi - 1;
    const desired = (26 * members.length) / total,
      width =
        gi === groups.length - 1
          ? COMMONS.maxX - start
          : Math.min(Math.max(desired, 3.5), COMMONS.maxX - start - remaining * 3.5);
    const columns = Math.max(1, Math.floor(width / 1.1)),
      rows = Math.ceil(members.length / columns),
      spacingX = width / columns,
      spacingZ = Math.min(1.15, 10.2 / Math.max(rows - 1, 1)),
      depth = (rows - 1) * spacingZ;
    members.forEach((a, i) => {
      const col = i % columns,
        row = Math.floor(i / columns),
        jitter = Math.sin(i * 12.9898 + gi) * 0.08;
      result.set(a.id, [
        start + (col + 0.5) * spacingX + jitter,
        0.28,
        26 - depth / 2 + row * spacingZ + jitter,
      ]);
    });
    start += width;
  }
  return result;
}
