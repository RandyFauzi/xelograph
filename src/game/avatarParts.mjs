/** The same selection rules drive animated players, previews, and instanced alumni. */
export function avatarPartVisible(name, { hair, character = 'male' }) {
  if (name === 'Torso' && character === 'female') return false;
  if (name.startsWith('Body_') && !name.startsWith('Body_' + character + '_')) return false;
  if (name.startsWith('Hair_') && !name.startsWith('Hair_' + hair)) return false;
  if (name.startsWith('Cap_brim') && hair !== 'cap') return false;
  return true;
}
