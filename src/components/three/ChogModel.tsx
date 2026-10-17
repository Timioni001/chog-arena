'use client';

import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, type ThreeElements } from '@react-three/fiber';
import { Outlines, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import type { Appearance } from '@/lib/appearance';
import { basic, glowMat, labelTexture, stripeTexture, toon } from './toon';

export type AnimKind = 'idle' | 'tap' | 'charge' | 'attack' | 'hit' | 'win' | 'levelup' | 'lose';
export interface AnimCue {
  kind: AnimKind;
  id: number;
}

export const OutlineContext = createContext<{ outline: boolean; particles: boolean; reducedMotion: boolean }>({ outline: true, particles: true, reducedMotion: false });

const INK = '#170d22';

function Part({ children, outline = true, thickness = 0.03, ...props }: { children: ReactNode; outline?: boolean; thickness?: number } & ThreeElements['mesh']) {
  const q = useContext(OutlineContext);
  return (
    <mesh {...props}>
      {children}
      {q.outline && outline ? <Outlines thickness={thickness} color={INK} /> : null}
    </mesh>
  );
}

/** Points on a sphere for the hood quills: back, top and sides, never over the face. */
function quillDirections(): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  const n = 46;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    const v = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
    if (v.z < 0.28 && v.y > -0.42 && !(v.z > 0.05 && v.y < 0.1)) out.push(v);
  }
  return out;
}
const QUILLS = quillDirections();

export function ChogModel({ look, cue, ascension = 0, scale = 1 }: { look: Appearance; cue?: AnimCue; ascension?: number; scale?: number }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const quills = useRef<THREE.Group>(null);
  const q = useContext(OutlineContext);
  const anim = useRef<{ kind: AnimKind; t0: number; id: number }>({ kind: 'idle', t0: 0, id: -1 });
  const blink = useRef({ next: 2 + Math.random() * 3 });

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (cue && cue.id !== anim.current.id) anim.current = { kind: cue.kind, t0: t, id: cue.id };
    const a = anim.current;
    const dt = t - a.t0;
    const g = root.current, b = body.current, h = head.current;
    if (!g || !b || !h) return;
    const calm = q.reducedMotion ? 0.25 : 1;

    // idle: bob + breathe
    let y = Math.sin(t * 2.2) * 0.035 * calm;
    let sx = 1 + Math.sin(t * 2.2 + 1) * 0.012 * calm;
    let sy = 1 / sx;
    let rotY = look.facing * 0.32 + Math.sin(t * 0.7) * 0.06 * calm;
    let z = 0, x = 0, rotZ = Math.sin(t * 1.3) * 0.02 * calm, spin = 0;

    switch (a.kind) {
      case 'tap': {
        const k = Math.max(0, 1 - dt / 0.22);
        const s = Math.sin(dt * 40) * k;
        sy *= 1 - 0.14 * k + 0.05 * s;
        sx *= 1 + 0.1 * k;
        break;
      }
      case 'charge': {
        const k = Math.max(0, 1 - dt / 0.9);
        sy *= 1 - 0.1 * k;
        x = Math.sin(dt * 70) * 0.03 * k * calm;
        break;
      }
      case 'attack': {
        const k = dt < 0.18 ? dt / 0.18 : Math.max(0, 1 - (dt - 0.18) / 0.35);
        z = 0.75 * k;
        rotY = rotY * (1 - k);
        sy *= 1 - 0.08 * k;
        break;
      }
      case 'hit': {
        const k = Math.max(0, 1 - dt / 0.5);
        x = Math.sin(dt * 60) * 0.09 * k * calm;
        rotZ += Math.sin(dt * 30) * 0.15 * k * calm;
        z = -0.25 * k;
        break;
      }
      case 'win': {
        const k = dt < 1.2 ? dt / 1.2 : 1;
        y += Math.sin(Math.min(1, dt / 0.6) * Math.PI) * 0.7 * (dt < 0.6 ? 1 : 0);
        spin = k * Math.PI * 2 * (dt < 1.2 ? 1 : 0);
        if (dt > 1.2) y += Math.abs(Math.sin(dt * 5)) * 0.12 * calm;
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
        sy *= 1 - 0.12 * k;
        rotZ += 0.12 * k;
        h.rotation.x = 0.25 * k;
        break;
      }
    }
    if (a.kind !== 'lose') h.rotation.x = Math.sin(t * 1.1) * 0.04 * calm;

    g.position.set(x, y, z);
    g.rotation.set(0, rotY + spin, rotZ);
    b.scale.set(sx, sy, sx);

    // blink
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
    if (quills.current) quills.current.rotation.z = Math.sin(t * 3.1) * 0.025 * calm;
  });

  const skinMat = useMemo(() => {
    if (look.metal) return new THREE.MeshStandardMaterial({ color: look.skin, metalness: 0.85, roughness: 0.25 });
    return toon(look.skin, look.glow ? { emissive: look.glow, emissiveIntensity: look.archetype === 'Radioactive' ? 0.35 : 0.12 } : {});
  }, [look.skin, look.metal, look.glow, look.archetype]);
  const quillMat = useMemo(() => {
    if (look.skull) return toon('#efe7d2');
    if (look.multi) return null;
    return look.metal ? skinMat : toon(look.skinShade, look.glow ? { emissive: look.glow, emissiveIntensity: 0.25 } : {});
  }, [look.skull, look.multi, look.metal, look.skinShade, look.glow, skinMat]);
  const rainbow = ['#ff5a5a', '#ffb347', '#ffe14d', '#5ee36a', '#4ee6f0', '#7c4dff', '#ff5fd2'];

  return (
    <group scale={scale}>
      <group ref={root}>
        <group ref={body}>
          {/* legs + feet */}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.26, 0, 0]}>
              <Part position={[0, 0.3, 0]} material={skinMat}>
                <capsuleGeometry args={[0.16, 0.22, 6, 14]} />
              </Part>
              <Part position={[0, 0.09, 0.08]} scale={[1, 0.62, 1.35]} material={toon(look.paws)}>
                <sphereGeometry args={[0.19, 20, 14]} />
              </Part>
            </group>
          ))}

          {/* torso */}
          <Part position={[0, 0.78, 0]} material={skinMat}>
            <capsuleGeometry args={[0.47, 0.32, 8, 20]} />
          </Part>
          <Outfit look={look} />

          {/* arms */}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.5, 0.95, 0.02]} rotation={[0.15, 0, s * 0.85]}>
              <Part position={[0, -0.2, 0]} material={sleeveMat(look) ?? skinMat}>
                <capsuleGeometry args={[0.12, 0.26, 6, 12]} />
              </Part>
              <Part position={[0, -0.42, 0.02]} material={toon(look.paws)}>
                <sphereGeometry args={[0.14, 16, 12]} />
              </Part>
            </group>
          ))}
          <Accessory look={look} />

          {/* head */}
          <group ref={head} position={[0, 1.66, 0]}>
            <Part material={skinMat} scale={[1, 0.95, 0.95]}>
              <sphereGeometry args={[0.76, 32, 24]} />
            </Part>
            <group ref={quills}>
              {QUILLS.map((d, i) => {
                const pos = d.clone().multiplyScalar(0.68);
                const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
                const len = 0.42 + ((i * 37) % 10) / 55;
                return (
                  <Part key={i} position={pos} quaternion={quat} material={quillMat ?? toon(rainbow[i % rainbow.length])} thickness={0.022}>
                    <coneGeometry args={[0.17, len, 7]} />
                  </Part>
                );
              })}
            </group>
            <Face look={look} eyesRef={eyes} />
            <Headwear look={look} />
          </group>
        </group>

        {/* ascension rings */}
        {Array.from({ length: ascension }, (_, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02 + i * 0.01, 0]} material={glowMat(i % 2 ? '#ff8fc8' : '#b9a6ff', 0.5)}>
            <ringGeometry args={[0.75 + i * 0.16, 0.8 + i * 0.16, 48]} />
          </mesh>
        ))}
        <Aura look={look} />
      </group>
    </group>
  );
}

