import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS, type Alumnus } from '../types';
import { createStaticAvatar } from './staticAvatar.mjs';
import { layoutAlumni } from './alumniLayout.mjs';

export default function AlumniCrowd({
  alumni,
  playing,
  focusId,
  player,
}: {
  alumni: Alumnus[];
  playing: boolean;
  focusId: string | null;
  player: React.RefObject<THREE.Vector3>;
}) {
  const { scene } = useGLTF('/models/avatar.glb', false, true),
    placements = useMemo(() => layoutAlumni(alumni), [alumni]);
  const templates = useMemo(
    () =>
      ['male', 'female'].flatMap((character) =>
        ['short', 'bob', 'cap', 'long'].map((hair) => ({
          hair,
          character,
          model: createStaticAvatar(scene, {
            hair,
            character,
            outfitColor: '#ffffff',
            skinColor: '#ffffff',
          }),
        })),
      ),
    [scene],
  );
  useEffect(
    () => () => {
      for (const { model } of templates)
        model.traverse((o) => {
          if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose();
        });
    },
    [templates],
  );
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const labelTimer = useRef(0),
    lastLabelKey = useRef('');
  useFrame((_, dt) => {
    labelTimer.current += dt;
    if (labelTimer.current < 0.4) return;
    labelTimer.current = 0;
    const ids = alumni
      .filter((a) => {
        const p = placements.get(a.id)!;
        return (
          a.id === focusId || Math.hypot(p[0] - player.current.x, p[2] - player.current.z) < 10
        );
      })
      .slice(0, 14)
      .map((a) => a.id);
    const key = ids.join('|');
    if (key !== lastLabelKey.current) {
      lastLabelKey.current = key;
      setVisibleIds(ids);
    }
  });
  const labels = alumni.filter((a) => visibleIds.includes(a.id));
  return (
    <>
      {templates.map(({ hair, character, model }) => {
        const members = alumni.filter(
          (a) => a.avatar.hair === hair && (a.avatar.character || 'male') === character,
        );
        return (
          members.length > 0 && (
            <CrowdBatch
              key={character + hair}
              members={members}
              template={model}
              placements={placements}
            />
          )
        );
      })}
      {playing &&
        labels.map((a) => (
          <Html
            key={a.id}
            position={[placements.get(a.id)![0], 2.3, placements.get(a.id)![2]]}
            center
            zIndexRange={[8, 0]}
          >
            <span className={'alumni-tag ' + (focusId === a.id ? 'highlight' : '')}>
              {a.nickname}
            </span>
          </Html>
        ))}
    </>
  );
}
function CrowdBatch({
  members,
  template,
  placements,
}: {
  members: Alumnus[];
  template: THREE.Group;
  placements: Map<string, [number, number, number]>;
}) {
  return (
    <>
      {template.children.map((child) => {
        const mesh = child as THREE.Mesh;
        return (
          <CrowdInstances
            key={child.name}
            members={members}
            geometry={mesh.geometry}
            material={mesh.material as THREE.MeshStandardMaterial}
            placements={placements}
          />
        );
      })}
    </>
  );
}
function CrowdInstances({
  members,
  geometry,
  material,
  placements,
}: {
  members: Alumnus[];
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  placements: Map<string, [number, number, number]>;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null),
    dummy = useMemo(() => new THREE.Object3D(), []),
    color = useMemo(() => new THREE.Color(), []);
  useEffect(() => {
    if (!mesh.current) return;
    members.forEach((a, i) => {
      const p = placements.get(a.id)!;
      dummy.position.set(...p);
      dummy.rotation.y = Math.sin(i * 1.7) * 0.4;
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
      color.set(
        material.name === 'AvatarShirt'
          ? COLORS[a.avatar.outfit]
          : material.name === 'AvatarSkin'
            ? COLORS[a.avatar.skin]
            : '#ffffff',
      );
      mesh.current!.setColorAt(i, color);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [members, placements, material, color, dummy]);
  return <instancedMesh ref={mesh} args={[geometry, material, members.length]} receiveShadow />;
}
