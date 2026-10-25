export const AVATAR_MODELS = {
  female: [
    {
      id: 'long',
      label: 'Kasual',
      description: 'Rambut panjang · dress',
      preview: '/avatars/female-long.png',
    },
    {
      id: 'ponytail',
      label: 'Sporty',
      description: 'Kuncir · hoodie & celana',
      preview: '/avatars/female-ponytail.png',
    },
    {
      id: 'hijab',
      label: 'Hijab',
      description: 'Hijab · busana panjang',
      preview: '/avatars/female-hijab.png',
    },
  ],
  male: [
    {
      id: 'short',
      label: 'Kasual',
      description: 'Rambut pendek · kaus',
      preview: '/avatars/male-short.png',
    },
    {
      id: 'quiff',
      label: 'Jaket',
      description: 'Rambut quiff · jaket',
      preview: '/avatars/male-quiff.png',
    },
    { id: 'cap', label: 'Topi', description: 'Topi · hoodie', preview: '/avatars/male-cap.png' },
  ],
};
// Previous profiles with bob/long/short/cap retain their original selections.
export const AVATAR_HAIRS = ['short', 'bob', 'cap', 'long', 'ponytail', 'hijab', 'quiff'];
export function selectAvatarCharacter(avatar, character) {
  const models = AVATAR_MODELS[character];
  return {
    ...avatar,
    character,
    hair: models.some((model) => model.id === avatar.hair) ? avatar.hair : models[0].id,
  };
}
