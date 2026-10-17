'use client';

import { Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { RenderContext } from './ChogModel';
import { glowMat, matte } from './toon';

export type Quality = 'low' | 'medium' | 'high';
export type Backdrop = 'home' | 'cloud' | 'grove' | 'neon' | 'ember' | 'void' | 'studio';

function SkyDome({ top, bottom }: { top: string; bottom: string }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) } },
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = smoothstep(-0.25, 0.65, vP.y); gl_FragColor = vec4(mix(bottom, top, h), 1.0);\n#include <colorspace_fragment>\n}',
      }),
    [top, bottom],
  );
  return (
    <mesh material={mat} renderOrder={-1}>
      <sphereGeometry args={[40, 24, 16]} />
    </mesh>
  );
}

function Cloud({ position, scale = 1, speed = 0.2 }: { position: [number, number, number]; scale?: number; speed?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.x = position[0] + Math.sin(clock.elapsedTime * speed + position[2]) * 0.6;
  });
  const m = matte('#ffffff');
  return (
    <group ref={ref} position={position} scale={scale}>
      <mesh material={m}><sphereGeometry args={[0.6, 14, 10]} /></mesh>
      <mesh material={m} position={[0.6, -0.1, 0]}><sphereGeometry args={[0.45, 14, 10]} /></mesh>
      <mesh material={m} position={[-0.6, -0.12, 0]}><sphereGeometry args={[0.42, 14, 10]} /></mesh>
    </group>
  );
}

function Island({ grass, dirt }: { grass: string; dirt: string }) {
  return (
    <group position={[0, -0.02, 0]}>
      <mesh material={matte(grass)} position={[0, -0.1, 0]}>
        <cylinderGeometry args={[1.6, 1.5, 0.2, 32]} />
      </mesh>
      <mesh material={matte(dirt)} position={[0, -0.75, 0]}>
        <coneGeometry args={[1.5, 1.2, 32]} />
      </mesh>
    </group>
  );
}

function Ufo() {
  const ref = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ref.current) { ref.current.rotation.y = t * 0.6; ref.current.position.y = 4.1 + Math.sin(t * 1.3) * 0.08; }
    if (beam.current) (beam.current.material as THREE.MeshBasicMaterial).opacity = 0.18 + Math.sin(t * 6) * 0.04;
  });
  return (
    <group>
      <group ref={ref} position={[0, 4.1, -0.4]}>
        <mesh material={matte('#8e96a8')}><cylinderGeometry args={[0.6, 2.0, 0.35, 32]} /></mesh>
        <mesh material={matte('#5b6272')} position={[0, -0.22, 0]}><cylinderGeometry args={[2.0, 1.2, 0.18, 32]} /></mesh>
        <mesh material={matte('#a7ffd0', { opacity: 0.8 })} position={[0, 0.3, 0]}><sphereGeometry args={[0.6, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return <mesh key={i} position={[Math.sin(a) * 1.85, -0.05, Math.cos(a) * 1.85]} material={glowMat('#39ff6a', 0.95)}><boxGeometry args={[0.18, 0.08, 0.12]} /></mesh>;
        })}
      </group>
      <mesh ref={beam} position={[0, 1.9, -0.2]} material={glowMat('#39ff6a', 0.2)}>
        <cylinderGeometry args={[0.9, 1.7, 4.2, 32, 1, true]} />
      </mesh>
    </group>
  );
}

function NeonCity() {
  const cols = ['#14e0c8', '#ff5fd2', '#7c4dff'];
  return (
    <group>
      <gridHelper args={[30, 30, '#14e0c8', '#0a4b55']} position={[0, -0.01, 0]} />
      {Array.from({ length: 9 }, (_, i) => {
        const x = (i - 4) * 1.6;
        const h = 2 + ((i * 7) % 5);
        return (
          <group key={i} position={[x, h / 2, -6 - (i % 3)]}>
            <mesh material={matte('#0b1c26')}><boxGeometry args={[1.2, h, 1]} /></mesh>
            <mesh position={[0, h / 2 - 0.3, 0.51]} material={glowMat(cols[i % 3], 0.9)}><boxGeometry args={[0.9, 0.08, 0.02]} /></mesh>
          </group>
        );
      })}
    </group>
  );
}

function EmberRift() {
  const bolt = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (bolt.current) bolt.current.visible = Math.sin(clock.elapsedTime * 2.7) > 0.93;
  });
  return (
    <group>
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[(i - 3) * 2.2, 0.8 + (i % 2), -7]} material={matte('#3a0f17')}>
          <coneGeometry args={[1.2, 3 + (i % 3), 5]} />
        </mesh>
      ))}
      <mesh ref={bolt} position={[2.5, 4, -6]} rotation={[0, 0, 0.3]} material={glowMat('#fff36b', 0.95)}>
        <boxGeometry args={[0.12, 5, 0.12]} />
      </mesh>
      <Sparkles count={60} scale={[12, 6, 6]} position={[0, 2, -2]} size={6} speed={1.2} color="#ff7a3d" />
    </group>
  );
}

const BACKDROPS: Record<Exclude<Backdrop, 'home'>, { sky: [string, string]; grass: string; dirt: string }> = {
  cloud: { sky: ['#8fd3ff', '#f6e8ff'], grass: '#8ef0a0', dirt: '#b98a66' },
  grove: { sky: ['#a6f0a0', '#1f5a3a'], grass: '#3fae55', dirt: '#5b3a24' },
  neon: { sky: ['#14e0c8', '#04131a'], grass: '#103a44', dirt: '#071a20' },
  ember: { sky: ['#ff7a3d', '#2a0710'], grass: '#5a1a14', dirt: '#2a0b08' },
  void: { sky: ['#2a1a7a', '#05031a'], grass: '#2a2350', dirt: '#14102b' },
  studio: { sky: ['#2a1f4a', '#0d0a1a'], grass: '#3a2f63', dirt: '#1c1633' },
};

