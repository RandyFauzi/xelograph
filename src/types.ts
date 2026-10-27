export type AvatarConfig = {
  character?: 'male' | 'female';
  outfit: 'sage' | 'clay' | 'navy' | 'cream' | string;
  hair: 'short' | 'bob' | 'cap' | 'long' | 'ponytail' | 'hijab' | 'quiff';
  skin: 'light' | 'warm' | 'deep';
  headwear?: string | null;
  eyewear?: string | null;
  border?: string | null;
};
export type StoreItem = {
  id: string;
  name: string;
  category: 'headwear' | 'eyewear' | 'outfit' | 'border';
  price_coins: number;
  model_url?: string | null;
  preview_url: string;
  description?: string | null;
};
export type Answers = Record<string, string | string[]>;
export type Profile = {
  id: string;
  fullName: string;
  nickname: string;
  avatar: AvatarConfig;
  avatarRevision: number;
  avatarUpdatedAt: string;
  consentPublic: boolean;
  answers: Answers;
  completedAt: string | null;
  progress: number[];
};
export type Alumnus = {
  id: string;
  nickname: string;
  avatar: AvatarConfig;
  group: 'plaza' | 'crew' | 'supporter';
  badges: string[];
};
export type OnlinePeer = {
  id: string;
  nickname: string;
  avatar: AvatarConfig;
  x: number;
  z: number;
  vx?: number;
  vz?: number;
  moving?: boolean;
  alumniId?: string | null;
};
export type ChatMessage = {
  id: string;
  senderId?: string | null;
  nickname: string;
  text: string;
  isSystem: boolean;
  createdAt: string;
  createdMs: number;
};
export const DEFAULT_AVATAR: AvatarConfig = { outfit: 'navy', hair: 'short', skin: 'warm' };
export const COLORS = {
  sage: '#679b61',
  clay: '#e39465',
  navy: '#347cc5',
  cream: '#ede3be',
  light: '#edc8a0',
  warm: '#bc845c',
  deep: '#79513b',
};
export const CHECKPOINTS = [
  {
    name: 'Pilih petualangan',
    place: 'Gerbang cerita',
    description: 'Dua rencana, satu tujuan: bertemu kembali.',
    position: [-6, 6],
    icon: 'flag',
  },
  {
    name: 'Kalender reuni',
    place: 'Taman waktu',
    description: 'Kita cari waktu untuk kembali berkumpul.',
    position: [-9, 1],
    icon: 'calendar',
  },
  {
    name: 'Recruitment camp',
    place: 'Rumah para penggerak',
    description: 'Reuni yang baik dimulai dari orang-orang baik.',
    position: [-8, -4],
    icon: 'users',
  },
  {
    name: 'Creative corner',
    place: 'Panggung ide',
    description: 'Beri warna pada pertemuan kita nanti.',
    position: [7, -4],
    icon: 'sparkles',
  },
  {
    name: 'Venue explorer',
    place: 'Sudut pilihan',
    description: 'Di mana cerita baru kita akan dimulai?',
    position: [10, 1],
    icon: 'map',
  },
  {
    name: 'Support station',
    place: 'Taman kebaikan',
    description: 'Setiap bentuk dukungan punya arti.',
    position: [7, 6],
    icon: 'heart',
  },
  {
    name: 'Message wall',
    place: 'Dinding kenangan',
    description: 'Titipkan satu pesan untuk teman-teman lama.',
    position: [0, -5.3],
    icon: 'message',
  },
];
export const LABELS: Record<string, string> = {
  fun: 'Fun Reunion',
  bukber: 'Bukber Reunion',
  both: 'Dua-duanya',
  unsure: 'Belum yakin',
  yes: 'Bersedia',
  maybe: 'Mungkin',
  no: 'Belum bisa',
  active: 'Panitia aktif',
  occasional: 'Bantu sesekali',
  participant: 'Peserta saja',
  unavailable: 'Belum bisa membantu',
  acara: 'Acara',
  kreatif: 'Kreatif',
  logistik: 'Logistik',
  humas: 'Humas',
  dokumentasi: 'Dokumentasi',
  games: 'Games',
  doorprize: 'Doorprize',
  musik: 'Musik & hiburan',
  sharing: 'Sharing',
  nostalgia: 'Nostalgia sekolah',
  olahraga: 'Olahraga ringan',
  sekolah: 'Sekolah',
  outdoor: 'Taman / lapangan',
  restoran: 'Restoran',
  hotel: 'Hotel',
  other: 'Usulan lain',
  depends: 'Tergantung nominal',
  details: 'Ingin tahu rinciannya',
  donor: 'Donatur',
  sponsor: 'Sponsor',
};
