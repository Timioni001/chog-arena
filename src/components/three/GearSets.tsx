'use client';

import { useContext, useMemo } from 'react';
import * as THREE from 'three';
import { fur, glowMat, gloss } from './toon';
import { RenderContext } from './ChogModel';

/** Gear sets drawn from the owner's variant sheets. Body coordinates match ChogModel; head pieces sit in head space. */
export type VariantGear = 'forest' | 'desert' | 'crystal' | 'cyber' | 'ice' | 'ocean';
export const VARIANT_GEAR: VariantGear[] = ['forest', 'desert', 'crystal', 'cyber', 'ice', 'ocean'];

/** Suit colour painted over the body, or null to keep the bare fur. */
export const GEAR_SUIT: Record<VariantGear, string | null> = {
  forest: null,
  desert: null,
  crystal: '#3d1a7a',
  cyber: '#1d1a26',
  ice: '#24448f',
  ocean: '#1c2f6e',
};

function useSided(color: string, opts: { low: boolean; emissive?: string; rough?: number }) {
  return useMemo(() => {
    if (opts.low) return new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, emissive: opts.emissive ?? '#000000', emissiveIntensity: opts.emissive ? 0.3 : 0 });
    return new THREE.MeshPhysicalMaterial({ color, side: THREE.DoubleSide, roughness: opts.rough ?? 0.8, sheen: 0.8, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.4), sheenRoughness: 0.6, emissive: opts.emissive ?? '#000000', emissiveIntensity: opts.emissive ? 0.3 : 0 });
  }, [color, opts.low, opts.emissive, opts.rough]);
}

function Scarf({ color, trim, thick = 0.09 }: { color: string; trim?: string; thick?: number }) {
  const { low } = useContext(RenderContext);
  return (
    <group position={[0, 0.64, 0.1]} rotation={[Math.PI / 2 - 0.15, 0, 0]}>
      <mesh material={fur(color, { low })}><torusGeometry args={[0.42, thick, 12, 36]} /></mesh>
      {trim && <mesh position={[0, 0, thick * 0.6]} material={fur(trim, { low })}><torusGeometry args={[0.44, thick * 0.45, 8, 36]} /></mesh>}
      {/* knot tail */}
      <mesh position={[0.18, -0.3, -0.06]} rotation={[0.2, 0, -0.5]} scale={[0.12, 0.2, 0.04]} material={fur(color, { low })}><sphereGeometry args={[1, 14, 10]} /></mesh>
    </group>
  );
}

function Cape({ color, trim }: { color: string; trim: string }) {
  const { low } = useContext(RenderContext);
  const mat = useSided(color, { low });
  return (
    <group position={[0, 0.5, -0.12]}>
      <mesh rotation={[0.12, 0, 0]} material={mat}>
        <cylinderGeometry args={[0.56, 0.7, 0.62, 28, 1, true, Math.PI * 0.55, Math.PI * 0.9]} />
      </mesh>
      <mesh position={[0, -0.31, -0.02]} rotation={[0.12, 0, 0]} material={fur(trim, { low })}>
        <torusGeometry args={[0.7, 0.045, 8, 32, Math.PI * 0.9]} />
      </mesh>
    </group>
  );
}

function Pack({ color, strap, glow }: { color: string; strap: string; glow?: string }) {
  const { low } = useContext(RenderContext);
  return (
    <group position={[0, 0.86, -0.5]} rotation={[-0.35, 0, 0]}>
      <mesh material={fur(color, { low })}><boxGeometry args={[0.44, 0.34, 0.24]} /></mesh>
      <mesh position={[0, 0.2, 0]} rotation={[0, 0, Math.PI / 2]} material={fur(strap, { low })}><cylinderGeometry args={[0.1, 0.1, 0.46, 16]} /></mesh>
      {glow && (
        <mesh position={[0, -0.01, -0.13]} rotation={[Math.PI / 2, 0, 0]} material={glowMat(glow, 0.95)}>
          <torusGeometry args={[0.1, 0.03, 8, 24]} />
        </mesh>
      )}
    </group>
  );
}

function Canteen() {
  const { low } = useContext(RenderContext);
  return (
    <group position={[-0.5, 0.72, -0.25]} rotation={[0, 0, 0.15]}>
      <mesh material={gloss('#a9adb6', { low, metalness: 0.8, roughness: 0.35 })}><capsuleGeometry args={[0.1, 0.18, 6, 14]} /></mesh>
      <mesh position={[0, 0.02, 0]} material={fur('#6b4326', { low })}><torusGeometry args={[0.105, 0.025, 6, 20]} /></mesh>
    </group>
  );
}

