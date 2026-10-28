import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  Component,
  type ReactNode,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  ContactShadows,
  Html,
  OrbitControls,
  useGLTF,
  PerformanceMonitor,
  useProgress,
} from '@react-three/drei';
import * as THREE from 'three';
import { findPath, MISSION_ZONES } from './game/navigation.mjs';
import { createOcclusionController, collectOccluderMeshes } from './game/occlusion.mjs';
import { usePlayerMotion, CameraFollow, type PathPoint } from './game/PlayerController';
import Joystick from './game/Joystick';
import AlumniCrowd from './game/AlumniCrowd';
import CreatorMonument from './game/CreatorMonument';
import KolamBecabur from './game/KolamBecabur';
import GerobakPentol from './game/GerobakPentol';
import ShopBuilding from './game/ShopBuilding';
import OnlinePeers from './game/OnlinePeers';
import { createAvatarAppearance } from './game/avatarAppearance.mjs';
import { wearableAssetUrls } from './game/wearableCatalog.mjs';
import { layoutAlumni } from './game/alumniLayout.mjs';
import type { TravelRequest } from './GameScreen';
import { Lock, Navigation, RotateCcw, Footprints, ArrowUp } from 'lucide-react';
import {
  CHECKPOINTS,
  COLORS,
  DEFAULT_AVATAR,
  type AvatarConfig,
  type Alumnus,
  type OnlinePeer,
} from './types';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function RouteTrail({ path }: { path: React.RefObject<PathPoint[]> }) {
  const mesh = useRef<THREE.InstancedMesh>(null),
    dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    if (!mesh.current) return;
    const points = path.current.slice(0, 96);
    mesh.current.count = points.length;
    points.forEach((p, i) => {
      dummy.position.set(p.x, 0.4, p.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, 96]}
      frustumCulled={false}
      renderOrder={3}
    >
      <circleGeometry args={[0.07, 8]} />
      <meshBasicMaterial color="#2877cd" transparent opacity={0.75} depthWrite={false} />
    </instancedMesh>
  );
}
function Character({
  config = DEFAULT_AVATAR,
  moving,
  ...props
}: {
  config?: AvatarConfig;
  moving?: React.RefObject<boolean>;
  [key: string]: any;
}) {
  const { scene } = useGLTF('/models/avatar.glb');
  const urls = useMemo(
    () => wearableAssetUrls(config),
    [config.headwear, config.eyewear, config.outfit],
  );
  const assets = useGLTF(urls, false, true);
  const model = useMemo(
    () =>
      createAvatarAppearance(scene, config, new Map(urls.map((url, i) => [url, assets[i].scene])), {
        outfitColor: (COLORS as Record<string, string>)[config.outfit] || COLORS.navy,
        skinColor: COLORS[config.skin],
      }),
    [
      scene,
      assets,
      urls,
      config.outfit,
      config.skin,
      config.hair,
      config.character,
      config.headwear,
      config.eyewear,
    ],
  );
  useEffect(
    () => () => {
      model.traverse((o) => {
        if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose();
      });
    },
    [model],
  );
  const limbs = useMemo(
    () =>
      ['Arm_L', 'Arm_R', 'Leg_L', 'Leg_R'].map((name) => {
        const object = model.getObjectByName(name);
        return object ? { object, rest: object.quaternion.clone(), angle: 0 } : null;
      }),
    [model],
  );
  const swing = useMemo(() => new THREE.Quaternion(), []);
  useFrame(({ clock }, dt) => {
    if (!moving || reduceMotion) return;
    const t = clock.elapsedTime * 10;
    limbs.forEach((limb, i) => {
      if (!limb) return;
      const target = moving.current ? Math.sin(t + (i === 0 || i === 3 ? Math.PI : 0)) * 0.42 : 0;
      limb.angle = THREE.MathUtils.lerp(limb.angle, target, Math.min(dt * 18, 1));
      swing.setFromAxisAngle(new THREE.Vector3(1, 0, 0), limb.angle);
      limb.object.quaternion.copy(limb.rest).multiply(swing);
    });
  });
  return (
    <group {...props}>
      <primitive object={model} />
    </group>
  );
}
class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export function AvatarPreview({
  config,
  interactive = false,
}: {
  config: AvatarConfig;
  interactive?: boolean;
}) {
  return (
    <SceneBoundary fallback={<div className="avatar-fallback">Avatar {config.outfit}</div>}>
      <Canvas camera={{ position: [2, 1.6, 3.2], fov: 32 }} dpr={[1, 1.5]}>
        <ambientLight intensity={2} />
        <directionalLight position={[3, 4, 5]} intensity={3} />
        <Suspense fallback={null}>
          <group position={[0, -0.7, 0]}>
            <Character config={config} />
          </group>
          <ContactShadows position={[0, -0.72, 0]} opacity={0.2} scale={5} blur={3} />
          {interactive && (
            <OrbitControls
              enablePan={false}
              enableZoom={false}
              target={[0, 0.15, 0]}
              minPolarAngle={0.8}
              maxPolarAngle={1.8}
            />
          )}
        </Suspense>
      </Canvas>
    </SceneBoundary>
  );
}
function MapModel({
  position,
  playing,
}: {
  position: React.RefObject<THREE.Vector3>;
  playing: boolean;
}) {
  const { scene } = useGLTF('/models/world.glb');
  const model = useMemo(() => {
    const s = scene.clone();
    s.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.material = Array.isArray(o.material)
          ? o.material.map((m) => m.clone())
          : o.material.clone();
      }
    });
    return s;
  }, [scene]);
  const occlusion = useMemo(() => {
    return createOcclusionController(collectOccluderMeshes(model));
  }, [model]);
  const interval = useRef(0.1);
  useFrame(({ camera }, dt) => {
    interval.current += dt;
    if (interval.current >= 0.08) {
      model.updateMatrixWorld(true);
      occlusion.detect(camera.position, position.current, playing);
      interval.current = 0;
    }
    occlusion.update(dt);
  });
  useEffect(
    () => () => {
      occlusion.restore();
      model.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
        }
      });
    },
    [occlusion, model],
  );
  return <primitive object={model} />;
}