function sleeveMat(look: Appearance): THREE.Material | null {
  const k = look.body.kind;
  if (k === 'suit' || k === 'hoodie' || k === 'astro' || k === 'robe' || k === 'armor' || k === 'costume') return toon(look.body.color);
  if (k === 'stripes') return new THREE.MeshToonMaterial({ map: stripeTexture(look.body.color, look.body.color2) });
  return null;
}

function Outfit({ look }: { look: Appearance }) {
  const { kind, color, color2, text } = look.body;
  if (kind === 'none') return null;
  const main = kind === 'armor' ? new THREE.MeshStandardMaterial({ color, metalness: 0.8, roughness: 0.3 }) : kind === 'stripes' ? new THREE.MeshToonMaterial({ map: stripeTexture(color, color2) }) : toon(color);
  const long = kind === 'robe' || kind === 'costume';
  return (
    <group>
      <Part position={[0, long ? 0.66 : 0.74, 0]} material={main}>
        <capsuleGeometry args={[0.495, long ? 0.42 : 0.26, 8, 20]} />
      </Part>
      {kind === 'suit' && (
        <>
          <mesh position={[0, 0.93, 0.5]} rotation={[0, 0, -Math.PI / 2]} scale={[1, 0.8, 1]} material={basic(color2)}>
            <circleGeometry args={[0.17, 3]} />
          </mesh>
          <Part position={[0, 0.84, 0.5]} material={toon('#b3122e')}>
            <boxGeometry args={[0.07, 0.26, 0.04]} />
          </Part>
        </>
      )}
      {kind === 'hoodie' && (
        <Part position={[0, 1.15, -0.18]} rotation={[1.25, 0, 0]} material={toon(color2)}>
          <torusGeometry args={[0.36, 0.09, 8, 20]} />
        </Part>
      )}
      {(kind === 'jersey' || (kind === 'hoodie' && text)) && text && (
        <mesh position={[0, 0.78, 0.5]} material={new THREE.MeshBasicMaterial({ map: labelTexture(text, color2 === '#ffffff' ? '#ffffff' : '#ffffff'), transparent: true })}>
          <planeGeometry args={[0.5, 0.25]} />
        </mesh>
      )}
      {kind === 'robe' && (
        <Part position={[0, 0.36, 0]} rotation={[Math.PI / 2, 0, 0]} material={toon(color2)}>
          <torusGeometry args={[0.46, 0.05, 8, 28]} />
        </Part>
      )}
      {kind === 'armor' && [-1, 1].map((s) => (
        <Part key={s} position={[s * 0.45, 1.08, 0]} material={main}>
          <sphereGeometry args={[0.2, 16, 12]} />
        </Part>
      ))}
      {kind === 'astro' && (
        <Part position={[0, 0.82, 0.47]} material={toon('#2a2433')}>
          <boxGeometry args={[0.32, 0.2, 0.06]} />
        </Part>
      )}
      {kind === 'astro' && [-0.08, 0.04].map((x, i) => (
        <mesh key={i} position={[x, 0.82, 0.51]} material={glowMat(i ? '#ff5a5a' : color2, 0.95)}>
          <sphereGeometry args={[0.035, 8, 6]} />
        </mesh>
      ))}
      {kind === 'vest' && [-1, 1].map((s) => (
        <Part key={s} position={[s * 0.24, 0.82, 0.43]} rotation={[0, s * 0.45, 0]} material={toon(color)}>
          <boxGeometry args={[0.2, 0.5, 0.06]} />
        </Part>
      ))}
      {kind === 'costume' && /#ffd34d/i.test(color) && (
        <Part position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]} material={toon('#ffd34d')}>
          <torusGeometry args={[0.55, 0.13, 10, 24]} />
        </Part>
      )}
      {kind === 'costume' && /#8fb6d9/i.test(color) && (
        <Part position={[0, 1.05, -0.5]} rotation={[-0.5, 0, 0]} material={toon(color)}>
          <coneGeometry args={[0.14, 0.4, 3]} />
        </Part>
      )}
    </group>
  );
}