function Lantern() {
  const { low } = useContext(RenderContext);
  return (
    <group position={[0.5, 0.58, 0.18]}>
      <mesh position={[0, 0.16, 0]} material={gloss('#8a6a2e', { low, metalness: 0.8, roughness: 0.35 })}><torusGeometry args={[0.06, 0.015, 6, 16]} /></mesh>
      <mesh material={gloss('#8a6a2e', { low, metalness: 0.8, roughness: 0.35 })}><cylinderGeometry args={[0.09, 0.1, 0.03, 12]} /></mesh>
      <mesh position={[0, -0.09, 0]} material={gloss('#ffd27a', { low, emissive: '#ffb340', emissiveIntensity: 1.4, roughness: 0.1 })}><sphereGeometry args={[0.075, 16, 12]} /></mesh>
      <mesh position={[0, -0.09, 0]} material={glowMat('#ffbe5c', 0.35)}><sphereGeometry args={[0.15, 16, 12]} /></mesh>
      <mesh position={[0, -0.19, 0]} material={gloss('#8a6a2e', { low, metalness: 0.8, roughness: 0.35 })}><cylinderGeometry args={[0.1, 0.09, 0.03, 12]} /></mesh>
      {!low && <pointLight position={[0, -0.09, 0.1]} color="#ffb34d" intensity={0.8} distance={1.6} />}
    </group>
  );
}

function Staff() {
  const { low } = useContext(RenderContext);
  return (
    <group position={[0.56, 0.2, 0.42]} rotation={[0.1, 0, -0.12]}>
      <mesh position={[0, 0.7, 0]} material={fur('#7a4a22', { low })}><cylinderGeometry args={[0.035, 0.045, 1.4, 10]} /></mesh>
      <mesh position={[0, 1.42, 0]} rotation={[0, 0.5, 0]} material={gloss('#c9a7ff', { low, emissive: '#9b5cff', emissiveIntensity: 0.9, roughness: 0.05, opacity: 0.92 })}>
        <octahedronGeometry args={[0.17, 0]} />
      </mesh>
      <mesh position={[0, 1.42, 0]} material={glowMat('#b07bff', 0.4)}><sphereGeometry args={[0.28, 16, 12]} /></mesh>
      <mesh position={[0, 1.42, 0]} rotation={[Math.PI / 2.4, 0, 0]} material={gloss('#d4a84a', { low, metalness: 0.85, roughness: 0.3 })}><torusGeometry args={[0.22, 0.015, 6, 28]} /></mesh>
      {!low && <pointLight position={[0, 1.42, 0.1]} color="#b07bff" intensity={1} distance={2} />}
    </group>
  );
}

function Shield() {
  const { low } = useContext(RenderContext);
  return (
    <group position={[-0.52, 0.56, 0.48]} rotation={[Math.PI / 2, 0, -0.45]}>
      <mesh material={gloss('#c8d2e6', { low, metalness: 0.6, roughness: 0.25 })}><cylinderGeometry args={[0.4, 0.4, 0.06, 6]} /></mesh>
      <mesh position={[0, 0.035, 0]} material={gloss('#bfe6ff', { low, emissive: '#5fb8ff', emissiveIntensity: 0.6, roughness: 0.05, opacity: 0.9 })}><cylinderGeometry args={[0.33, 0.33, 0.03, 6]} /></mesh>
      <mesh position={[0, 0.06, 0]} material={glowMat('#8fd3ff', 0.55)}><cylinderGeometry args={[0.12, 0.12, 0.01, 6]} /></mesh>
    </group>
  );
}

function Pendant({ color }: { color: string }) {
  const { low } = useContext(RenderContext);
  return (
    <group position={[0, 0.66, 0.5]}>
      <mesh rotation={[0, 0, Math.PI / 4]} material={gloss(color, { low, emissive: color, emissiveIntensity: 0.7, roughness: 0.1 })}><octahedronGeometry args={[0.07, 0]} /></mesh>
      <mesh material={glowMat(color, 0.4)}><sphereGeometry args={[0.12, 12, 10]} /></mesh>
    </group>
  );
}

