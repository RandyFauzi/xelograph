// Interactive Gerobak Pentol Mas Bro street-food landmark near the front school promenade.
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
  title: 'Pentol Mas Bro',
};

export const PENTOL_PORTIONS = [
  {
    id: 'plastik',
    label: 'Plastik Kecil · Rp 5.000',
    badge: 'Jajanan Istirahat Pertama',
    desc: 'Pas buat ganjal perut sambil jalan balik ke kelas sebelum bel bunyi.',
  },
  {
    id: 'mangkok',
    label: 'Mangkok Ayam Jago · Rp 10.000',
    badge: 'Porsi Nongkrong Pulang Sekolah',
    desc: 'Komplit pakai kuah kaldu hangat, makan bareng di pinggir gerbang.',
  },
  {
    id: 'sultan',
    label: 'Bungkus Sultan · Rp 15.000',
    badge: 'Traktir Satu Geng',
    desc: 'Plastik penuh sampai susah diikat karet, bonus pentol urat dari Mas Bro!',
  },
];

export const PENTOL_TOPPINGS = [
  { id: 'urat', label: 'Pentol Urat Kasar', emoji: '🍢' },
  { id: 'puyuh', label: 'Pentol Telur Puyuh', emoji: '🥚' },
  { id: 'tahu', label: 'Tahu Bakso Lembut', emoji: '🧈' },
  { id: 'siomay', label: 'Siomay Kukus', emoji: '🥟' },
  { id: 'mercon', label: 'Pentol Mercon', emoji: '🌶️' },
];

export const PENTOL_SAUCES = [
  { id: 'kacang', label: 'Bumbu Kacang Kental' },
  { id: 'sambal', label: 'Sambal Pedas Ngawur' },
  { id: 'kecap', label: 'Kecap Manis' },
  { id: 'kuah', label: 'Guyur Kuah Kaldu Panas' },
];

export const MASBRO_QUOTES = [
  '“Siap bosku! Bonus satu pentol urat khusus buat alumni yang kangen masa sekolah!”',
  '“Awas kuahnya masih mendidih! Dulu siapa nih yang suka ngutang lima ribu belum dibayar?”',
  '“Racikan legendaris siap disajikan! Jangan lupa tiup dulu sebelum dilahap ya!”',
  '“Mantap! Sambalnya Mas Bro kasih ekstra biar melek kayak waktu jam pelajaran terakhir!”',
];

/** Hysteresis prevents the modal from reopening until the visitor steps away from the cart. */
export function pentolProximity(position, latched, active) {
  const distance = Math.hypot(position.x - GEROBAK_PENTOL.x, position.z - GEROBAK_PENTOL.z);
  const near = distance <= GEROBAK_PENTOL.radius;
  if (distance > GEROBAK_PENTOL.exitRadius) latched = false;
  const open = active && near && !latched;
  return { near, open, latched: latched || open };
}
