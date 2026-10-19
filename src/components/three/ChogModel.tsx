'use client';

import { createContext, useContext, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import type { Appearance } from '@/lib/appearance';
import { basic, blobShadow, fur, glowMat, gloss, labelTexture } from './toon';
import { GEAR_SUIT, GearBody, GearHead, VARIANT_GEAR, type VariantGear } from './GearSets';

export type AnimKind = 'idle' | 'tap' | 'charge' | 'attack' | 'hit' | 'win' | 'levelup' | 'lose';
export interface AnimCue {
  kind: AnimKind;
  id: number;
}
export type Gear = 'space' | 'hoodie' | 'runner' | VariantGear | null;

export const RenderContext = createContext<{ low: boolean; particles: boolean; reducedMotion: boolean }>({ low: false, particles: true, reducedMotion: false });

const CREAM = '#f6ead8';
const PINK = '#ff5fa2';
const EYE = '#1e1030';
const UP = new THREE.Vector3(0, 1, 0);

/** The cream face is an ellipsoid pressed onto the front of the head; features sit on its surface. */
const FACE = { y: -0.06, z: 0.42, rx: 0.6, ry: 0.53, rz: 0.36 };
export function fz(x: number, y: number, lift = 0.01): number {
  const k = 1 - (x / FACE.rx) ** 2 - ((y - FACE.y) / FACE.ry) ** 2;
  return FACE.z + FACE.rz * Math.sqrt(Math.max(0, k)) + lift;
}

interface Quill { pos: THREE.Vector3; quat: THREE.Quaternion; r: number; len: number }

/** Star-burst mane: a front ring framing the face, a second ring behind it, and a crown down the back. */
function maneQuills(): Quill[] {
  const out: Quill[] = [];
  // Cones are centred on their position, so push each one out until its base sits just under the fur.
  const add = (dir: THREE.Vector3, r: number, len: number) => {
    const d = dir.clone().normalize();
    out.push({ pos: d.clone().multiplyScalar(0.66 + len * 0.42), quat: new THREE.Quaternion().setFromUnitVectors(UP, d), r, len });
  };
  const n1 = 11;
  for (let i = 0; i < n1; i++) {
    const t = (i / n1) * Math.PI * 2 + Math.PI / 2;
    const s = Math.sin(t);
    if (s < -0.75) continue; // leave the chin free
    add(new THREE.Vector3(Math.cos(t), s, -0.18), 0.37, 0.64 + Math.max(0, s) * 0.2);
  }
  const n2 = 11;
  for (let i = 0; i < n2; i++) {
    const t = (i / n2) * Math.PI * 2 + Math.PI / 2 + Math.PI / n2;
    if (Math.sin(t) < -0.8) continue;
    add(new THREE.Vector3(Math.cos(t) * 0.8, Math.sin(t) * 0.8, -0.7), 0.36, 0.6);
  }
  for (const [x, y] of [[0, 0.4], [0.35, 0], [-0.35, 0], [0, -0.3]]) add(new THREE.Vector3(x, y, -1), 0.28, 0.55);
  return out;
}
const MANE = maneQuills();
const BACK_QUILLS: Quill[] = [
  [0, 1, -0.2], [0.55, 0.8, -0.35], [-0.55, 0.8, -0.35], [0.3, 0.7, -0.75], [-0.3, 0.7, -0.75], [0, 0.55, -1],
].map(([x, y, z]) => {
  const d = new THREE.Vector3(x, y, z).normalize();
  return { pos: new THREE.Vector3(d.x * 0.42, 0.55 + d.y * 0.36, -0.15 + d.z * 0.5), quat: new THREE.Quaternion().setFromUnitVectors(UP, d), r: 0.2, len: 0.42 };
});

export function ChogModel({ look, cue, ascension = 0, scale = 1, gear = null }: { look: Appearance; cue?: AnimCue; ascension?: number; scale?: number; gear?: Gear }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const mane = useRef<THREE.Group>(null);
  const rc = useContext(RenderContext);
  const anim = useRef<{ kind: AnimKind; t0: number; id: number }>({ kind: 'idle', t0: 0, id: -1 });
  const blink = useRef({ next: 2 + Math.random() * 3 });

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (cue && cue.id !== anim.current.id) anim.current = { kind: cue.kind, t0: t, id: cue.id };
    const a = anim.current;
    const dt = t - a.t0;
    const g = root.current, b = body.current, h = head.current;
    if (!g || !b || !h) return;
    const calm = rc.reducedMotion ? 0.25 : 1;

    let y = Math.sin(t * 2.2) * 0.02 * calm;
    let sx = 1 + Math.sin(t * 2.2 + 1) * 0.015 * calm;
    let sy = 1 / sx;
    let rotY = look.facing * 0.38 + Math.sin(t * 0.6) * 0.07 * calm;
    let z = 0, x = 0, rotZ = 0, rotX = 0, spin = 0;
    let headTilt = Math.sin(t * 1.1) * 0.05 * calm;

    switch (a.kind) {
      case 'tap': {
        const k = Math.max(0, 1 - dt / 0.24);
        const s = Math.sin(dt * 38) * k;
        sy *= 1 - 0.16 * k + 0.06 * s;
        sx *= 1 + 0.11 * k;
        break;
      }
      case 'charge': {
        const k = Math.max(0, 1 - dt / 0.9);
        sy *= 1 - 0.12 * k;
        x = Math.sin(dt * 70) * 0.03 * k * calm;
        rotX = 0.12 * k;
        break;
      }
      case 'attack': {
        const k = dt < 0.16 ? dt / 0.16 : Math.max(0, 1 - (dt - 0.16) / 0.38);
        z = 0.7 * k;
        rotY *= 1 - k;
        rotX = 0.18 * k;
        break;
      }
      case 'hit': {
        const k = Math.max(0, 1 - dt / 0.5);
        x = Math.sin(dt * 60) * 0.08 * k * calm;
        rotZ = Math.sin(dt * 30) * 0.12 * k * calm;
        z = -0.25 * k;
        break;
      }
      case 'win': {
        if (dt < 0.7) y += Math.sin((dt / 0.7) * Math.PI) * 0.7;
        if (dt < 1.1) spin = (dt / 1.1) * Math.PI * 2;
        else y += Math.abs(Math.sin(dt * 5)) * 0.1 * calm;
        headTilt = Math.sin(t * 6) * 0.08;
        break;
      }
      case 'levelup': {
        const k = Math.min(1, dt / 1.0);
        spin = k * Math.PI * 4;
        const pop = Math.sin(Math.min(1, dt / 0.5) * Math.PI) * 0.18;
        sx *= 1 + pop;
        sy *= 1 + pop;
        y += pop;
        break;
      }
      case 'lose': {
        const k = Math.min(1, dt / 0.6);
        sy *= 1 - 0.1 * k;
        headTilt = 0.28 * k;
        break;
      }
    }
    g.position.set(x, y, z);
    g.rotation.set(rotX, rotY + spin, rotZ);
    b.scale.set(sx, sy, sx);
    h.rotation.x = headTilt;

    if (eyes.current) {
      const eb = blink.current;
      let s = 1;
      if (t > eb.next) {
        const p = (t - eb.next) / 0.14;
        s = p < 1 ? Math.abs(1 - 2 * p) * 0.9 + 0.1 : 1;
        if (p >= 1) eb.next = t + 2 + Math.random() * 3.5;
      }
      eyes.current.scale.y = s;
    }
    if (mane.current) mane.current.rotation.z = Math.sin(t * 2.6) * 0.02 * calm;
  });

  const low = rc.low;
  const furMat = useMemo(() => {
    if (look.metal) return gloss(look.skin, { low, roughness: 0.25, metalness: 0.85 });
    return fur(look.skin, { low, emissive: look.glow ?? undefined, emissiveIntensity: look.glow ? (look.archetype === 'Radioactive' ? 0.3 : 0.1) : 0 });
  }, [look.skin, look.metal, look.glow, look.archetype, low]);
  const quillMat = useMemo(() => {
    if (look.skull) return fur('#efe7d2', { low });
    return look.metal ? furMat : fur(look.skinShade, { low, emissive: look.glow ?? undefined, emissiveIntensity: look.glow ? 0.2 : 0 });
  }, [look.skull, look.metal, look.skinShade, look.glow, furMat, low]);
  const rainbow = ['#ff6b6b', '#ffb347', '#ffe14d', '#5ee3a0', '#4ee6f0', '#7c4dff', '#ff5fd2'];
  const pawMat = gloss(look.paws, { low, roughness: 0.45 });
  const variant = gear && (VARIANT_GEAR as string[]).includes(gear) ? (gear as VariantGear) : null;
  const bodyKind = gear === 'space' ? 'astro' : gear === 'hoodie' ? 'hoodie' : variant ? (GEAR_SUIT[variant] ? 'shirt' : 'none') : look.body.kind;

  return (
    <group scale={scale}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, -0.05]} renderOrder={1}>
        <planeGeometry args={[1.9, 1.9]} />
        <meshBasicMaterial map={blobShadow()} transparent depthWrite={false} />
      </mesh>
      <group ref={root}>
        <group ref={body}>
          {/* body + legs */}
          <mesh position={[0, 0.54, -0.12]} scale={[0.5, 0.43, 0.62]} material={furMat}>
            <sphereGeometry args={[1, 32, 24]} />
          </mesh>
          <Outfit look={look} kind={bodyKind} gear={gear} />
          {variant && <GearBody gear={variant} />}
          {BACK_QUILLS.map((q, i) => (
            <mesh key={i} position={q.pos} quaternion={q.quat} scale={[1, 1, 0.72]} material={quillMat}>
              <coneGeometry args={[q.r, q.len, 10]} />
            </mesh>
          ))}
          {([[0.27, 0.22], [-0.27, 0.22], [0.27, -0.44], [-0.27, -0.44]] as const).map(([lx, lz], i) => (
            <group key={i} position={[lx, 0, lz]}>
              <mesh position={[0, 0.24, 0]} material={gear === 'space' ? gloss('#f1eef8', { low, roughness: 0.4 }) : furMat}>
                <capsuleGeometry args={[0.15, 0.2, 6, 14]} />
              </mesh>
              <mesh position={[0, 0.08, 0.04]} scale={[1, 0.58, 1.18]} material={pawMat}>
                <sphereGeometry args={[0.18, 20, 14]} />
              </mesh>
              {i < 2 && [-0.07, 0, 0.07].map((tx) => (
                <mesh key={tx} position={[tx, 0.1, 0.22]} material={gloss('#ff8cc0', { low, roughness: 0.4 })}>
                  <sphereGeometry args={[0.045, 10, 8]} />
                </mesh>
              ))}
            </group>
          ))}
          <mesh position={[0, 0.62, -0.74]} material={furMat}>
            <sphereGeometry args={[0.1, 12, 10]} />
          </mesh>
          <Accessory look={look} />

          {/* head */}
          <group ref={head} position={[0, 1.13, 0.2]} scale={0.8}>
            <mesh scale={[1.05, 0.96, 0.95]} material={furMat}>
              <sphereGeometry args={[0.76, 36, 28]} />
            </mesh>
            <group ref={mane}>
              {MANE.map((q, i) => (
                <mesh key={i} position={q.pos} quaternion={q.quat} scale={[1, 1, 0.68]} material={look.multi ? fur(rainbow[i % rainbow.length], { low }) : quillMat}>
                  <coneGeometry args={[q.r, q.len, 12]} />
                </mesh>
              ))}
            </group>
            <Face look={look} eyesRef={eyes} />
            {variant ? <GearHead gear={variant} /> : gear === 'runner' ? <Goggles /> : gear === 'hoodie' ? <Hood /> : gear === 'space' ? <SpaceHelmet /> : <Headwear look={look} />}
          </group>
        </group>

        {Array.from({ length: ascension }, (_, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02 + i * 0.01, -0.05]} material={glowMat(i % 2 ? '#ff8fc8' : '#b9a6ff', 0.45)}>
            <ringGeometry args={[0.82 + i * 0.14, 0.86 + i * 0.14, 64]} />
          </mesh>
        ))}
        <Aura look={look} />
      </group>
    </group>
  );
}