/** Body pieces for a variant gear set. */
export function GearBody({ gear }: { gear: VariantGear }) {
  switch (gear) {
    case 'forest':
      return (<><Scarf color="#6f8f3a" /><Pack color="#6e4526" strap="#8c6a3e" /><Lantern /></>);
    case 'desert':
      return (<><Scarf color="#c9a46a" thick={0.11} /><Pack color="#6b4326" strap="#b48c5a" /><Canteen /></>);
    case 'crystal':
      return (<><Cape color="#4b1f8f" trim="#d4a84a" /><Pendant color="#b07bff" /><Staff /></>);
    case 'cyber':
      return (<><Scarf color="#d12f7a" /><mesh position={[0, 0.62, 0.48]} material={glowMat('#ff4fd8', 0.9)}><boxGeometry args={[0.2, 0.04, 0.02]} /></mesh></>);
    case 'ice':
      return (<><Cape color="#2c4ea0" trim="#f4f1ea" /><Scarf color="#f4f1ea" thick={0.12} /><Pendant color="#6fd0ff" /><Shield /></>);
    case 'ocean':
      return (<><Pack color="#1f2b55" strap="#c4a35a" glow="#4ef0ff" /><Pendant color="#ffd6f0" /></>);
  }
}

function Visor({ strap, lens, glow, frame = '#9a9caa', single = false }: { strap: string; lens: string; glow: string; frame?: string; single?: boolean }) {
  const { low } = useContext(RenderContext);
  return (
    <group position={[0, 0.36, 0.05]} rotation={[-0.35, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={fur(strap, { low })}><torusGeometry args={[0.78, 0.06, 10, 40]} /></mesh>
      {single ? (
        <group position={[0, 0.02, 0.76]}>
          <mesh material={gloss(frame, { low, metalness: 0.75, roughness: 0.3 })}><boxGeometry args={[0.92, 0.26, 0.12]} /></mesh>
          <mesh position={[0, 0, 0.065]} material={gloss(lens, { low, emissive: glow, emissiveIntensity: 0.7, roughness: 0.05 })}><boxGeometry args={[0.84, 0.19, 0.02]} /></mesh>
        </group>
      ) : (
        [-0.22, 0.22].map((x) => (
          <group key={x} position={[x, 0.02, 0.74]} rotation={[0, x * 0.8, 0]}>
            <mesh material={gloss(frame, { low, metalness: 0.75, roughness: 0.3 })}><boxGeometry args={[0.32, 0.22, 0.1]} /></mesh>
            <mesh position={[0, 0, 0.055]} material={gloss(lens, { low, emissive: glow, emissiveIntensity: 0.35, roughness: 0.05 })}><boxGeometry args={[0.26, 0.16, 0.02]} /></mesh>
          </group>
        ))
      )}
    </group>
  );
}

function ClothHood({ color, gem }: { color: string; gem?: string }) {
  const { low } = useContext(RenderContext);
  return (
    <group>
      {/* phi 0 points down -x; a quarter turn puts the opening over the face */}
      <mesh rotation={[0, Math.PI / 2, 0]} scale={[1.08, 1.04, 1.02]} material={fur(color, { low })}>
        <sphereGeometry args={[0.84, 32, 24, Math.PI * 0.36, Math.PI * 1.28]} />
      </mesh>
      {gem && (
        <mesh position={[0, 0.66, 0.5]} rotation={[0.4, 0, Math.PI / 4]} material={gloss(gem, { low, emissive: gem, emissiveIntensity: 0.8, roughness: 0.05 })}>
          <octahedronGeometry args={[0.1, 0]} />
        </mesh>
      )}
    </group>
  );
}

function Leaf() {
  const { low } = useContext(RenderContext);
  return (
    <group position={[0.36, 0.66, 0.46]} rotation={[0.4, 0.2, -0.6]} scale={1.8}>
      <mesh scale={[0.16, 0.06, 0.02]} material={fur('#7aa83e', { low })}><sphereGeometry args={[1, 14, 10]} /></mesh>
      <mesh position={[-0.12, 0.05, 0]} rotation={[0, 0, 0.9]} scale={[0.12, 0.05, 0.02]} material={fur('#9cc45a', { low })}><sphereGeometry args={[1, 14, 10]} /></mesh>
    </group>
  );
}

/** Head pieces for a variant gear set. */
export function GearHead({ gear }: { gear: VariantGear }) {
  switch (gear) {
    case 'forest':
      return <Leaf />;
    case 'desert':
      return (<><ClothHood color="#c9a46a" /><Visor strap="#6b4326" lens="#ffad42" glow="#ff8a1a" frame="#b08d57" /></>);
    case 'crystal':
      return <ClothHood color="#4b1f8f" gem="#c08bff" />;
    case 'cyber':
      return <Visor strap="#24202e" lens="#ff7ae6" glow="#ff2fd0" frame="#3a3646" single />;
    case 'ice':
      return null;
    case 'ocean':
      return <Visor strap="#2b4a7a" lens="#9ff6ff" glow="#38e1ff" frame="#c9a35a" single />;
  }
}
