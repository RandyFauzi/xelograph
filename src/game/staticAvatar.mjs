import { Group, Mesh, Float32BufferAttribute } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { avatarPartVisible } from './avatarParts.mjs';
import { avatarIdleJoint } from './crowdMotion.mjs';
const templates = new WeakMap();

/** Share immutable geometry for the three hairstyles; stationary alumni use one draw per material. */
export function createStaticAvatar(
  source,
  { hair, character = 'male', outfit, outfitColor, skinColor },
) {
  const key = character + ':' + hair + ':' + (outfit || '');
  let styles = templates.get(source);
  if (!styles) {
    styles = new Map();
    templates.set(source, styles);
  }
  if (!styles.has(key)) {
    source.updateMatrixWorld(true);
    const batches = new Map();
    source.traverse((object) => {
      if (!object.isMesh || !avatarPartVisible(object.name, { hair, character, outfit })) return;
      const material = object.material;
      if (Array.isArray(material)) throw new Error('Avatar primitives must have one material.');
      const geometry = object.geometry.clone();
      // Meshopt quantization stores normalized integer attributes. Transform into float buffers
      // before baking node matrices so coordinates above one do not wrap or get clamped.
      for (const name of ['position', 'normal']) {
        const attribute = geometry.getAttribute(name);
        if (!attribute) continue;
        const values = new Float32Array(attribute.count * 3);
        for (let i = 0; i < attribute.count; i++) {
          values[i * 3] = attribute.getX(i);
          values[i * 3 + 1] = attribute.getY(i);
          values[i * 3 + 2] = attribute.getZ(i);
        }
        geometry.setAttribute(name, new Float32BufferAttribute(values, 3));
      }
      geometry.applyMatrix4(object.matrixWorld);
      const sourceUv = geometry.getAttribute('uv');
      const uv = new Float32Array(geometry.getAttribute('position').count * 2);
      if (sourceUv)
        for (let i = 0; i < sourceUv.count; i++) {
          uv[i * 2] = sourceUv.getX(i);
          uv[i * 2 + 1] = sourceUv.getY(i);
        }
      geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
      const joint = avatarIdleJoint(object);
      const joints = new Float32Array(geometry.getAttribute('position').count * 4);
      for (let i = 0; i < joints.length; i += 4) joints.set(joint, i);
      geometry.setAttribute('idleJoint', new Float32BufferAttribute(joints, 4));
      for (const key of Object.keys(geometry.attributes))
        if (!['position', 'normal', 'uv', 'idleJoint'].includes(key)) geometry.deleteAttribute(key);
      if (!batches.has(material.name)) batches.set(material.name, { material, geometries: [] });
      batches.get(material.name).geometries.push(geometry);
    });
    styles.set(
      key,
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
  for (const template of styles.get(key)) {
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