function Player({
  config,
  nickname,
  path,
  keys,
  stick,
  active,
  unlocked,
  position,
  playerPositionRef,
  onNear,
  mapDot,
  bubbleText,
}: {
  config: AvatarConfig;
  nickname?: string;
  path: React.RefObject<PathPoint[]>;
  keys: React.RefObject<Set<string>>;
  stick: React.RefObject<{ x: number; y: number }>;
  active: boolean;
  unlocked: number;
  position: React.RefObject<THREE.Vector3>;
  playerPositionRef?: React.RefObject<{
    x: number;
    z: number;
    vx?: number;
    vz?: number;
    moving?: boolean;
  }>;
  onNear: (i: number) => void;
  mapDot: React.RefObject<SVGCircleElement | null>;
  bubbleText?: string;
}) {
  const group = useRef<THREE.Group>(null);
  const walking = usePlayerMotion({
    group,
    path,
    keys,
    stick,
    active,
    unlocked,
    position,
    onNear,
    mapDot,
  });
  useFrame((_, dt) => {
    if (!playerPositionRef) return;
    const prevX = playerPositionRef.current.x;
    const prevZ = playerPositionRef.current.z;
    const curX = position.current.x;
    const curZ = position.current.z;
    const safeDt = Math.max(dt, 0.008);
    playerPositionRef.current.vx = walking.current ? (curX - prevX) / safeDt : 0;
    playerPositionRef.current.vz = walking.current ? (curZ - prevZ) / safeDt : 0;
    playerPositionRef.current.x = curX;
    playerPositionRef.current.z = curZ;
    playerPositionRef.current.moving = walking.current;
  });
  const labelText = nickname && nickname !== 'Teman Alumni' ? nickname : 'Kamu';
  return (
    <group ref={group} position={[0, 0.28, 14]}>
      <group>
        <Character config={config} moving={walking} />
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.34, 0.4, 24]} />
        <meshBasicMaterial color="#fff6bf" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <Html position={[0, 1.95, 0]} center zIndexRange={[8, 0]}>
        <span className="player-label">{labelText}</span>
      </Html>
      {bubbleText && (
        <Html position={[0, 2.45, 0]} center zIndexRange={[14, 0]}>
          <div className="chat-speech-bubble" role="status">
            <p>{bubbleText}</p>
          </div>
        </Html>
      )}
    </group>
  );
}
export default function World({
  avatar,
  nickname,
  alumni,
  onlinePeers = [],
  activeBubbles = {},
  playerPositionRef,
  progress,
  onCheckpoint,
  active,
  playing,
  demo,
  focusId,
  travel,
  registered,
  overview,
  onNavigate,
  onOverview,
  onCreator,
  onKolam,
  onPentol,
  onShop,
}: {
  avatar: AvatarConfig;
  nickname?: string;
  alumni: Alumnus[];
  onlinePeers?: OnlinePeer[];
  activeBubbles?: Record<string, string>;
  playerPositionRef?: React.RefObject<{
    x: number;
    z: number;
    vx?: number;
    vz?: number;
    moving?: boolean;
  }>;
  progress: number[];
  onCheckpoint: (i: number) => void;
  active: boolean;
  playing: boolean;
  demo: boolean;
  focusId: string | null;
  travel: TravelRequest | null;
  registered: boolean;
  overview: boolean;
  onNavigate: (i: number) => void;
  onOverview: () => void;
  onCreator: () => void;
  onKolam: () => void;
  onPentol: () => void;
  onShop: () => void;
}) {
  const keys = useRef(new Set<string>()),
    stick = useRef({ x: 0, y: 0 }),
    position = useRef(new THREE.Vector3(0, 0.28, 14)),
    path = useRef<PathPoint[]>([]),
    controls = useRef<any>(null),
    mapDot = useRef<SVGCircleElement>(null),
    zoneLatch = useRef(-1);
  const [dpr, setDpr] = useState(window.innerWidth < 760 ? 1.25 : 1.5);
  const loading = useProgress((state) => state.active);
  const [near, setNear] = useState(-1),
    [nearCreator, setNearCreator] = useState(false),
    [nearKolam, setNearKolam] = useState(false),
    [nearPentol, setNearPentol] = useState(false),
    [nearShop, setNearShop] = useState(false),
    [failed, setFailed] = useState(false),
    [navigation, setNavigation] = useState(false);
  const next = CHECKPOINTS.findIndex((_, i) => !progress.includes(i)),
    unlocked = next < 0 ? 6 : next;
  const staticAlumni = useMemo(() => {
    const liveIds = new Set(onlinePeers.map((p) => p.alumniId).filter(Boolean));
    return liveIds.size > 0 ? alumni.filter((a) => !liveIds.has(a.id)) : alumni;
  }, [alumni, onlinePeers]);
  const placements = useMemo(() => layoutAlumni(alumni), [alumni]);
  const navigate = useCallback(
    (target: PathPoint) => {
      path.current = findPath(position.current, target, unlocked);
      setNavigation(path.current.length > 0);
    },
    [unlocked],
  );
  const openCreator = useCallback(() => {
    path.current = [];
    setNavigation(false);
    onCreator();
  }, [onCreator]);
  const openKolam = useCallback(() => {
    path.current = [];
    setNavigation(false);
    onKolam();
  }, [onKolam]);
  const openPentol = useCallback(() => {
    path.current = [];
    setNavigation(false);
    onPentol();
  }, [onPentol]);
  const openShop = useCallback(() => {
    path.current = [];
    setNavigation(false);
    onShop();
  }, [onShop]);
  const lastTravel = useRef<number | null>(null),
    lastFocus = useRef<string | null>(null);
  useEffect(() => {
    zoneLatch.current = -1;
  }, [registered]);
  useEffect(() => {
    if (travel && travel.index <= unlocked && lastTravel.current !== travel.nonce) {
      lastTravel.current = travel.nonce;
      const [x, z] = CHECKPOINTS[travel.index].position;
      navigate({ x, z });
    }
  }, [travel, navigate, unlocked]);
  useEffect(() => {
    if (focusId && lastFocus.current !== focusId) {
      lastFocus.current = focusId;
      const i = alumni.findIndex((a) => a.id === focusId);
      if (i >= 0) {
        const p = placements.get(alumni[i].id)!;
        navigate({ x: p[0], z: p[2] + 0.8 });
      }
    }
  }, [focusId, alumni, navigate, placements]);
  useEffect(() => {
    if (!focusId) lastFocus.current = null;
  }, [focusId]);
  useEffect(() => {
    if (!navigation) return;
    const timer = setInterval(() => {
      if (!path.current.length) setNavigation(false);
    }, 250);
    return () => clearInterval(timer);
  }, [navigation]);
  useEffect(() => {
    if (near < 0) zoneLatch.current = -1;
    if (active && near === next && near >= 0 && zoneLatch.current !== near) {
      zoneLatch.current = near;
      path.current = [];
      setNavigation(false);
      onCheckpoint(near);
    }
  }, [near, next, active, onCheckpoint]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!active || (e.target as HTMLElement)?.matches('input,textarea,select')) return;
      const k = e.key.toLowerCase();
      if (
        [
          'w',
          'a',
          's',
          'd',
          'arrowup',
          'arrowdown',
          'arrowleft',
          'arrowright',
          'shift',
          ' ',
        ].includes(k)
      ) {
        e.preventDefault();
        if (k === ' ') {
          if (!e.repeat) keys.current.add('jump');
        } else keys.current.add(k);
        setNavigation(false);
      }
      if (k === 'e' && nearCreator) openCreator();
      else if (k === 'e' && nearKolam) openKolam();
      else if (k === 'e' && nearPentol) openPentol();
      else if (k === 'e' && nearShop) openShop();
      else if (k === 'e' && near >= 0) onCheckpoint(near);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const clear = () => {
      keys.current.clear();
      stick.current = { x: 0, y: 0 };
      path.current = [];
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    if (!active) keys.current.clear();
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    };
  }, [
    active,
    near,
    nearCreator,
    nearKolam,
    nearPentol,
    nearShop,
    openCreator,
    openKolam,
    openPentol,
    openShop,
    onCheckpoint,
  ]);
  const fallback = (
    <div className="world-fallback">
      <h3>Perjalanan tetap berlanjut.</h3>
      <p>
        Perangkat ini belum bisa menampilkan dunia 3D. Gunakan mode ringan di pengaturan untuk
        melanjutkan misi satu per satu.
      </p>
    </div>
  );
  if (failed) return fallback;
  return (
    <SceneBoundary fallback={fallback}>
      <div className="world-canvas">
        <Canvas
          shadows
          dpr={dpr}
          camera={{ position: [35, 42, 39], fov: 43, near: 0.1, far: 160 }}
          onCreated={({ gl }) => {
            gl.setClearColor('#c7e0ee');
            gl.toneMappingExposure = 1.05;
            gl.domElement.addEventListener('webglcontextlost', () => setFailed(true));
          }}
        >
          <fog attach="fog" args={['#c7e0ee', 65, 125]} />
          <ambientLight intensity={0.6} />
          <hemisphereLight args={['#f6fbff', '#91b96b', 0.9]} />
          <directionalLight
            position={[-15, 28, 18]}
            intensity={2.7}
            castShadow
            shadow-mapSize={window.innerWidth < 760 ? [1024, 1024] : [2048, 2048]}
            shadow-camera-left={-30}
            shadow-camera-right={30}
            shadow-camera-top={26}
            shadow-camera-bottom={-26}
            shadow-bias={-0.001}
          />
          <Suspense fallback={null}>
            <PerformanceMonitor
              onDecline={() => setDpr(1)}
              flipflops={1}
              onFallback={() => setDpr(1)}
            />
            <MapModel position={position} playing={playing} />
            <Suspense fallback={null}>
              <CreatorMonument
                player={position}
                active={active}
                onNear={setNearCreator}
                onOpen={openCreator}
                onWalk={navigate}
              />
            </Suspense>
            <Suspense fallback={null}>
              <KolamBecabur
                player={position}
                active={active}
                playing={playing}
                onNear={setNearKolam}
                onOpen={openKolam}
              />
            </Suspense>
            <Suspense fallback={null}>
              <GerobakPentol
                player={position}
                active={active}
                playing={playing}
                onNear={setNearPentol}
                onOpen={openPentol}
                onWalk={navigate}
              />
            </Suspense>
            <Suspense fallback={null}>
              <ShopBuilding
                player={position}
                active={active}
                playing={playing}
                onNear={setNearShop}
                onOpen={openShop}
              />
            </Suspense>
            {playing && <RouteTrail path={path} />}
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0.38, 7]}
              onClick={(e) => {
                if (active) {
                  e.stopPropagation();
                  navigate({ x: e.point.x, z: e.point.z });
                }
              }}
            >
              <planeGeometry args={[50, 56]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {playing &&
              CHECKPOINTS.map((c, i) => {
                const done = progress.includes(i),
                  locked = i > unlocked;
                return (
                  <group key={i} position={[c.position[0], 0, c.position[1]]}>
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.4, 0]}>
                      <ringGeometry args={[locked ? 1.85 : 1.45, locked ? 1.95 : 1.58, 48]} />
                      <meshBasicMaterial
                        color={locked ? '#a9b4c1' : done ? '#84b95c' : '#367fcb'}
                        transparent
                        opacity={locked ? 0.45 : 0.9}
                        depthWrite={false}
                      />
                    </mesh>
                    {locked && (
                      <mesh position={[0, 0.7, 0]}>
                        <cylinderGeometry args={[1.9, 1.9, 0.8, 32, 1, true]} />
                        <meshBasicMaterial
                          color="#acbccc"
                          transparent
                          opacity={0.13}
                          side={THREE.DoubleSide}
                          depthWrite={false}
                        />
                      </mesh>
                    )}
                    <Html position={[0, 2.7, 0]} center zIndexRange={[10, 0]}>
                      <button
                        disabled={locked || (!active && !overview)}
                        className={
                          'map-pin ' +
                          (done ? 'done ' : '') +
                          (locked ? 'locked ' : '') +
                          (i === next ? 'next' : '')
                        }
                        onClick={() => onNavigate(i)}
                        aria-label={
                          locked
                            ? 'Area terkunci: selesaikan misi sebelumnya'
                            : 'Pergi ke ' + c.name
                        }
                      >
                        <span>
                          {locked ? (
                            <Lock size={12} />
                          ) : done ? (
                            '✓'
                          ) : (
                            String(i + 1).padStart(2, '0')
                          )}
                        </span>
                        {i === next && <b>{c.name}</b>}
                      </button>
                    </Html>
                  </group>
                );
              })}
            <AlumniCrowd
              alumni={staticAlumni}
              playing={playing}
              focusId={focusId}
              player={position}
            />
            <OnlinePeers peers={onlinePeers} playing={playing} activeBubbles={activeBubbles} />
            {demo &&
              alumni.length === 0 &&
              [
                [-2, 2],
                [2, 2],
                [-3, -1],
                [3, -2],
              ].map(([x, z], i) => (
                <group key={i} position={[x, 0.28, z]} rotation={[0, i, 0]}>
                  <Character
                    config={{
                      ...DEFAULT_AVATAR,
                      outfit: (['clay', 'navy', 'cream', 'sage'] as const)[i],
                    }}
                  />
                </group>
              ))}
            <Player
              config={avatar}
              nickname={nickname}
              path={path}
              keys={keys}
              stick={stick}
              active={active}
              unlocked={unlocked}
              position={position}
              playerPositionRef={playerPositionRef}
              onNear={setNear}
              mapDot={mapDot}
              bubbleText={
                (nickname ? activeBubbles[nickname.toLowerCase().trim()] : undefined) ||
                activeBubbles['kamu'] ||
                activeBubbles['me']
              }
            />
            <OrbitControls
              ref={controls}
              target={[0, 0.65, 0]}
              enablePan={false}
              enableDamping
              dampingFactor={0.08}
              minPolarAngle={0.4}
              maxPolarAngle={1.15}
              minDistance={10}
              maxDistance={85}
              enabled={active || !playing || overview}
            />
            <CameraFollow
              controls={controls}
              position={position}
              playing={playing}
              overview={overview}
            />
          </Suspense>
        </Canvas>
        {loading && (
          <div className="world-loading-overlay" role="status">
            <span className="loading-world">Menyiapkan tempat pulang…</span>
          </div>
        )}
        {playing && (
          <>
            {overview && (
              <div className="overview-caption">
                Pilih penanda area untuk menuju ke sana{' '}
                <button onClick={onOverview}>Kembali menjelajah · O</button>
              </div>
            )}
            <button
              className="world-minimap"
              onClick={onOverview}
              aria-label="Lihat seluruh kampus"
              aria-pressed={overview}
            >
              <span>N</span>
              <svg viewBox="0 0 100 100" aria-label="Peta dunia: titik putih adalah posisimu">
                <rect x="2" y="2" width="96" height="96" rx="8" fill="#c8d1a9" />
                <path d="M50 5V96M5 37H95M8 13H92" stroke="#f0e3bc" strokeWidth="5" />
                <rect x="29" y="20" width="18" height="8" rx="1" fill="#b78667" />
                <rect x="53" y="20" width="15" height="8" rx="1" fill="#b78667" />
                <rect x="8" y="32" width="18" height="26" rx="2" fill="#8caa8e" />
                <circle cx="86" cy="66" r="6" fill="#80b4b5" />
                <rect x="24" y="75" width="52" height="20" rx="5" fill="#e6e7d5" />
                <path d="M30 94H70" stroke="#367fcb" strokeWidth="2" />
                {MISSION_ZONES.map(([x, z], i) => (
                  <circle
                    key={i}
                    cx={(x + 25) * 2}
                    cy={(z + 21) * (100 / 56)}
                    r={i === next ? 2.7 : 1.7}
                    fill={i > unlocked ? '#8f9b84' : progress.includes(i) ? '#3f7653' : '#d99043'}
                  />
                ))}
                <circle
                  ref={mapDot}
                  cx="50"
                  cy="62.5"
                  r="2.6"
                  fill="white"
                  stroke="#3d6959"
                  strokeWidth="1"
                />
              </svg>
              <small>SEKOLAH & TAMAN</small>
            </button>
            <div className="world-controls">
              <span>
                <kbd>W A S D</kbd> berjalan <i /> <kbd>Shift</kbd> berlari <i /> <kbd>Space</kbd>{' '}
                loncat <i /> geser untuk kamera
              </span>
              <button
                aria-label="Pusatkan kamera ke pemain"
                onClick={() => {
                  controls.current?.target.copy(position.current);
                  controls.current?.update();
                }}
              >
                <RotateCcw size={17} />
              </button>
            </div>
            {active && (
              <>
                <Joystick stick={stick} />
                <button
                  className="jump-button"
                  aria-label="Loncat"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    keys.current.add('jump');
                  }}
                >
                  <ArrowUp size={24} />
                  <span>LONCAT</span>
                </button>
                <button
                  className="run-button"
                  aria-label="Tahan untuk berlari"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    keys.current.add('shift');
                  }}
                  onPointerUp={() => keys.current.delete('shift')}
                  onPointerCancel={() => keys.current.delete('shift')}
                  onLostPointerCapture={() => keys.current.delete('shift')}
                >
                  <Footprints size={23} />
                  <span>LARI</span>
                </button>
                {nearCreator && (
                  <button className="interact" onClick={openCreator}>
                    <span className="interact-key">E</span>
                    <span>
                      Kenalan dengan pembuatnya<small>Randy Fauzi</small>
                    </span>
                    <Navigation size={18} />
                  </button>
                )}
                {nearKolam && !nearCreator && (
                  <button className="interact" onClick={openKolam}>
                    <span className="interact-key">E</span>
                    <span>
                      Kenangan Kolam Becabur<small>Putar video</small>
                    </span>
                    <Navigation size={18} />
                  </button>
                )}
                {nearPentol && !nearCreator && !nearKolam && (
                  <button className="interact" onClick={openPentol}>
                    <span className="interact-key">E</span>
                    <span>
                      Sapa Pakle<small>Pentol Bakwan Pakle</small>
                    </span>
                    <Navigation size={18} />
                  </button>
                )}
                {nearShop && !nearCreator && !nearKolam && !nearPentol && (
                  <button className="interact" onClick={openShop}>
                    <span className="interact-key">E</span>
                    <span>
                      Masuk Shop<small>Toko Avatar &amp; Aksesoris</small>
                    </span>
                    <Navigation size={18} />
                  </button>
                )}
                {near >= 0 && !nearCreator && !nearKolam && !nearPentol && !nearShop && (
                  <button className="interact" onClick={() => onCheckpoint(near)}>
                    <span className="interact-key">E</span>
                    <span>
                      {progress.includes(near) ? 'Lihat kembali' : 'Buka cerita'}
                      <small>{CHECKPOINTS[near].name}</small>
                    </span>
                    <Navigation size={18} />
                  </button>
                )}
              </>
            )}
            {navigation && active && (
              <div className="navigation-status">
                <Navigation size={13} /> Mengikuti jalan…{' '}
                <button
                  onClick={() => {
                    path.current = [];
                    setNavigation(false);
                  }}
                >
                  Berhenti
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </SceneBoundary>
  );
}
