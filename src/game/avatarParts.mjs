/** The same selection rules drive animated players, previews, and instanced alumni. */
import { isStoreOutfit } from './wearableCatalog.mjs';
export function avatarPartVisible(name, { hair, character = 'male', outfit }) {
  if (
    isStoreOutfit(outfit) &&
    (name === 'Torso' ||
      name === 'Collar' ||
      name === 'Body_female_Torso' ||
      name.startsWith('Sleeve_') ||
      (name.startsWith('Look_') && !name.includes('Long_skirt')))
  )
    return false;
  const customBody =
    (character === 'female' && ['ponytail', 'hijab'].includes(hair)) ||
    (character === 'male' && ['quiff', 'cap'].includes(hair));
  if (name.startsWith('Look_')) return name.startsWith(`Look_${character}_${hair}_`);
  if (name === 'Torso' && (character === 'female' || customBody)) return false;
  if (name.startsWith('Body_') && customBody) return false;
  if (name === 'Collar' && (hair === 'hijab' || hair === 'cap' || hair === 'ponytail'))
    return false;
  if ((name.startsWith('Sleeve_') || name.startsWith('Forearm_')) && hair === 'hijab') return false;
  if (name.startsWith('Body_') && !name.startsWith('Body_' + character + '_')) return false;
  if (name.startsWith('Hair_') && !name.startsWith('Hair_' + hair)) return false;
  if (name.startsWith('Cap_brim') && hair !== 'cap') return false;
  return true;
}
