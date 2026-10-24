import { Raycaster, Vector3, MathUtils } from 'three';

// glTF nodes with multiple materials load as a Group containing several meshes.
export function collectOccluderMeshes(root) {
  const meshes = [];
  root.traverse((object) => {
    if (!object.isMesh) return;
    let node = object;
    while (node) {
      if (node.userData.camera_occluder === true) {
        object.userData.cameraOcclusionGroup = node.uuid;
        meshes.push(object);
        break;
      }
      node = node.parent;
    }
  });
  return meshes;
}

/** Each entry must own its materials: fading one tree must not fade its neighbours. */
export function createOcclusionController(meshes) {
  const ray = new Raycaster(),
    direction = new Vector3(),
    target = new Vector3();
  const probes = [
    [0, 1.6, 0],
    [0, 0.95, 0],
    [-0.3, 1.15, 0],
    [0.3, 1.15, 0],
    [0, 0.4, 0],
  ];
  const entries = meshes.map((mesh) => ({
    mesh,
    fade: 1,
    blocked: false,
    materials: (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((material) => ({
      material,
      opacity: material.opacity,
      transparent: material.transparent,
      depthWrite: material.depthWrite,
    })),
    renderOrder: mesh.renderOrder,
  }));
  function detect(cameraPosition, playerPosition, enabled = true) {
    entries.forEach((e) => {
      e.blocked = false;
    });
    if (!enabled) return;
    const blocked = new Set();
    for (const [x, y, z] of probes) {
      target.copy(playerPosition).add(new Vector3(x, y, z));
      direction.copy(target).sub(cameraPosition);
      const distance = direction.length();
      if (distance < 0.3) continue;
      ray.set(cameraPosition, direction.normalize());
      ray.near = 0.05;
      ray.far = distance - 0.2;
      for (const hit of ray.intersectObjects(meshes, false))
        blocked.add(hit.object.userData.cameraOcclusionGroup || hit.object.uuid);
    }
    entries.forEach((e) => {
      e.blocked = blocked.has(e.mesh.userData.cameraOcclusionGroup || e.mesh.uuid);
    });
  }
  function update(dt) {
    const blend = 1 - Math.exp(-12 * Math.min(dt, 0.1));
    for (const entry of entries) {
      entry.fade = MathUtils.lerp(entry.fade, entry.blocked ? 0.16 : 1, blend);
      if (Math.abs(entry.fade - (entry.blocked ? 0.16 : 1)) < 0.002)
        entry.fade = entry.blocked ? 0.16 : 1;
      const faded = entry.fade < 1;
      entry.mesh.renderOrder = faded ? 2 : entry.renderOrder;
      for (const original of entry.materials) {
        const m = original.material,
          transparent = faded || original.transparent;
        if (m.transparent !== transparent) {
          m.transparent = transparent;
          m.needsUpdate = true;
        }
        m.opacity = original.opacity * entry.fade;
        m.depthWrite = faded ? false : original.depthWrite;
      }
    }
  }
  function restore() {
    for (const entry of entries) {
      entry.mesh.renderOrder = entry.renderOrder;
      for (const o of entry.materials) {
        Object.assign(o.material, {
          opacity: o.opacity,
          transparent: o.transparent,
          depthWrite: o.depthWrite,
        });
        o.material.needsUpdate = true;
      }
    }
  }
  return { detect, update, restore };
}