export function World({ backdrop, homeColors }: { backdrop: Backdrop; homeColors?: [string, string] }) {
  const conf = backdrop === 'home' ? { sky: [homeColors?.[0] ?? '#c8b6ff', homeColors?.[1] ?? '#6d4cc9'] as [string, string], grass: '#8ef0a0', dirt: '#a07a5a' } : BACKDROPS[backdrop];
  return (
    <>
      <SkyDome top={conf.sky[0]} bottom={conf.sky[1]} />
      {backdrop === 'studio' ? (
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} material={matte('#3a2f6b')} position={[0, -0.01, 0]}>
            <circleGeometry args={[1.8, 48]} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} material={glowMat('#a98bff', 0.35)} position={[0, 0, 0]}>
            <ringGeometry args={[1.75, 1.85, 64]} />
          </mesh>
          <directionalLight position={[0, 3, -4]} intensity={0.9} color="#ff8fc8" />
        </group>
      ) : (
        <Island grass={conf.grass} dirt={conf.dirt} />
      )}
      {(backdrop === 'home' || backdrop === 'cloud') && (
        <>
          <Cloud position={[-3.6, 3.4, -6]} scale={1.1} />
          <Cloud position={[3.8, 2.6, -7]} scale={0.9} speed={0.15} />
          <Cloud position={[0.8, 5.2, -10]} scale={1.4} speed={0.1} />
        </>
      )}
      {backdrop === 'grove' && (
        <group>
          {[-3, -1.8, 2, 3.2].map((x, i) => (
            <group key={x} position={[x, 0, -3 - (i % 2)]}>
              <mesh position={[0, 0.8, 0]} material={matte('#5b3a24')}><cylinderGeometry args={[0.15, 0.2, 1.6, 8]} /></mesh>
              <mesh position={[0, 1.9, 0]} material={matte('#2f8f46')}><sphereGeometry args={[0.9, 14, 10]} /></mesh>
            </group>
          ))}
          <Sparkles count={40} scale={[8, 4, 4]} position={[0, 2, -1]} size={4} speed={0.3} color="#d6ff8a" />
        </group>
      )}
      {backdrop === 'neon' && <NeonCity />}
      {backdrop === 'ember' && <EmberRift />}
      {backdrop === 'void' && (
        <>
          <Ufo />
          <Sparkles count={70} scale={[14, 8, 8]} position={[0, 3, -4]} size={3} speed={0.2} color="#ffffff" />
        </>
      )}
    </>
  );
}

/** Keeps the whole Chog in frame on any aspect ratio: portrait phones pull the camera back. */
function CameraRig({ base, target, width, height }: { base: [number, number, number]; target: [number, number, number]; width: number; height: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const halfFov = THREE.MathUtils.degToRad(cam.fov / 2);
    const dir = new THREE.Vector3(base[0] - target[0], base[1] - target[1], base[2] - target[2]);
    const baseDist = dir.length();
    const needW = width / 2 / (Math.tan(halfFov) * aspect);
    const needH = height / 2 / Math.tan(halfFov);
    const dist = Math.max(baseDist, needW, needH);
    dir.normalize().multiplyScalar(dist);
    cam.position.set(target[0] + dir.x, target[1] + dir.y, target[2] + dir.z);
    cam.lookAt(target[0], target[1], target[2]);
    cam.updateProjectionMatrix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, size.width, size.height, base.join(), target.join(), width, height]);
  return null;
}

export function Stage({
  children,
  quality,
  reducedMotion,
  camera = [0, 1.55, 5.6],
  target = [0, 1.15, 0],
  onPointerDown,
  className,
  frameWidth = 3.1,
  frameHeight = 3.5,
}: {
  children: ReactNode;
  quality: Quality;
  reducedMotion: boolean;
  camera?: [number, number, number];
  target?: [number, number, number];
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  className?: string;
  frameWidth?: number;
  frameHeight?: number;
}) {
  const dpr: [number, number] = quality === 'low' ? [1, 1] : quality === 'medium' ? [1, 1.5] : [1, 2];
  return (
    <div className={className} onPointerDown={onPointerDown} style={{ touchAction: 'manipulation' }}>
      <Canvas
        dpr={dpr}
        gl={{ antialias: quality !== 'low', powerPreference: 'high-performance', alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        camera={{ position: camera, fov: 34, near: 0.1, far: 100 }}
        frameloop="always"
      >
        <CameraRig base={camera} target={target} width={frameWidth} height={frameHeight} />
        <RenderContext.Provider value={{ low: quality === 'low', particles: quality !== 'low' && !reducedMotion, reducedMotion }}>
          <hemisphereLight args={['#f3ecff', '#5a3e9a', 1.25]} />
          <directionalLight position={[2.5, 4, 5]} intensity={2.1} color="#fff6ee" />
          <directionalLight position={[-3, 2.5, -4]} intensity={1.6} color="#ff9ccf" />
          <directionalLight position={[-4, 1, 3]} intensity={0.45} color="#b9a6ff" />
          <Suspense fallback={null}>{children}</Suspense>
        </RenderContext.Provider>
      </Canvas>
    </div>
  );
}

/** Rough device tiering: low-memory or low-core devices start on Low. */
export function detectQuality(): Quality {
  if (typeof navigator === 'undefined') return 'medium';
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  const small = typeof window !== 'undefined' && Math.min(window.screen.width, window.screen.height) < 400;
  if (mem <= 2 || cores <= 2) return 'low';
  if (mem >= 8 && cores >= 8 && !small) return 'high';
  return 'medium';
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
