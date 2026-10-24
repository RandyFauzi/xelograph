export const CHOICES = {
  concept: ['fun', 'bukber', 'both', 'unsure'],
  attendance: ['yes', 'maybe', 'no'],
  committee: ['active', 'occasional', 'participant', 'unavailable'],
  department: ['acara', 'kreatif', 'logistik', 'humas', 'dokumentasi'],
  activities: ['games', 'doorprize', 'musik', 'sharing', 'nostalgia', 'olahraga'],
  production: ['yes', 'maybe', 'no'],
  venue: ['sekolah', 'outdoor', 'restoran', 'hotel', 'other'],
  contribution: ['yes', 'depends', 'details', 'no'],
  sponsor: ['donor', 'sponsor', 'no'],
};
export const CHECKPOINT_KEYS = [
  ['concept'],
  ['attendance'],
  ['committee', 'department'],
  ['activities', 'production'],
  ['venue', 'venueNote'],
  ['contribution', 'sponsor'],
  ['message'],
];
export function normalizePhone(value) {
  let p = String(value || '').replace(/[\s()+.-]/g, '');
  if (p.startsWith('0')) p = '62' + p.slice(1);
  if (!/^62[1-9]\d{7,12}$/.test(p))
    throw new Error('Masukkan nomor WhatsApp Indonesia yang valid.');
  return p;
}
export function validateAvatar(a) {
  if (
    !a ||
    !['sage', 'clay', 'navy', 'cream'].includes(a.outfit) ||
    !['short', 'bob', 'cap'].includes(a.hair) ||
    !['light', 'warm', 'deep'].includes(a.skin)
  )
    throw new Error('Pilihan avatar tidak valid.');
  return { outfit: a.outfit, hair: a.hair, skin: a.skin };
}
export function validateAnswer(index, value) {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index > 6 ||
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  )
    throw new Error('Checkpoint tidak valid.');
  const out = {};
  for (const key of CHECKPOINT_KEYS[index]) {
    if (['message', 'venueNote'].includes(key)) {
      out[key] = String(value[key] || '').trim();
      if (out[key].length > 1000) throw new Error('Pesan maksimal 1.000 karakter.');
    } else if (['department', 'activities'].includes(key)) {
      if (
        !Array.isArray(value[key]) ||
        value[key].length > CHOICES[key].length ||
        value[key].some((v) => !CHOICES[key].includes(v))
      )
        throw new Error('Pilihan tidak valid.');
      out[key] = [...new Set(value[key])];
    } else {
      if (!CHOICES[key].includes(value[key]))
        throw new Error('Lengkapi pilihan sebelum melanjutkan.');
      out[key] = value[key];
    }
  }
  if (index === 2 && ['active', 'occasional'].includes(out.committee) && !out.department.length)
    throw new Error('Pilih minimal satu bidang yang diminati.');
  if (index === 2 && ['participant', 'unavailable'].includes(out.committee)) out.department = [];
  if (index === 3 && !out.activities.length) throw new Error('Pilih minimal satu kegiatan.');
  if (index === 4 && out.venue === 'other' && !out.venueNote)
    throw new Error('Tuliskan usulan tempatmu.');
  return out;
}
export function groupFor(answers) {
  return answers.attendance === 'no'
    ? 'supporter'
    : ['active', 'occasional'].includes(answers.committee)
      ? 'crew'
      : 'plaza';
}
export function badgesFor(a) {
  return [
    ...(['active', 'occasional'].includes(a.committee) ? ['Crew'] : []),
    ...(a.production === 'yes' ? ['Production'] : []),
    ...(['donor', 'sponsor'].includes(a.sponsor) ? ['Supporter'] : []),
  ];
}