function Outfit({ look, kind, gear }: { look: Appearance; kind: Appearance['body']['kind']; gear: Gear }) {
  const { low } = useContext(RenderContext);
  if (kind === 'none') return null;
  let { color, color2, text } = look.body;
  if (gear === 'space') { color = '#f1eef8'; color2 = '#63f0ff'; text = null; }
  if (gear === 'hoodie') { color = '#6a2fd0'; color2 = '#ff5fa2'; text = null; }
  if (gear && gear in GEAR_SUIT) { color = GEAR_SUIT[gear as VariantGear] ?? color; text = null; }
  const mat = kind === 'armor' ? gloss(color, { low, metalness: 0.8, roughness: 0.3 }) : kind === 'astro' ? gloss(color, { low, roughness: 0.35 }) : fur(color, { low });
  const stripes = kind === 'stripes';
  return (
    <group>
      <mesh position={[0, 0.55, -0.12]} scale={[0.53, 0.46, 0.65]} material={mat}>
        <sphereGeometry args={[1, 32, 24, 0, Math.PI * 2, 0, 2.2]} />
      </mesh>
      {stripes && [0.38, 0.56, 0.74].map((y) => (
        <mesh key={y} position={[0, y, -0.12]} scale={[0.545, 0.06, 0.665]} material={fur(color2, { low })}>
          <sphereGeometry args={[1, 28, 6]} />
        </mesh>
      ))}
      {(kind === 'suit' || kind === 'vest' || kind === 'robe') && (
        <mesh position={[0, 0.78, 0.12]} rotation={[Math.PI / 2 - 0.25, 0, 0]} material={fur(kind === 'robe' ? color2 : '#ffffff', { low })}>
          <torusGeometry args={[0.3, 0.07, 10, 28]} />
        </mesh>
      )}
      {kind === 'suit' && (
        <mesh position={[0, 0.66, 0.42]} rotation={[0.3, 0, Math.PI / 4]} material={fur('#b3122e', { low })}>
          <boxGeometry args={[0.12, 0.12, 0.05]} />
        </mesh>
      )}
      {text && (
        <mesh position={[0, 0.88, -0.36]} rotation={[-1.1, 0, 0]} material={new THREE.MeshBasicMaterial({ map: labelTexture(text, '#ffffff'), transparent: true, depthWrite: false })}>
          <planeGeometry args={[0.46, 0.23]} />
        </mesh>
      )}
      {kind === 'armor' && [-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.36, 0.62, 0.25]} material={mat}><sphereGeometry args={[0.17, 16, 12]} /></mesh>
      ))}
      {kind === 'astro' && (
        <>
          <mesh position={[0, 0.66, -0.66]} material={gloss('#d9d4e6', { low, roughness: 0.35 })}><boxGeometry args={[0.46, 0.34, 0.2]} /></mesh>
          {[-0.14, 0.14].map((x) => (
            <mesh key={x} position={[x, 0.66, -0.78]} rotation={[Math.PI / 2, 0, 0]} material={glowMat('#63f0ff', 0.95)}><cylinderGeometry args={[0.08, 0.08, 0.04, 20]} /></mesh>
          ))}
          <mesh position={[0, 0.6, 0.5]} material={glowMat('#63f0ff', 0.9)}><boxGeometry args={[0.14, 0.08, 0.03]} /></mesh>
        </>
      )}
      {kind === 'hoodie' && gear === 'hoodie' && (
        <>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.42, 0.78, -0.32]} rotation={[0, s * 0.6, s * -0.5]} scale={[0.28, 0.14, 0.05]} material={fur('#ffffff', { low })}>
              <sphereGeometry args={[1, 16, 10]} />
            </mesh>
          ))}
          <Heart position={[0, 0.62, 0.5]} scale={0.6} color={PINK} />
        </>
      )}
      {kind === 'costume' && /#ffd34d/i.test(color) && (
        <mesh position={[0, 0.42, -0.1]} rotation={[Math.PI / 2, 0, 0]} material={gloss('#ffd34d', { low, roughness: 0.4 })}>
          <torusGeometry args={[0.55, 0.13, 12, 28]} />
        </mesh>
      )}
      {kind === 'costume' && /#8fb6d9/i.test(color) && (
        <mesh position={[0, 1.0, -0.38]} rotation={[-0.4, 0, 0]} scale={[0.4, 1, 1]} material={fur(color, { low })}><coneGeometry args={[0.2, 0.42, 12]} /></mesh>
      )}
    </group>
  );
}

