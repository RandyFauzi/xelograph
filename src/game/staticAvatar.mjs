import { Group, Mesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const templates = new WeakMap();

/** Share immutable geometry for the three hairstyles; stationary alumni use one draw per material. */
export function createStaticAvatar(source, { hair, outfitColor, skinColor }) {
  let styles = templates.get(source);
  if (!styles) {
    styles = new Map();
    templates.set(source, styles);
  }
  if (!styles.has(hair)) {
    source.updateMatrixWorld(true);
    const batches = new Map();
    source.traverse((object) => {
      if (
        !object.isMesh ||
        (object.name.startsWith('Hair_') && !object.name.startsWith('Hair_' + hair)) ||
        (object.name.startsWith('Cap_brim') && hair !== 'cap')
      )
        return;
      const material = object.material;
      if (Array.isArray(material)) throw new Error('Avatar primitives must have one material.');
      const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
      for (const key of Object.keys(geometry.attributes))
        if (!['position', 'normal'].includes(key)) geometry.deleteAttribute(key);
      if (!batches.has(material.name)) batches.set(material.name, { material, geometries: [] });
      batches.get(material.name).geometries.push(geometry);
    });
    styles.set(
      hair,
      [...batches.values()].map(({ material, geometries }) => {
        const geometry = mergeGeometries(geometries);
        for (const part of geometries) part.dispose();
        if (!geometry) throw new Error('Cannot combine avatar geometry.');
        return { geometry, material };
      }),
    );
  }
  const group = new Group();
  group.name = 'StaticAlumniAvatar';
  for (const template of styles.get(hair)) {
    const material = template.material.clone();
    if (material.name === 'AvatarShirt') material.color.set(outfitColor);
    if (material.name === 'AvatarSkin') material.color.set(skinColor);
    const mesh = new Mesh(template.geometry, material);
    mesh.name = material.name;
    mesh.castShadow = true;
    group.add(mesh);
  }
  return group;
}
