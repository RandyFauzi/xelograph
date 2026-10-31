import { Box3, Group, Vector3 } from 'three';
import { avatarPartVisible } from './avatarParts.mjs';
import { isStoreOutfit } from './wearableCatalog.mjs';

const boundsOf = (nodes) =>
  nodes.reduce((box, node) => box.union(new Box3().setFromObject(node)), new Box3());
function cloneMaterials(root, colors) {
  root.traverse((node) => {
    if (!node.isMesh) return;
    const clone = (source) => {
      const material = source.clone();
      if (colors && material.name === 'AvatarShirt') material.color.set(colors.outfitColor);
      if (colors && material.name === 'AvatarSkin') material.color.set(colors.skinColor);
      return material;
    };
    node.material = Array.isArray(node.material) ? node.material.map(clone) : clone(node.material);
    node.castShadow = true;
    node.receiveShadow = true;
  });
}

/** Fit authored clothing to avatar measurements, rather than burying it inside the stock shirt. */
export function fittedShirt(source) {
  const shirt = source.clone(true);
  shirt.updateMatrixWorld(true);
  const torsos = [];
  shirt.traverse((node) => {
    if (node.isMesh && /^Torso_/.test(node.name)) torsos.push(node);
  });
  if (!torsos.length) throw new Error('Clothing model has no torso anchor.');
  const box = boundsOf(torsos),
    size = box.getSize(new Vector3()),
    center = box.getCenter(new Vector3());
  const scale = new Vector3(0.5 / size.x, 0.51 / size.y, 0.31 / size.z);
  shirt.scale.copy(scale);
  shirt.position.copy(new Vector3(0, 0.87, 0).sub(center.multiply(scale)));
  shirt.updateMatrixWorld(true);
  const arms = { L: new Group(), R: new Group() };
  arms.L.name = 'WearableSleeve_L';
  arms.R.name = 'WearableSleeve_R';
  const sleeves = [];
  shirt.traverse((node) => {
    if (node.isMesh && /^(Sleeve|Cuff|Wrist)_[LR]_/.test(node.name)) sleeves.push(node);
  });
  for (const mesh of sleeves) {
    // Some source assets label L/R from the viewer's perspective. Bind by actual x position.
    const side = new Box3().setFromObject(mesh).getCenter(new Vector3()).x < 0 ? 'L' : 'R';
    arms[side].attach(mesh);
  }
  for (const [side, arm] of Object.entries(arms)) {
    arm.updateMatrixWorld(true);
    if (!arm.children.length) continue;
    const bounds = new Box3().setFromObject(arm),
      dimensions = bounds.getSize(new Vector3());
    const armScale = new Vector3(0.19 / dimensions.x, 0.42 / dimensions.y, 0.26 / dimensions.z);
    arm.scale.copy(armScale);
    const x = side === 'L' ? -0.34 : 0.34;
    arm.position.copy(
      new Vector3(x, 0.85, 0).sub(bounds.getCenter(new Vector3()).multiply(armScale)),
    );
  }
  const result = new Group();
  result.name = 'FittedStoreOutfit';
  result.add(shirt, arms.L, arms.R);
  result.updateMatrixWorld(true);
  return result;
}

export function getHeadwearTransform(id) {
  if (id === 'hat_10_sweatband_sports') {
    return { position: [0, 1.56, -0.02], scale: 0.92 };
  }
  if (id === 'hat_08_visor_green') {
    return { position: [0, 1.58, -0.02], scale: 0.92 };
  }
  if (
    id === 'hat_03_beanie_black' ||
    id === 'hat_09_winter_pompom' ||
    id === 'hat_12_bandana_pirate'
  ) {
    return { position: [0, 1.66, -0.03], scale: 0.92 };
  }
  if (id === 'hat_11_crown_gold') {
    return { position: [0, 1.69, -0.03], scale: 0.9 };
  }
  if (
    id === 'hat_01_cap_blue' ||
    id === 'hat_02_snapback_red' ||
    id === 'hat_05_snapback_black_red'
  ) {
    return { position: [0, 1.67, -0.03], scale: 0.92 };
  }
  return { position: [0, 1.68, -0.03], scale: 0.92 };
}

/** One assembly path for the fitting room, local player, online peers and baked NPC batches.
 * @returns {import('three').Group}
 */
export function createAvatarAppearance(
  source,
  config,
  assets,
  colors = { outfitColor: '#fff', skinColor: '#fff' },
) {
  const model = source.clone(true);
  const garment = isStoreOutfit(config.outfit) && assets.get(`/models/${config.outfit}.glb`);
  const visibility = { ...config, outfit: garment ? config.outfit : undefined };
  model.traverse((node) => {
    if (node.isMesh) node.visible = avatarPartVisible(node.name, visibility);
  });
  cloneMaterials(model, colors);
  model.updateMatrixWorld(true);
  if (garment) {
    const fitted = fittedShirt(garment);
    cloneMaterials(fitted);
    model.add(fitted);
    model.updateMatrixWorld(true);
    for (const side of ['L', 'R']) {
      const sleeve = fitted.getObjectByName('WearableSleeve_' + side);
      const pivot = model.getObjectByName('Arm_' + side);
      if (sleeve && pivot) pivot.attach(sleeve);
    }
    fitted.traverse((node) => {
      if (node.isMesh) node.name = 'Wearable_' + node.name;
    });
    for (const side of ['L', 'R'])
      model.getObjectByName('WearableSleeve_' + side)?.traverse((node) => {
        if (node.isMesh && !node.name.startsWith('Wearable_')) node.name = 'Wearable_' + node.name;
      });
  }
  const headwearTransform = getHeadwearTransform(config.headwear);
  for (const [id, position, scale] of [
    [config.headwear, headwearTransform.position, headwearTransform.scale],
    [config.eyewear, [0, 1.42, 0.27], 0.9],
  ]) {
    const sourceAsset = assets.get(`/models/${id}.glb`);
    if (!sourceAsset) continue;
    const item = sourceAsset.clone(true);
    cloneMaterials(item);
    item.position.set(...position);
    item.scale.setScalar(scale);
    item.traverse((node) => {
      if (node.isMesh) {
        node.name = 'Wearable_' + node.name;
        node.userData.idleJoint = [0, 1.12, 0, 1];
      }
    });
    model.add(item);
  }
  model.updateMatrixWorld(true);
  return model;
}