function Heart({ position, scale = 1, color }: { position: [number, number, number]; scale?: number; color: string }) {
  const { low } = useContext(RenderContext);
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.1);
    s.bezierCurveTo(-0.18, 0.02, -0.1, 0.16, 0, 0.07);
    s.bezierCurveTo(0.1, 0.16, 0.18, 0.02, 0, -0.1);
    return new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 });
  }, []);
  return <mesh geometry={geo} position={position} scale={scale} material={gloss(color, { low, roughness: 0.2 })} />;
}

function Eye({ x, look }: { x: number; look: Appearance }) {
  const { low } = useContext(RenderContext);
  const { kind, color } = look.eyes;
  const z = fz(x, 0.02, -0.01);
  const ink = basic('#1e1030');
  switch (kind) {
    case 'happy':
      return <mesh position={[x, 0.05, z + 0.01]} material={ink}><torusGeometry args={[0.08, 0.022, 8, 18, Math.PI]} /></mesh>;
    case 'closed':
      return <mesh position={[x, 0.03, z + 0.01]} material={ink}><boxGeometry args={[0.17, 0.03, 0.02]} /></mesh>;
    case 'dead':
      return (
        <group position={[x, 0.03, z + 0.01]}>
          {[1, -1].map((s) => <mesh key={s} rotation={[0, 0, s * 0.785]} material={ink}><boxGeometry args={[0.17, 0.035, 0.02]} /></mesh>)}
        </group>
      );
    case 'heart':
      return <Heart position={[x, 0.03, z - 0.01]} scale={0.75} color={color} />;
    case 'frog':
      return (
        <group position={[x * 1.05, 0.1, z - 0.03]}>
          <mesh material={gloss('#ffffff', { low })}><sphereGeometry args={[0.13, 18, 14]} /></mesh>
          <mesh position={[0, 0, 0.1]} material={gloss(EYE, { low, roughness: 0.05 })}><sphereGeometry args={[0.06, 12, 10]} /></mesh>
        </group>
      );
    default: {
      const offX = kind === 'side' ? 0.035 * Math.sign(look.facing) : 0;
      const offY = kind === 'up' ? 0.04 : 0;
      const irisColor = color !== '#1b1424' ? color : '#4a2470';
      return (
        <group position={[x, 0.02, z]}>
          <mesh scale={[0.9, kind === 'tired' ? 0.72 : 1.12, 0.45]} material={gloss(look.skull ? '#2a1d33' : EYE, { low, roughness: 0.06 })}>
            <sphereGeometry args={[0.125, 22, 18]} />
          </mesh>
          <mesh position={[offX, offY - 0.02, 0.045]} scale={[1, 1, 0.3]} material={gloss(irisColor, { low, roughness: 0.1 })}>
            <sphereGeometry args={[0.07, 16, 12]} />
          </mesh>
          <mesh position={[0.035 + offX, 0.05 + offY, 0.055]} material={basic('#ffffff')}><sphereGeometry args={[0.035, 10, 8]} /></mesh>
          <mesh position={[-0.03 + offX, -0.045 + offY, 0.05]} material={basic('#ffffff')}><sphereGeometry args={[0.016, 8, 6]} /></mesh>
          {kind === 'tired' && <mesh position={[0, 0.075, 0.01]} scale={[1, 0.5, 0.6]} material={fur(look.face, { low })}><sphereGeometry args={[0.13, 14, 10]} /></mesh>}
          {kind === 'angry' && <mesh position={[0, 0.17, 0.02]} rotation={[0, 0, -Math.sign(x) * 0.42]} material={ink}><boxGeometry args={[0.17, 0.032, 0.02]} /></mesh>}
        </group>
      );
    }
  }
}

