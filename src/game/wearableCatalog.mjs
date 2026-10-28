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
    config.headwear === 'topi_beret_bear' ? '/models/topi_beret_bear.glb' : null,
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