/** The face is an ellipsoid pressed onto the front of the hood; features sit on its surface. */
const FACE = { y: -0.06, z: 0.44, rx: 0.56, ry: 0.515, rz: 0.34 };
export function fz(x: number, y: number, lift = 0.01): number {
  const k = 1 - (x / FACE.rx) ** 2 - ((y - FACE.y) / FACE.ry) ** 2;
  return FACE.z + FACE.rz * Math.sqrt(Math.max(0, k)) + lift;
}

function Eye({ x, look }: { x: number; look: Appearance }) {
  const { kind, color } = look.eyes;
  const z = fz(x, 0.04, 0.0);
  const pupil = look.skull ? '#1b1424' : color;
  switch (kind) {
    case 'happy':
      return (
        <mesh position={[x, 0.06, z]} rotation={[0, 0, 0]} material={basic('#1b1424')}>
          <torusGeometry args={[0.08, 0.025, 6, 16, Math.PI]} />
        </mesh>
      );
    case 'closed':
      return (
        <mesh position={[x, 0.04, z]} material={basic(color === '#1b1424' ? '#1b1424' : color)}>
          <boxGeometry args={[0.16, 0.035, 0.02]} />
        </mesh>
      );
    case 'dead':
      return (
        <group position={[x, 0.04, z]}>
          {[1, -1].map((s) => (
            <mesh key={s} rotation={[0, 0, s * 0.785]} material={basic('#1b1424')}>
              <boxGeometry args={[0.18, 0.04, 0.02]} />
            </mesh>
          ))}
        </group>
      );
    case 'heart': {
      const shape = new THREE.Shape();
      shape.moveTo(0, -0.08);
      shape.bezierCurveTo(-0.14, 0.0, -0.08, 0.12, 0, 0.05);
      shape.bezierCurveTo(0.08, 0.12, 0.14, 0.0, 0, -0.08);
      return (
        <mesh position={[x, 0.04, z]} material={basic(color)}>
          <shapeGeometry args={[shape]} />
        </mesh>
      );
    }
    case 'frog':
      return (
        <group position={[x * 1.1, 0.1, z - 0.04]}>
          <Part material={toon('#ffffff')}>
            <sphereGeometry args={[0.13, 16, 12]} />
          </Part>
          <mesh position={[0, 0, 0.1]} material={basic('#1b1424')}>
            <sphereGeometry args={[0.055, 10, 8]} />
          </mesh>
        </group>
      );
    default: {
      const offX = kind === 'side' ? 0.035 * Math.sign(look.facing) : 0;
      const offY = kind === 'up' ? 0.04 : 0;
      return (
        <group position={[x, 0.04, z]}>
          <mesh scale={[0.85, kind === 'tired' ? 0.75 : 1.2, 0.4]} material={basic(look.skull ? '#2a1d33' : '#1b1424')}>
            <sphereGeometry args={[0.1, 16, 12]} />
          </mesh>
          {pupil !== '#1b1424' && <mesh position={[offX, offY, 0.035]} material={basic(pupil)}><sphereGeometry args={[0.045, 10, 8]} /></mesh>}
          <mesh position={[0.03 + offX, 0.05 + offY, 0.04]} material={basic('#ffffff')}>
            <sphereGeometry args={[0.03, 8, 6]} />
          </mesh>
          {kind === 'tired' && (
            <mesh position={[0, 0.07, 0.01]} scale={[1, 0.5, 0.6]} material={toon(look.face)}>
              <sphereGeometry args={[0.11, 12, 8]} />
            </mesh>
          )}
          {kind === 'angry' && (
            <mesh position={[0, 0.15, 0.02]} rotation={[0, 0, -Math.sign(x) * 0.45]} material={basic('#1b1424')}>
              <boxGeometry args={[0.17, 0.035, 0.02]} />
            </mesh>
          )}
        </group>
      );
    }
  }
}

