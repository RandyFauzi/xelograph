import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { Flame } from 'lucide-react';
import { GEROBAK_PENTOL, pentolProximity } from './gerobakPentol.mjs';

const STEAM_COUNT = 8;

export default function GerobakPentol({
  player,
  active,
  playing,
  onNear,
  onOpen,
  onWalk,
}: {
  player: React.RefObject<THREE.Vector3>;
  active: boolean;
  playing: boolean;
  onNear: (near: boolean) => void;
  onOpen: () => void;
  onWalk?: (point: { x: number; z: number }) => void;
}) {
  const { scene } = useGLTF(GEROBAK_PENTOL.model, false, true);

  const model = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((object) => {
      if (
        object.name === 'Shadow_Catcher' ||
        object.name.includes('Light') ||
        object.name.includes('Camera') ||
        object instanceof THREE.Light ||
        object instanceof THREE.Camera
      ) {
        object.visible = false;
        return;
      }
      if (object instanceof THREE.Mesh) {
        const cloneMat = (m: THREE.Material) => {
          const cloned = m.clone();
          if (object.name === 'Char_Face_Decal' || cloned.name === 'M_Face') {
            cloned.transparent = true;
            cloned.depthWrite = false;
            cloned.alphaTest = 0.05;
          }
          return cloned;
        };
        object.material = Array.isArray(object.material)
          ? object.material.map(cloneMat)
          : cloneMat(object.material);
        object.castShadow = object.name !== 'Char_Face_Decal';
        object.receiveShadow = true;
      }
    });
    return copy;
  }, [scene]);

  useEffect(
    () => () => {
      model.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material]) {
            material.dispose();
          }
        }
      });
      document.body.style.cursor = '';
    },
    [model],
  );

  const animatedParts = useMemo(() => {
    const pentols: Array<{ obj: THREE.Object3D; baseY: number; phase: number }> = [];
    for (let i = 0; i < 8; i++) {
      const p = model.getObjectByName(`Pentol_${i}`);
      if (p) pentols.push({ obj: p, baseY: p.position.y, phase: i * 0.85 });
    }
    const head = model.getObjectByName('Char_Head');
    const armR = model.getObjectByName('Arm_R_Upper');
    const spoon = model.getObjectByName('Spoon_Handle');
    const bagRed = model.getObjectByName('Sauce_Bag_Red');
    const bagBrown = model.getObjectByName('Sauce_Bag_Brown');
    const dandang = model.getObjectByName('Dandang_Body');
    return {
      pentols,
      head: head ? { obj: head, baseY: head.position.y, baseRotZ: head.rotation.z } : null,
      armR: armR ? { obj: armR, baseRotX: armR.rotation.x } : null,
      spoon: spoon ? { obj: spoon, baseY: spoon.position.y } : null,
      bagRed: bagRed ? { obj: bagRed, baseRotZ: bagRed.rotation.z } : null,
      bagBrown: bagBrown ? { obj: bagBrown, baseRotZ: bagBrown.rotation.z } : null,
      dandangPos: dandang ? dandang.position.clone() : new THREE.Vector3(-0.12, 1.04, -0.22),
    };
  }, [model]);

  const steamRef = useRef<THREE.Points>(null);
  const steamPositions = useMemo(() => new Float32Array(STEAM_COUNT * 3), []);

  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const latched = useRef(false),
    near = useRef(false),
    timer = useRef(0);

  useFrame((state, dt) => {
    const distance = Math.hypot(
      player.current.x - GEROBAK_PENTOL.x,
      player.current.z - GEROBAK_PENTOL.z,
    );
    const animate = !reducedMotion && distance < 26;
    const t = state.clock.elapsedTime;

    if (animate) {
      for (const item of animatedParts.pentols) {
        item.obj.position.y = item.baseY + Math.sin(t * 2.8 + item.phase) * 0.008;
      }
      if (animatedParts.head) {
        animatedParts.head.obj.position.y =
          animatedParts.head.baseY + Math.sin(t * 2.1) * 0.009;
        animatedParts.head.obj.rotation.z =
          animatedParts.head.baseRotZ + Math.sin(t * 1.4) * 0.04;
      }
      if (animatedParts.armR) {
        animatedParts.armR.obj.rotation.x =
          animatedParts.armR.baseRotX + Math.sin(t * 2.4) * 0.05;
      }
      if (animatedParts.spoon) {
        animatedParts.spoon.obj.position.y =
          animatedParts.spoon.baseY + Math.sin(t * 2.4) * 0.012;
      }
      if (animatedParts.bagRed) {
        animatedParts.bagRed.obj.rotation.z =
          animatedParts.bagRed.baseRotZ + Math.sin(t * 1.8) * 0.045;
      }
      if (animatedParts.bagBrown) {
        animatedParts.bagBrown.obj.rotation.z =
          animatedParts.bagBrown.baseRotZ + Math.cos(t * 1.8) * 0.045;
      }
    }

    if (steamRef.current) {
      steamRef.current.visible = animate;
      if (animate) {
        const base = animatedParts.dandangPos;
        for (let i = 0; i < STEAM_COUNT; i++) {
          const cycle = (t * 0.38 + i / STEAM_COUNT) % 1;
          const angle = i * 1.7 + t * 0.9;
          const spread = 0.04 + cycle * 0.09;
          steamPositions[i * 3] = base.x + Math.cos(angle) * spread;
          steamPositions[i * 3 + 1] = base.y + 0.14 + cycle * 0.42;
          steamPositions[i * 3 + 2] = base.z + Math.sin(angle) * spread;
        }
        steamRef.current.geometry.attributes.position.needsUpdate = true;
      }
    }

    timer.current += dt;
    if (timer.current < 0.1) return;
    timer.current = 0;
    const prox = pentolProximity(player.current, latched.current, active);
    latched.current = prox.latched;
    if (near.current !== prox.near) {
      near.current = prox.near;
      onNear(prox.near);
    }
    if (prox.open) onOpen();
  });

  const handleTrigger = () => {
    if (!active) return;
    latched.current = true;
    onOpen();
  };

  return (
    <group
      position={[GEROBAK_PENTOL.x, GEROBAK_PENTOL.y, GEROBAK_PENTOL.z]}
      rotation={[0, GEROBAK_PENTOL.rotationY, 0]}
      scale={GEROBAK_PENTOL.scale}
      onClick={(event) => {
        if (!active) return;
        event.stopPropagation();
        handleTrigger();
      }}
      onPointerOver={(event) => {
        if (!active) return;
        event.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = '';
      }}
    >
      <primitive object={model} />
      <points ref={steamRef} raycast={() => {}}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[steamPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#fff9eb"
          size={0.055}
          transparent
          opacity={0.42}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
      {playing && (
        <Html position={[0, 2.58, 0]} center zIndexRange={[9, 0]}>
          <button
            type="button"
            disabled={!active}
            className="map-pin pentol-pin"
            onClick={(event) => {
              event.stopPropagation();
              handleTrigger();
            }}
            aria-label="Jajan di Gerobak Pentol Mas Bro"
          >
            <span>
              <Flame size={11} fill="currentColor" />
            </span>
            <b>Pentol Mas Bro</b>
          </button>
        </Html>
      )}
    </group>
  );
}
