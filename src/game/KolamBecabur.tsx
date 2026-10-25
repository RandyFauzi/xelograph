import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { Play } from 'lucide-react';
import { KOLAM_BECABUR, kolamProximity } from './kolamBecabur.mjs';

export default function KolamBecabur({
  player,
  active,
  playing,
  onNear,
  onOpen,
}: {
  player: React.RefObject<THREE.Vector3>;
  active: boolean;
  playing: boolean;
  onNear: (near: boolean) => void;
  onOpen: () => void;
}) {
  const { scene, animations } = useGLTF(KOLAM_BECABUR.model, false, true);
  const model = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        object.material = Array.isArray(object.material)
          ? object.material.map((m) => m.clone())
          : object.material.clone();
      }
    });
    return copy;
  }, [scene]);

  const mixer = useMemo(() => {
    if (!animations.length) return null;
    const instance = new THREE.AnimationMixer(model);
    for (const clip of animations) {
      const action = instance.clipAction(clip);
      action.play();
    }
    return instance;
  }, [model, animations]);

  useEffect(
    () => () => {
      mixer?.stopAllAction();
      model.traverse((object) => {
        if (object instanceof THREE.Mesh)
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            material.dispose();
      });
      document.body.style.cursor = '';
    },
    [model, mixer],
  );

  const ripples = useMemo(() => {
    const inner = model.getObjectByName('Boat_Ripple_Inner') as THREE.Mesh | undefined;
    const outer = model.getObjectByName('Boat_Ripple_Outer') as THREE.Mesh | undefined;
    return { inner, outer };
  }, [model]);

  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const latched = useRef(false),
    near = useRef(false),
    timer = useRef(0);

  useFrame((state, dt) => {
    const distance = Math.hypot(
      player.current.x - KOLAM_BECABUR.x,
      player.current.z - KOLAM_BECABUR.z,
    );
    const animate = !reducedMotion && distance < 28;
    if (animate && mixer) {
      mixer.update(dt);
    }
    if (animate && (ripples.inner || ripples.outer)) {
      const t = state.clock.elapsedTime;
      if (ripples.inner) {
        const pulse = 1 + Math.sin(t * 2.2) * 0.06;
        ripples.inner.scale.set(pulse, 0.4, pulse * 0.75);
      }
      if (ripples.outer) {
        const pulse = 1 + Math.cos(t * 2.2) * 0.05;
        ripples.outer.scale.set(pulse, 0.4, pulse * 0.75);
      }
    }

    timer.current += dt;
    if (timer.current < 0.1) return;
    timer.current = 0;
    const prox = kolamProximity(player.current, latched.current, active);
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
      position={[KOLAM_BECABUR.x, KOLAM_BECABUR.y, KOLAM_BECABUR.z]}
      scale={KOLAM_BECABUR.scale}
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
      {playing && (
        <Html position={[0, 1.25, -1.15]} center zIndexRange={[9, 0]}>
          <button
            type="button"
            disabled={!active}
            className="map-pin kolam-pin"
            onClick={(event) => {
              event.stopPropagation();
              handleTrigger();
            }}
            aria-label="Buka video kenangan Kolam Becabur"
          >
            <span>
              <Play size={11} fill="currentColor" />
            </span>
            <b>Kolam Becabur</b>
          </button>
        </Html>
      )}
    </group>
  );
}