function Face({ look, eyesRef }: { look: Appearance; eyesRef: React.RefObject<THREE.Group | null> }) {
  const tears = useRef<THREE.Group>(null);
  const gum = useRef<THREE.Mesh>(null);
  const puke = useRef<THREE.Group>(null);
  const laser = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (tears.current) tears.current.children.forEach((c, i) => { c.position.y = -((t * 0.5 + i * 0.5) % 1) * 0.35; });
    if (gum.current) { const s = 0.6 + ((Math.sin(t * 1.4) + 1) / 2) * 0.9; gum.current.scale.setScalar(s); }
    if (puke.current) puke.current.children.forEach((c, i) => { c.position.y = -0.05 - ((t * 1.2 + i * 0.14) % 1) * 0.5; });
    if (laser.current) laser.current.scale.set(1, 1, 0.8 + Math.sin(t * 12) * 0.2);
  });
  const { eyes, mouth } = look;
  return (
    <group>
      {/* face patch */}
      <Part position={[0, FACE.y, FACE.z]} scale={[1, FACE.ry / FACE.rx, FACE.rz / FACE.rx]} material={toon(look.face)} thickness={0.02}>
        <sphereGeometry args={[FACE.rx, 28, 20]} />
      </Part>
      {look.skull && (
        <mesh position={[0, -0.12, fz(0, -0.12)]} rotation={[0, 0, Math.PI]} material={basic('#2a1d33')}>
          <circleGeometry args={[0.05, 3]} />
        </mesh>
      )}

      {/* eyes */}
      <group ref={eyesRef}>
        {eyes.kind === 'visor' ? (
          <Part position={[0, 0.05, fz(0, 0.05) - 0.18]} scale={[1, 0.38, 0.5]} material={toon(eyes.color, { emissive: eyes.color, emissiveIntensity: 0.6 })}>
            <sphereGeometry args={[0.36, 24, 12, 0, Math.PI * 2, 0.9, 1.4]} />
          </Part>
        ) : eyes.kind === 'vr' ? (
          <Part position={[0, 0.05, fz(0, 0.05) - 0.02]} material={toon(eyes.color)}>
            <boxGeometry args={[0.58, 0.22, 0.16]} />
          </Part>
        ) : (
          <>
            <Eye x={-0.19} look={look} />
            <Eye x={0.19} look={look} />
          </>
        )}
        {eyes.kind === 'shades' && (
          <group position={[0, 0.05, fz(0.19, 0.05) + 0.05]}>
            {[-0.19, 0.19].map((x) => (
              <mesh key={x} position={[x, 0, 0]} material={toon(eyes.color)}>
                <boxGeometry args={[0.24, 0.15, 0.04]} />
              </mesh>
            ))}
            <mesh material={basic('#1b1424')}><boxGeometry args={[0.16, 0.03, 0.03]} /></mesh>
          </group>
        )}
      </group>
      {eyes.kind === 'laser' && (
        <group ref={laser}>
          {[-0.19, 0.19].map((x) => (
            <group key={x} position={[x, 0.04, fz(x, 0.04) + 0.03]}>
              <mesh material={glowMat(eyes.color, 0.95)}><sphereGeometry args={[0.07, 10, 8]} /></mesh>
              <mesh position={[0, 0, 0.9]} rotation={[Math.PI / 2, 0, 0]} material={glowMat(eyes.color, 0.55)}>
                <cylinderGeometry args={[0.03, 0.05, 1.8, 8, 1, true]} />
              </mesh>
            </group>
          ))}
        </group>
      )}
      {eyes.kind === 'cry' && (
        <group ref={tears} position={[0, -0.02, fz(0.24, -0.02) + 0.02]}>
          {[-0.24, 0.24, -0.24, 0.24].map((x, i) => (
            <mesh key={i} position={[x, 0, 0]} material={toon('#7fd7ff')}><sphereGeometry args={[0.035, 8, 6]} /></mesh>
          ))}
        </group>
      )}

      {/* cheeks + nose */}
      {!look.skull && [-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.33, -0.1, fz(0.33, -0.1, 0.012)]} rotation={[0, s * 0.62, 0]} material={basic(look.cheeks)}>
          <circleGeometry args={[0.085, 20]} />
        </mesh>
      ))}
      {!look.skull && (
        <mesh position={[0, -0.07, fz(0, -0.07, 0.0)]} scale={[1.2, 0.8, 0.8]} material={toon('#ff9cc8')}>
          <sphereGeometry args={[0.04, 10, 8]} />
        </mesh>
      )}

      {/* mouth */}
      <group position={[0, -0.24, fz(0, -0.24, 0.0)]}>
        {(mouth.kind === 'smile' || mouth.kind === 'grin' || mouth.kind === 'bite' || mouth.kind === 'gum' || mouth.kind === 'drool') && (
          <mesh rotation={[0, 0, Math.PI]} material={basic('#5a1830')}><torusGeometry args={[0.08, 0.018, 6, 16, Math.PI]} /></mesh>
        )}
        {mouth.kind === 'clown' && (
          <mesh rotation={[0, 0, Math.PI]} material={basic(mouth.color)}><torusGeometry args={[0.12, 0.035, 6, 18, Math.PI]} /></mesh>
        )}
        {(mouth.kind === 'sad') && (
          <mesh position={[0, -0.06, 0]} material={basic('#5a1830')}><torusGeometry args={[0.07, 0.018, 6, 16, Math.PI]} /></mesh>
        )}
        {mouth.kind === 'flat' && <mesh material={basic('#5a1830')}><boxGeometry args={[0.14, 0.025, 0.02]} /></mesh>}
        {mouth.kind === 'o' && <mesh material={basic('#5a1830')}><torusGeometry args={[0.04, 0.017, 6, 14]} /></mesh>}
        {mouth.kind === 'grit' && (
          <mesh material={basic('#ffffff')}><boxGeometry args={[0.16, 0.06, 0.02]} /></mesh>
        )}
        {mouth.kind === 'grin' && <mesh position={[0.03, -0.075, 0.01]} material={toon('#f5c542', { emissive: '#f5c542', emissiveIntensity: 0.3 })}><boxGeometry args={[0.04, 0.04, 0.02]} /></mesh>}
        {mouth.kind === 'bite' && <mesh position={[0, -0.075, 0.01]} material={basic('#ffffff')}><boxGeometry args={[0.04, 0.03, 0.02]} /></mesh>}
        {mouth.kind === 'gum' && <mesh ref={gum} position={[0.05, -0.08, 0.1]} material={toon('#ff8fc8', { opacity: 0.92 })}><sphereGeometry args={[0.12, 16, 12]} /></mesh>}
        {mouth.kind === 'drool' && <mesh position={[0.06, -0.12, 0.01]} scale={[0.7, 1.4, 0.7]} material={toon('#9fe8ff', { opacity: 0.85 })}><sphereGeometry args={[0.035, 8, 6]} /></mesh>}
        {mouth.kind === 'coin' && (
          <Part position={[0, -0.05, 0.05]} rotation={[Math.PI / 2, 0, 0]} material={toon(mouth.color, { emissive: mouth.color, emissiveIntensity: 0.25 })} thickness={0.015}>
            <cylinderGeometry args={[0.1, 0.1, 0.03, 20]} />
          </Part>
        )}
        {mouth.kind === 'puke' && (
          <>
            <mesh material={basic('#5a1830')}><torusGeometry args={[0.05, 0.018, 6, 14]} /></mesh>
            <group ref={puke}>
              {['#ff5a5a', '#ffb347', '#ffe14d', '#5ee36a', '#4ee6f0', '#7c4dff', '#ff5fd2'].map((c, i) => (
                <mesh key={c} position={[0, 0, 0.08 + i * 0.01]} material={toon(c)}><boxGeometry args={[0.1, 0.07, 0.05]} /></mesh>
              ))}
            </group>
          </>
        )}
      </group>
    </group>
  );
}

