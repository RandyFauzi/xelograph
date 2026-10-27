// Interactive Pentol Bakwan Pakle NPC landmark near the front school promenade.
export const GEROBAK_PENTOL = {
  x: 4.2,
  z: 12.6,
  y: 0.12,
  scale: 1.08,
  rotationY: -0.42,
  radius: 2.5,
  exitRadius: 3.6,
  walkTarget: { x: 2.8, z: 13.6 },
  model: '/models/gerobak_pentol_masbro.glb',
  preview: '/branding/gerobak-pentol-preview.png',
  title: 'Pentol Bakwan Pakle',
  npcName: 'Pakle Pentol Bakwan',
};

export const PAKLE_DIALOGUES = [
  '“Eh, sudah pada gede-gede sekarang ya! Pangling Pakle lihatnya. Dulu perasaan tiap bel istirahat bunyi langsung lari rebutan pentol sama bakwan di gerobak ini.”',
  '“Ayo mampir sini, kuah kaldunya baru mendidih nih! Masih inget gak dulu siapa yang suka minta tambah kuah sampai plastiknya penuh tapi belinya cuma dua ribu?”',
  '“Seneng rasanya lihat kalian pulang lagi ke sekolah. Jangan lupa sapa teman-teman lama di dalam ya, Pakle tetap mangkal di depan gerbang kayak dulu!”',
  '“Kalau lewat gerbang depan jangan sungkan nyapa Pakle ya. Dari zaman kalian masih pakai seragam sampai sekarang mau reuni, rasa pentol bakwan Pakle gak pernah berubah!”',
];

/** Hysteresis prevents the NPC dialog from reopening until the visitor steps away from the cart. */
export function pentolProximity(position, latched, active) {
  const distance = Math.hypot(position.x - GEROBAK_PENTOL.x, position.z - GEROBAK_PENTOL.z);
  const near = distance <= GEROBAK_PENTOL.radius;
  if (distance > GEROBAK_PENTOL.exitRadius) latched = false;
  const open = active && near && !latched;
  return { near, open, latched: latched || open };
}