function Face({ look, eyesRef }: { look: Appearance; eyesRef: React.RefObject<THREE.Group | null> }) {
  const { low } = useContext(RenderContext);
  const tears = useRef<THREE.Group>(null);
  const gum = useRef<THREE.Mesh>(null);
  const puke = useRef<THREE.Group>(null);
  const laser = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (tears.current) tears.current.children.forEach((c, i) => { c.position.y = -((t * 0.5 + i * 0.5) % 1) * 0.35; });
    if (gum.current) gum.current.scale.setScalar(0.6 + ((Math.sin(t * 1.4) + 1) / 2) * 0.9);
    if (puke.current) puke.current.children.forEach((c, i) => { c.position.y = -0.05 - ((t * 1.2 + i * 0.14) % 1) * 0.5; });
    if (laser.current) laser.current.scale.set(1, 1, 0.8 + Math.sin(t * 12) * 0.2);
  });
  const { eyes, mouth } = look;
  const faceMat = fur(look.face, { low, sheen: '#ffffff' });
  return (
    <group>
      <mesh position={[0, FACE.y, FACE.z]} scale={[1, FACE.ry / FACE.rx, FACE.rz / FACE.rx]} material={faceMat}>
        <sphereGeometry args={[FACE.rx, 32, 24]} />
      </mesh>
      {/* forehead fur tuft */}
      {[-0.12, 0, 0.12].map((tx, i) => (
        <mesh key={tx} position={[tx, 0.42, fz(tx, 0.42, -0.06)]} rotation={[0.5, 0, -tx * 2]} material={faceMat}>
          <coneGeometry args={[0.07, i === 1 ? 0.24 : 0.17, 8]} />
        </mesh>
      ))}
      {look.skull && <mesh position={[0, -0.12, fz(0, -0.12)]} rotation={[0, 0, Math.PI]} material={basic('#2a1d33')}><circleGeometry args={[0.05, 3]} /></mesh>}

      <group ref={eyesRef}>
        {eyes.kind === 'visor' ? (
          <group position={[0, 0.04, fz(0, 0.04, 0.02)]}>
            {[-0.2, 0.2].map((x) => (
              <mesh key={x} position={[x, 0, -0.02]} rotation={[0, x * 0.9, 0]} material={gloss(eyes.color, { low, emissive: eyes.color, emissiveIntensity: 0.35, roughness: 0.05 })}>
                <boxGeometry args={[0.28, 0.17, 0.06]} />
              </mesh>
            ))}
            <mesh material={gloss('#8c8f9c', { low, metalness: 0.7, roughness: 0.3 })}><boxGeometry args={[0.16, 0.05, 0.05]} /></mesh>
          </group>
        ) : eyes.kind === 'vr' ? (
          <mesh position={[0, 0.04, fz(0, 0.04, 0.02)]} material={gloss(eyes.color, { low, roughness: 0.3 })}><boxGeometry args={[0.66, 0.24, 0.16]} /></mesh>
        ) : (
          <>
            <Eye x={-0.21} look={look} />
            <Eye x={0.21} look={look} />
          </>
        )}
        {eyes.kind === 'shades' && (
          <group position={[0, 0.03, fz(0.21, 0.03, 0.06)]}>
            {[-0.21, 0.21].map((x) => <mesh key={x} position={[x, 0, 0]} material={gloss(eyes.color, { low, roughness: 0.1 })}><boxGeometry args={[0.26, 0.16, 0.035]} /></mesh>)}
            <mesh material={basic('#1e1030')}><boxGeometry args={[0.16, 0.03, 0.03]} /></mesh>
          </group>
        )}
      </group>
      {eyes.kind === 'laser' && (
        <group ref={laser}>
          {[-0.21, 0.21].map((x) => (
            <group key={x} position={[x, 0.02, fz(x, 0.02, 0.03)]}>
              <mesh material={glowMat(eyes.color, 0.95)}><sphereGeometry args={[0.075, 12, 10]} /></mesh>
              <mesh position={[0, 0, 0.9]} rotation={[Math.PI / 2, 0, 0]} material={glowMat(eyes.color, 0.5)}><cylinderGeometry args={[0.03, 0.05, 1.8, 10, 1, true]} /></mesh>
            </group>
          ))}
        </group>
      )}
      {eyes.kind === 'cry' && (
        <group ref={tears} position={[0, -0.04, fz(0.25, -0.04, 0.02)]}>
          {[-0.25, 0.25, -0.25, 0.25].map((x, i) => <mesh key={i} position={[x, 0, 0]} material={gloss('#7fd7ff', { low, roughness: 0.05 })}><sphereGeometry args={[0.035, 10, 8]} /></mesh>)}
        </group>
      )}

      {!look.skull && [-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.36, -0.13, fz(0.36, -0.13, 0.008)]} rotation={[0, s * 0.68, s * -0.25]} scale={[1.55, 0.72, 1]} material={basic(PINK)}>
          <circleGeometry args={[0.09, 24]} />
        </mesh>
      ))}
      {!look.skull && (
        <mesh position={[0, -0.08, fz(0, -0.08, 0.0)]} scale={[1.4, 0.95, 0.8]} material={gloss('#ff6fae', { low, roughness: 0.3 })}>
          <sphereGeometry args={[0.058, 14, 12]} />
        </mesh>
      )}

      <group position={[0, -0.21, fz(0, -0.21, 0.0)]}>
        {(mouth.kind === 'smile' || mouth.kind === 'bite' || mouth.kind === 'gum' || mouth.kind === 'drool' || mouth.kind === 'grin') && (
          [-0.045, 0.045].map((mx) => <mesh key={mx} position={[mx, 0.01, 0]} rotation={[0, 0, Math.PI]} material={basic('#5a1830')}><torusGeometry args={[0.045, 0.012, 6, 14, Math.PI]} /></mesh>)
        )}
        {mouth.kind === 'clown' && <mesh rotation={[0, 0, Math.PI]} material={basic(mouth.color)}><torusGeometry args={[0.11, 0.03, 6, 18, Math.PI]} /></mesh>}
        {mouth.kind === 'sad' && <mesh position={[0, -0.05, 0]} material={basic('#5a1830')}><torusGeometry args={[0.06, 0.014, 6, 16, Math.PI]} /></mesh>}
        {mouth.kind === 'flat' && <mesh material={basic('#5a1830')}><boxGeometry args={[0.12, 0.022, 0.02]} /></mesh>}
        {mouth.kind === 'o' && <mesh scale={[1, 1.2, 0.5]} material={gloss('#7a2240', { low })}><sphereGeometry args={[0.04, 12, 10]} /></mesh>}
        {mouth.kind === 'grit' && <mesh material={basic('#ffffff')}><boxGeometry args={[0.15, 0.05, 0.02]} /></mesh>}
        {mouth.kind === 'grin' && <mesh position={[0.03, -0.06, 0.01]} material={gloss('#f5c542', { low, metalness: 0.6, roughness: 0.2 })}><boxGeometry args={[0.04, 0.04, 0.02]} /></mesh>}
        {mouth.kind === 'bite' && <mesh position={[0, -0.05, 0.01]} material={basic('#ffffff')}><boxGeometry args={[0.035, 0.03, 0.02]} /></mesh>}
        {mouth.kind === 'gum' && <mesh ref={gum} position={[0.05, -0.08, 0.1]} material={gloss('#ff8fc8', { low, roughness: 0.15, opacity: 0.92 })}><sphereGeometry args={[0.12, 18, 14]} /></mesh>}
        {mouth.kind === 'drool' && <mesh position={[0.06, -0.1, 0.01]} scale={[0.7, 1.4, 0.7]} material={gloss('#9fe8ff', { low, roughness: 0.05, opacity: 0.85 })}><sphereGeometry args={[0.035, 10, 8]} /></mesh>}
        {mouth.kind === 'coin' && (
          <mesh position={[0, -0.05, 0.05]} rotation={[Math.PI / 2, 0, 0]} material={gloss(mouth.color, { low, metalness: 0.7, roughness: 0.25 })}><cylinderGeometry args={[0.1, 0.1, 0.03, 24]} /></mesh>
        )}
        {mouth.kind === 'puke' && (
          <>
            <mesh scale={[1, 1.2, 0.5]} material={gloss('#7a2240', { low })}><sphereGeometry args={[0.045, 12, 10]} /></mesh>
            <group ref={puke}>
              {['#ff6b6b', '#ffb347', '#ffe14d', '#5ee3a0', '#4ee6f0', '#7c4dff', '#ff5fd2'].map((c, i) => (
                <mesh key={c} position={[0, 0, 0.08 + i * 0.01]} material={gloss(c, { low })}><boxGeometry args={[0.1, 0.07, 0.05]} /></mesh>
              ))}
            </group>
          </>
        )}
      </group>
    </group>
  );
}