function Headwear({ look }: { look: Appearance }) {
  const { kind, color, color2, text } = look.head;
  const halo = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (halo.current) { halo.current.rotation.y = clock.elapsedTime * 0.8; halo.current.position.y = 1.0 + Math.sin(clock.elapsedTime * 2) * 0.03; }
  });
  switch (kind) {
    case 'cap':
      return (
        <group position={[0, 0.38, 0.04]} rotation={[-0.14, 0, 0]}>
          <Part material={toon(color)} scale={[1, 0.72, 1]}>
            <sphereGeometry args={[0.68, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </Part>
          <Part position={[0, 0.0, 0.6]} rotation={[0.18, 0, 0]} scale={[1, 1, 1.3]} material={toon(color2 === '#ffffff' ? color : color2)}>
            <cylinderGeometry args={[0.42, 0.44, 0.04, 24, 1, false, -Math.PI / 2, Math.PI]} />
          </Part>
          {text && (
            <mesh position={[0, 0.17, 0.6]} rotation={[-0.32, 0, 0]} material={new THREE.MeshBasicMaterial({ map: labelTexture(text, '#ffffff'), transparent: true, depthWrite: false })}>
              <planeGeometry args={[0.52, 0.26]} />
            </mesh>
          )}
        </group>
      );
    case 'bucket':
      return (
        <group position={[0, 0.48, 0]} rotation={[-0.08, 0, 0]}>
          <Part material={toon(color)}><cylinderGeometry args={[0.42, 0.56, 0.4, 24]} /></Part>
          <Part position={[0, -0.2, 0]} material={toon(color2)}><cylinderGeometry args={[0.85, 0.85, 0.04, 28]} /></Part>
          {text && <mesh position={[0, 0.02, 0.5]} rotation={[-0.3, 0, 0]} material={new THREE.MeshBasicMaterial({ map: labelTexture(text, '#ffffff'), transparent: true })}><planeGeometry args={[0.45, 0.22]} /></mesh>}
        </group>
      );
    case 'beanie':
      return (
        <group position={[0, 0.36, 0]}>
          <Part material={toon(color)} scale={[1.05, 0.95, 1.05]}><sphereGeometry args={[0.62, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2]} /></Part>
          <Part position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} material={toon(color2 === '#ffffff' ? '#f4f1ea' : color2)}><torusGeometry args={[0.63, 0.08, 8, 28]} /></Part>
          <Part position={[0, 0.62, 0]} material={toon('#f4f1ea')}><sphereGeometry args={[0.13, 12, 10]} /></Part>
          {text && <mesh position={[0, 0.03, 0.7]} material={new THREE.MeshBasicMaterial({ map: labelTexture(text, '#1b1424'), transparent: true })}><planeGeometry args={[0.4, 0.2]} /></mesh>}
        </group>
      );
    case 'crown':
      return (
        <group position={[0, 0.72, 0]}>
          <Part material={toon(color, { emissive: color, emissiveIntensity: 0.25 })}><cylinderGeometry args={[0.36, 0.32, 0.22, 20, 1, true]} /></Part>
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <group key={i}>
                <Part position={[Math.sin(a) * 0.34, 0.2, Math.cos(a) * 0.34]} material={toon(color, { emissive: color, emissiveIntensity: 0.25 })}><coneGeometry args={[0.07, 0.2, 6]} /></Part>
                <mesh position={[Math.sin(a) * 0.36, 0.0, Math.cos(a) * 0.36]} material={toon(color2, { emissive: color2, emissiveIntensity: 0.4 })}><sphereGeometry args={[0.045, 8, 6]} /></mesh>
              </group>
            );
          })}
        </group>
      );
    case 'wizard':
      return (
        <group position={[0, 0.55, 0]} rotation={[-0.15, 0, 0.12]}>
          <Part position={[0, -0.05, 0]} material={toon(color)}><cylinderGeometry args={[0.8, 0.8, 0.04, 28]} /></Part>
          <Part position={[0, 0.5, -0.05]} rotation={[-0.2, 0, 0]} material={toon(color)}><coneGeometry args={[0.48, 1.1, 24]} /></Part>
          <mesh position={[0.12, 0.45, 0.3]} material={glowMat(color2, 0.95)}><octahedronGeometry args={[0.07]} /></mesh>
        </group>
      );
    case 'helmet':
      return (
        <group position={[0, 0.18, 0]}>
          <Part material={toon(color)} scale={[1.08, 1.05, 1.08]}><sphereGeometry args={[0.72, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2.1]} /></Part>
          <Part position={[0, 0.78, -0.05]} material={toon(color2)}><boxGeometry args={[0.12, 0.38, 0.9]} /></Part>
        </group>
      );
    case 'horns':
      return (
        <group position={[0, 0.5, 0.05]}>
          {[-1, 1].map((s) => (
            <Part key={s} position={[s * 0.42, 0.18, 0]} rotation={[0, 0, -s * 0.5]} material={toon(color)}><coneGeometry args={[0.11, 0.45, 10]} /></Part>
          ))}
        </group>
      );
    case 'halo':
      return (
        <group ref={halo} position={[0, 1.0, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={glowMat(color, 0.9)}><torusGeometry args={[0.38, 0.045, 8, 32]} /></mesh>
        </group>
      );
    case 'gem':
      return (
        <group ref={halo} position={[0, 1.0, 0]}>
          <mesh material={toon(color, { emissive: color, emissiveIntensity: 0.6 })}><octahedronGeometry args={[0.18]} /></mesh>
        </group>
      );
    case 'headband':
      return (
        <group position={[0, 0.2, 0]} rotation={[-0.15, 0, 0]}>
          <Part rotation={[Math.PI / 2, 0, 0]} material={toon(color)}><torusGeometry args={[0.72, 0.07, 8, 32]} /></Part>
          {color === '#ffffff' && <mesh position={[0, 0, 0.79]} material={basic('#e8414b')}><circleGeometry args={[0.07, 16]} /></mesh>}
          <Part position={[0.2, -0.1, -0.75]} rotation={[0.4, 0, 0.5]} material={toon(color2)}><boxGeometry args={[0.08, 0.32, 0.03]} /></Part>
        </group>
      );
    case 'durag':
      return (
        <group position={[0, 0.2, -0.02]}>
          <Part material={toon(color)} scale={[1.04, 1, 1.04]}><sphereGeometry args={[0.74, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2.2]} /></Part>
          <Part position={[0, -0.3, -0.75]} rotation={[0.3, 0, 0]} material={toon(color2)}><boxGeometry args={[0.22, 0.6, 0.03]} /></Part>
        </group>
      );
    case 'hair': {
      const rain = text === 'rainbow';
      const cols = rain ? ['#ff5a5a', '#ffb347', '#ffe14d', '#5ee36a', '#4ee6f0', '#7c4dff', '#ff5fd2'] : [color, color2];
      return (
        <group position={[0, 0.25, -0.05]}>
          {Array.from({ length: rain ? 9 : 5 }, (_, i) => {
            const a = (i / (rain ? 8 : 4)) * Math.PI - Math.PI / 2;
            return (
              <Part key={i} position={[Math.sin(a) * 0.55, 0.3 + Math.cos(a) * 0.12, Math.cos(a) * 0.12 - 0.1]} material={toon(cols[i % cols.length])}>
                <sphereGeometry args={[0.32, 16, 12]} />
              </Part>
            );
          })}
        </group>
      );
    }
    case 'ushanka':
      return (
        <group position={[0, 0.52, 0]}>
          <Part material={toon(color)}><cylinderGeometry args={[0.6, 0.66, 0.4, 24]} /></Part>
          <Part position={[0, -0.12, 0.42]} material={toon(color2)}><boxGeometry args={[1.0, 0.2, 0.2]} /></Part>
          {[-1, 1].map((s) => <Part key={s} position={[s * 0.68, -0.4, 0]} material={toon(color2)}><boxGeometry args={[0.14, 0.5, 0.42]} /></Part>)}
        </group>
      );
    case 'clownNose':
      return <Part position={[0, -0.07, fz(0, -0.07, 0.03)]} material={toon(color)}><sphereGeometry args={[0.1, 14, 10]} /></Part>;
    case 'mask':
      return (
        <Part position={[0, 0.04, fz(0, 0.04, -0.02)]} rotation={[0, 0, 0]} material={toon(color)} thickness={0.015}>
          <torusGeometry args={[0.2, 0.06, 6, 24, Math.PI]} />
        </Part>
      );
    case 'thirdEye':
      return (
        <group position={[0, 0.34, fz(0, 0.34, 0.0) + 0.02]}>
          <mesh scale={[1, 1.4, 0.5]} material={toon(color, { emissive: color, emissiveIntensity: 0.6 })}><sphereGeometry args={[0.07, 12, 10]} /></mesh>
        </group>
      );
    case 'shroom':
      return (
        <group position={[0, 0.62, 0]}>
          <Part position={[0, 0.0, 0]} material={toon('#f4f1ea')}><cylinderGeometry args={[0.14, 0.18, 0.3, 12]} /></Part>
          <Part position={[0, 0.2, 0]} scale={[1, 0.6, 1]} material={toon(color)}><sphereGeometry args={[0.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /></Part>
          {[0, 2, 4].map((i) => <mesh key={i} position={[Math.sin(i) * 0.3, 0.38, Math.cos(i) * 0.3]} material={basic(color2)}><sphereGeometry args={[0.06, 8, 6]} /></mesh>)}
        </group>
      );
    case 'fedora':
      return (
        <group position={[0, 0.58, 0]}>
          <Part material={toon(color)}><cylinderGeometry args={[0.42, 0.5, 0.36, 24]} /></Part>
          <Part position={[0, -0.16, 0]} material={toon(color)}><cylinderGeometry args={[0.85, 0.85, 0.04, 28]} /></Part>
          <mesh position={[0, -0.08, 0]} material={toon(color2)}><cylinderGeometry args={[0.505, 0.505, 0.1, 24, 1, true]} /></mesh>
        </group>
      );
    default:
      return null;
  }
}

function Accessory({ look }: { look: Appearance }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.position.y = 1.2 + Math.sin(t * 2) * 0.06;
    ref.current.rotation.y = t * 0.9;
  });
  const a = look.accessory;
  if (!a) return null;
  if (a === 'frog') {
    return (
      <group position={[0.55, 1.18, 0.05]}>
        <Part material={toon('#5ec46b')} scale={[1, 0.8, 1]}><sphereGeometry args={[0.2, 16, 12]} /></Part>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.09, 0.14, 0.08]}>
            <Part material={toon('#ffffff')} thickness={0.015}><sphereGeometry args={[0.06, 10, 8]} /></Part>
            <mesh position={[0, 0, 0.05]} material={basic('#1b1424')}><sphereGeometry args={[0.028, 8, 6]} /></mesh>
          </group>
        ))}
      </group>
    );
  }
  if (a === 'cigar') {
    return (
      <group position={[0.15, 1.42, fz(0.15, -0.24) + 0.02]} rotation={[0, 0.4, -0.15]}>
        <Part material={toon('#7a4a2a')} rotation={[0, 0, Math.PI / 2]} thickness={0.012}><cylinderGeometry args={[0.03, 0.03, 0.24, 8]} /></Part>
        <mesh position={[0.13, 0, 0]} material={glowMat('#ff7a3d', 0.95)}><sphereGeometry args={[0.032, 8, 6]} /></mesh>
      </group>
    );
  }
  if (a === 'knife') {
    return (
      <group position={[0.95, 0.55, 0.15]} rotation={[0, 0, -0.4]}>
        <Part material={toon('#3a2a22')}><boxGeometry args={[0.06, 0.16, 0.06]} /></Part>
        <Part position={[0, 0.17, 0]} material={new THREE.MeshStandardMaterial({ color: '#dfe6ee', metalness: 0.9, roughness: 0.2 })} thickness={0.012}><boxGeometry args={[0.07, 0.2, 0.015]} /></Part>
      </group>
    );
  }
  return (
    <group ref={ref} position={[-0.95, 1.2, 0.1]}>
      {a === 'coin' && <Part rotation={[Math.PI / 2, 0, 0]} material={toon('#f5c542', { emissive: '#f5c542', emissiveIntensity: 0.3 })}><cylinderGeometry args={[0.16, 0.16, 0.04, 24]} /></Part>}
      {a === 'heart' && (
        <Part material={toon('#ff3b7a')} rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[0.2, 0.2, 0.08]} /></Part>
      )}
      {(a === 'candleUp' || a === 'candleDown') && (
        <group>
          <Part material={toon(a === 'candleUp' ? '#3fcf6e' : '#ff4b4b', { emissive: a === 'candleUp' ? '#3fcf6e' : '#ff4b4b', emissiveIntensity: 0.3 })}><boxGeometry args={[0.14, 0.4, 0.14]} /></Part>
          <mesh material={basic('#1b1424')}><boxGeometry args={[0.025, 0.65, 0.025]} /></mesh>
        </group>
      )}
      {a === 'box' && (
        <group>
          <Part material={toon('#ff5fd2')}><boxGeometry args={[0.26, 0.22, 0.26]} /></Part>
          <mesh material={toon('#ffe14d')}><boxGeometry args={[0.27, 0.06, 0.27]} /></mesh>
        </group>
      )}
    </group>
  );
}

function Aura({ look }: { look: Appearance }) {
  const q = useContext(OutlineContext);
  const shell = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (shell.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 2.5) * 0.04;
      shell.current.scale.set(s, s * 1.15, s);
    }
  });
  const color = look.aura?.color ?? look.glow;
  if (!color) return null;
  const speed = look.aura?.kind === 'flame' ? 1.4 : look.aura?.kind === 'electric' ? 2.5 : 0.5;
  return (
    <group position={[0, 1.2, 0]}>
      <mesh ref={shell} material={glowMat(color, 0.07)}>
        <sphereGeometry args={[1.15, 24, 16]} />
      </mesh>
      {q.particles && <Sparkles count={look.aura?.kind === 'flame' ? 36 : 24} scale={[2.6, 3, 2.6]} size={look.aura?.kind === 'smoke' ? 10 : 5} speed={speed} color={color} opacity={0.9} />}
    </group>
  );
}
