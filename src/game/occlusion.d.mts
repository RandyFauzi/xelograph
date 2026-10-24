import type { Mesh, Vector3, Object3D } from 'three';
export function collectOccluderMeshes(root: Object3D): Mesh[];
export function createOcclusionController(meshes: Mesh[]): {
  detect: (cameraPosition: Vector3, playerPosition: Vector3, enabled?: boolean) => void;
  update: (dt: number) => void;
  restore: () => void;
};