function Goggles() {
  const { low } = useContext(RenderContext);
  return (
    <group position={[0, 0.36, 0.05]} rotation={[-0.35, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={fur('#d8344f', { low })}><torusGeometry args={[0.78, 0.06, 10, 40]} /></mesh>
      {[-0.22, 0.22].map((x) => (
        <group key={x} position={[x, 0.02, 0.74]} rotation={[0, x * 0.8, 0]}>
          <mesh material={gloss('#9a9caa', { low, metalness: 0.75, roughness: 0.3 })}><boxGeometry args={[0.32, 0.22, 0.1]} /></mesh>
          <mesh position={[0, 0, 0.055]} material={gloss('#ff9a3c', { low, emissive: '#ff7a1a', emissiveIntensity: 0.35, roughness: 0.05 })}><boxGeometry args={[0.26, 0.16, 0.02]} /></mesh>
        </group>
      ))}
    </group>
  );
}

function Hood() {
  const { low } = useContext(RenderContext);
  return (
    <group>
      {/* phi 0 points down -x; a quarter turn puts the opening over the face */}
      <mesh rotation={[0, Math.PI / 2, 0]} scale={[1.08, 1.04, 1.02]} material={fur('#6a2fd0', { low })}>
        <sphereGeometry args={[0.84, 32, 24, Math.PI * 0.36, Math.PI * 1.28]} />
      </mesh>
      <group position={[0.42, 0.6, 0.25]} rotation={[0, 0, -0.35]} scale={0.9}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.11, 0, 0]} rotation={[0, 0, s * Math.PI / 2]} scale={[1, 1, 0.55]} material={gloss(PINK, { low, roughness: 0.35 })}><coneGeometry args={[0.11, 0.2, 14]} /></mesh>
        ))}
        <mesh material={gloss(PINK, { low, roughness: 0.35 })}><sphereGeometry args={[0.06, 12, 10]} /></mesh>
      </group>
    </group>
  );
}

