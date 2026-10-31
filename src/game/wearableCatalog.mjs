export const STORE_OUTFITS = [
  'row4_01_varsity_black',
  'row4_02_track_blue',
  'row4_03_track_stripes',
  'row4_04_halfzip_cream',
  'row4_05_halfzip_green',
  'row4_06_polo_brown',
  'row4_07_crewneck_charcoal',
  'row4_08_formal_tie',
];
export const isStoreOutfit = (outfit) => STORE_OUTFITS.includes(outfit);

export const STORE_HATS = [
  'topi_beret_bear',
  'hat_01_cap_blue',
  'hat_02_snapback_red',
  'hat_03_beanie_black',
  'hat_04_bucket_safari',
  'hat_05_snapback_black_red',
  'hat_06_fedora_brown',
  'hat_07_straw_luffy',
  'hat_08_visor_green',
  'hat_09_winter_pompom',
  'hat_10_sweatband_sports',
  'hat_11_crown_gold',
  'hat_12_bandana_pirate',
];
export const isStoreHat = (hat) => STORE_HATS.includes(hat);

export function baseAppearance(config) {
  return {
    ...config,
    outfit: isStoreOutfit(config.outfit) ? 'navy' : config.outfit,
    headwear: undefined,
    eyewear: undefined,
  };
}
export function wearableAssetUrls(config) {
  return [
    isStoreHat(config.headwear) ? `/models/${config.headwear}.glb` : null,
    ['pixel_sunglasses', 'anime_sunglasses'].includes(config.eyewear)
      ? `/models/${config.eyewear}.glb`
      : null,
    isStoreOutfit(config.outfit) ? `/models/${config.outfit}.glb` : null,
  ].filter((url) => url !== null);
}
export function appearanceKey(config) {
  return [
    config.character || 'male',
    config.hair,
    isStoreOutfit(config.outfit) ? config.outfit : '',
    config.headwear || '',
    config.eyewear || '',
  ].join(':');
}