function SpaceHelmet() {
  const { low } = useContext(RenderContext);
  const glass = useMemo(
    () => (low ? new THREE.MeshLambertMaterial({ color: '#cfefff', transparent: true, opacity: 0.18, depthWrite: false }) : new THREE.MeshPhysicalMaterial({ color: '#dff6ff', roughness: 0.02, metalness: 0, transparent: true, opacity: 0.22, clearcoat: 1, depthWrite: false })),
    [low],
  );
  return (
    <group>
      <mesh scale={1.22} material={glass} renderOrder={2}><sphereGeometry args={[0.9, 36, 28]} /></mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.98, 0.0, 0.05]} rotation={[0, 0, s * Math.PI / 2]}>
          <mesh material={gloss('#ecebf3', { low, roughness: 0.3 })}><cylinderGeometry args={[0.24, 0.24, 0.16, 28]} /></mesh>
          <mesh position={[0, s * 0.085, 0]} rotation={[s > 0 ? 0 : Math.PI, 0, 0]} material={new THREE.MeshBasicMaterial({ map: labelTexture('★', '#63f0ff', '#2a2340', 128, 128), transparent: true })}>
            <circleGeometry args={[0.17, 24]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, -0.75, 0]} rotation={[Math.PI / 2, 0, 0]} material={gloss('#ecebf3', { low, roughness: 0.3 })}><torusGeometry args={[0.72, 0.08, 12, 40]} /></mesh>
    </group>
  );
}

function Headwear({ look }: { look: Appearance }) {
  const { low } = useContext(RenderContext);
  const { kind, color, color2, text } = look.head;
  const halo = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (halo.current) { halo.current.rotation.y = clock.elapsedTime * 0.8; halo.current.position.y = 1.15 + Math.sin(clock.elapsedTime * 2) * 0.03; }
  });
  const m = (c: string) => fur(c, { low });
  switch (kind) {
    case 'cap':
      return (
        <group position={[0, 0.5, 0.06]} rotation={[-0.16, 0, 0]}>
          <mesh scale={[1, 0.72, 1]} material={m(color)}><sphereGeometry args={[0.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
          <mesh position={[0, 0, 0.52]} rotation={[0.16, 0, 0]} scale={[1, 1, 1.3]} material={m(color2 === '#ffffff' ? color : color2)}>
            <cylinderGeometry args={[0.38, 0.4, 0.04, 28, 1, false, -Math.PI / 2, Math.PI]} />
          </mesh>
          {text && (
            <mesh position={[0, 0.16, 0.53]} rotation={[-0.32, 0, 0]} material={new THREE.MeshBasicMaterial({ map: labelTexture(text, '#ffffff'), transparent: true, depthWrite: false })}>
              <planeGeometry args={[0.46, 0.23]} />
            </mesh>
          )}
        </group>
      );
    case 'bucket':
      return (
        <group position={[0, 0.58, 0]} rotation={[-0.1, 0, 0]}>
          <mesh material={m(color)}><cylinderGeometry args={[0.4, 0.54, 0.38, 28]} /></mesh>
          <mesh position={[0, -0.19, 0]} material={m(color2)}><cylinderGeometry args={[0.82, 0.82, 0.04, 32]} /></mesh>
          {text && <mesh position={[0, 0.02, 0.49]} rotation={[-0.3, 0, 0]} material={new THREE.MeshBasicMaterial({ map: labelTexture(text, '#ffffff'), transparent: true, depthWrite: false })}><planeGeometry args={[0.42, 0.21]} /></mesh>}
        </group>
      );
    case 'beanie':
      return (
        <group position={[0, 0.46, 0]}>
          <mesh scale={[1, 0.92, 1]} material={m(color)}><sphereGeometry args={[0.6, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
          <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} material={m(color2 === '#ffffff' ? '#f4f1ea' : color2)}><torusGeometry args={[0.6, 0.08, 10, 32]} /></mesh>
          <mesh position={[0, 0.6, 0]} material={m('#f4f1ea')}><sphereGeometry args={[0.13, 14, 12]} /></mesh>
        </group>
      );
    case 'crown':
      return (
        <group position={[0, 0.82, 0]}>
          <mesh material={gloss(color, { low, metalness: 0.8, roughness: 0.25 })}><cylinderGeometry args={[0.34, 0.3, 0.2, 24, 1, true]} /></mesh>
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <group key={i}>
                <mesh position={[Math.sin(a) * 0.32, 0.18, Math.cos(a) * 0.32]} material={gloss(color, { low, metalness: 0.8, roughness: 0.25 })}><coneGeometry args={[0.065, 0.18, 8]} /></mesh>
                <mesh position={[Math.sin(a) * 0.34, 0, Math.cos(a) * 0.34]} material={gloss(color2, { low, emissive: color2, emissiveIntensity: 0.4, roughness: 0.1 })}><sphereGeometry args={[0.042, 10, 8]} /></mesh>
              </group>
            );
          })}
        </group>
      );
    case 'wizard':
      return (
        <group position={[0, 0.66, 0]} rotation={[-0.15, 0, 0.14]}>
          <mesh position={[0, -0.05, 0]} material={m(color)}><cylinderGeometry args={[0.78, 0.78, 0.04, 32]} /></mesh>
          <mesh position={[0, 0.5, -0.05]} rotation={[-0.2, 0, 0]} material={m(color)}><coneGeometry args={[0.46, 1.05, 28]} /></mesh>
          <mesh position={[0.12, 0.45, 0.3]} material={glowMat(color2, 0.95)}><octahedronGeometry args={[0.07]} /></mesh>
        </group>
      );
    case 'helmet':
      return (
        <group position={[0, 0.26, 0]}>
          <mesh scale={[1.06, 1.02, 1.06]} material={gloss(color, { low, metalness: 0.7, roughness: 0.3 })}><sphereGeometry args={[0.74, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.2]} /></mesh>
          <mesh position={[0, 0.78, -0.05]} material={m(color2)}><boxGeometry args={[0.12, 0.36, 0.86]} /></mesh>
        </group>
      );
    case 'horns':
      return (
        <group position={[0, 0.58, 0.12]}>
          {[-1, 1].map((s) => <mesh key={s} position={[s * 0.36, 0.18, 0]} rotation={[0, 0, -s * 0.45]} material={gloss(color, { low, roughness: 0.35 })}><coneGeometry args={[0.1, 0.42, 14]} /></mesh>)}
        </group>
      );
    case 'halo':
      return <group ref={halo} position={[0, 1.15, 0]}><mesh rotation={[Math.PI / 2, 0, 0]} material={glowMat(color, 0.9)}><torusGeometry args={[0.36, 0.04, 10, 40]} /></mesh></group>;
    case 'gem':
      return <group ref={halo} position={[0, 1.15, 0]}><mesh material={gloss(color, { low, emissive: color, emissiveIntensity: 0.6, roughness: 0.05 })}><octahedronGeometry args={[0.17]} /></mesh></group>;
    case 'headband':
      return (
        <group position={[0, 0.26, 0]} rotation={[-0.15, 0, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={m(color)}><torusGeometry args={[0.74, 0.065, 10, 36]} /></mesh>
          {color === '#ffffff' && <mesh position={[0, 0, 0.8]} material={basic('#e8414b')}><circleGeometry args={[0.07, 18]} /></mesh>}
        </group>
      );
    case 'durag':
      return <mesh position={[0, 0.24, -0.02]} scale={[1.04, 1, 1.04]} material={m(color)}><sphereGeometry args={[0.74, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2.2]} /></mesh>;
    case 'hair': {
      const rain = text === 'rainbow';
      const cols = rain ? ['#ff6b6b', '#ffb347', '#ffe14d', '#5ee3a0', '#4ee6f0', '#7c4dff', '#ff5fd2'] : [color, color2];
      return (
        <group position={[0, 0.35, -0.05]}>
          {Array.from({ length: rain ? 9 : 5 }, (_, i) => {
            const a = (i / (rain ? 8 : 4)) * Math.PI - Math.PI / 2;
            return <mesh key={i} position={[Math.sin(a) * 0.5, 0.3 + Math.cos(a) * 0.12, Math.cos(a) * 0.1 - 0.1]} material={m(cols[i % cols.length])}><sphereGeometry args={[0.3, 16, 12]} /></mesh>;
          })}
        </group>
      );
    }
    case 'ushanka':
      return (
        <group position={[0, 0.6, 0]}>
          <mesh material={m(color)}><cylinderGeometry args={[0.56, 0.62, 0.38, 28]} /></mesh>
          <mesh position={[0, -0.12, 0.4]} material={m(color2)}><boxGeometry args={[0.92, 0.2, 0.2]} /></mesh>
          {[-1, 1].map((s) => <mesh key={s} position={[s * 0.64, -0.38, 0]} material={m(color2)}><boxGeometry args={[0.14, 0.48, 0.4]} /></mesh>)}
        </group>
      );
    case 'clownNose':
      return <mesh position={[0, -0.08, fz(0, -0.08, 0.04)]} material={gloss(color, { low, roughness: 0.2 })}><sphereGeometry args={[0.1, 16, 12]} /></mesh>;
    case 'mask':
      return <mesh position={[0, 0.03, fz(0, 0.03, -0.03)]} material={fur(color, { low })}><torusGeometry args={[0.21, 0.06, 8, 28, Math.PI]} /></mesh>;
    case 'thirdEye':
      return <mesh position={[0, 0.32, fz(0, 0.32, 0.02)]} scale={[1, 1.4, 0.5]} material={gloss(color, { low, emissive: color, emissiveIntensity: 0.6 })}><sphereGeometry args={[0.07, 14, 12]} /></mesh>;
    case 'shroom':
      return (
        <group position={[0, 0.72, 0]}>
          <mesh material={m('#f4f1ea')}><cylinderGeometry args={[0.14, 0.18, 0.3, 14]} /></mesh>
          <mesh position={[0, 0.2, 0]} scale={[1, 0.6, 1]} material={m(color)}><sphereGeometry args={[0.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
          {[0, 2, 4].map((i) => <mesh key={i} position={[Math.sin(i) * 0.3, 0.38, Math.cos(i) * 0.3]} material={basic(color2)}><sphereGeometry args={[0.06, 8, 6]} /></mesh>)}
        </group>
      );
    case 'fedora':
      return (
        <group position={[0, 0.66, 0]}>
          <mesh material={m(color)}><cylinderGeometry args={[0.42, 0.5, 0.36, 28]} /></mesh>
          <mesh position={[0, -0.16, 0]} material={m(color)}><cylinderGeometry args={[0.85, 0.85, 0.04, 32]} /></mesh>
          <mesh position={[0, -0.08, 0]} material={m(color2)}><cylinderGeometry args={[0.505, 0.505, 0.1, 28, 1, true]} /></mesh>
        </group>
      );
    default:
      return null;
  }
}

function Accessory({ look }: { look: Appearance }) {
  const { low } = useContext(RenderContext);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.position.y = 1.15 + Math.sin(t * 2) * 0.06;
    ref.current.rotation.y = t * 0.9;
  });
  const a = look.accessory;
  if (!a) return null;
  if (a === 'frog') {
    return (
      <group position={[0.2, 0.98, -0.32]}>
        <mesh scale={[1, 0.8, 1]} material={fur('#5ec46b', { low })}><sphereGeometry args={[0.18, 18, 14]} /></mesh>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.08, 0.13, 0.08]}>
            <mesh material={gloss('#ffffff', { low })}><sphereGeometry args={[0.055, 10, 8]} /></mesh>
            <mesh position={[0, 0, 0.045]} material={basic('#1e1030')}><sphereGeometry args={[0.026, 8, 6]} /></mesh>
          </group>
        ))}
      </group>
    );
  }
  if (a === 'cigar') {
    return (
      <group position={[0.12, 0.96, fz(0.15, -0.24) * 0.8 + 0.22]} rotation={[0, 0.4, -0.15]}>
        <mesh rotation={[0, 0, Math.PI / 2]} material={fur('#7a4a2a', { low })}><cylinderGeometry args={[0.025, 0.025, 0.2, 8]} /></mesh>
        <mesh position={[0.11, 0, 0]} material={glowMat('#ff7a3d', 0.95)}><sphereGeometry args={[0.028, 8, 6]} /></mesh>
      </group>
    );
  }
  return (
    <group ref={ref} position={[-0.95, 1.15, 0.1]}>
      {a === 'coin' && <mesh rotation={[Math.PI / 2, 0, 0]} material={gloss('#f5c542', { low, metalness: 0.75, roughness: 0.25 })}><cylinderGeometry args={[0.16, 0.16, 0.04, 28]} /></mesh>}
      {a === 'heart' && <Heart position={[0, 0, 0]} scale={1.2} color="#ff3b7a" />}
      {a === 'knife' && (
        <group rotation={[0, 0, 0.6]}>
          <mesh material={fur('#3a2a22', { low })}><boxGeometry args={[0.06, 0.16, 0.06]} /></mesh>
          <mesh position={[0, 0.17, 0]} material={gloss('#dfe6ee', { low, metalness: 0.9, roughness: 0.2 })}><boxGeometry args={[0.07, 0.2, 0.015]} /></mesh>
        </group>
      )}
      {(a === 'candleUp' || a === 'candleDown') && (
        <group>
          <mesh material={gloss(a === 'candleUp' ? '#3fcf8e' : '#ff4b6b', { low, emissive: a === 'candleUp' ? '#3fcf8e' : '#ff4b6b', emissiveIntensity: 0.3 })}><boxGeometry args={[0.14, 0.4, 0.14]} /></mesh>
          <mesh material={basic('#1e1030')}><boxGeometry args={[0.025, 0.65, 0.025]} /></mesh>
        </group>
      )}
      {a === 'box' && (
        <group>
          <mesh material={gloss('#ff5fa2', { low, roughness: 0.4 })}><boxGeometry args={[0.26, 0.22, 0.26]} /></mesh>
          <mesh material={gloss('#ffd166', { low, roughness: 0.4 })}><boxGeometry args={[0.27, 0.06, 0.27]} /></mesh>
        </group>
      )}
    </group>
  );
}

function Aura({ look }: { look: Appearance }) {
  const rc = useContext(RenderContext);
  const shell = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (shell.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 2.5) * 0.04;
      shell.current.scale.set(s, s, s);
    }
  });
  const color = look.aura?.color ?? look.glow;
  if (!color) return null;
  const speed = look.aura?.kind === 'flame' ? 1.4 : look.aura?.kind === 'electric' ? 2.5 : 0.5;
  return (
    <group position={[0, 1.0, 0]}>
      <mesh ref={shell} material={glowMat(color, 0.06)}><sphereGeometry args={[1.15, 28, 18]} /></mesh>
      {rc.particles && <Sparkles count={look.aura?.kind === 'flame' ? 34 : 22} scale={[2.6, 2.6, 2.6]} size={look.aura?.kind === 'smoke' ? 9 : 4.5} speed={speed} color={color} opacity={0.9} />}
    </group>
  );
}
