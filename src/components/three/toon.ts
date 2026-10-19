import * as THREE from 'three';

let gradient: THREE.DataTexture | null = null;

/** 3-step ramp for a crisp cel-shaded look. */
export function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient;
  const data = new Uint8Array([90, 90, 90, 255, 180, 180, 180, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

const cache = new Map<string, THREE.Material>();

export function toon(color: string, opts: { emissive?: string; emissiveIntensity?: number; transparent?: boolean; opacity?: number } = {}): THREE.MeshToonMaterial {
  const key = `toon:${color}:${opts.emissive ?? ''}:${opts.emissiveIntensity ?? 0}:${opts.opacity ?? 1}`;
  let m = cache.get(key) as THREE.MeshToonMaterial | undefined;
  if (!m) {
    m = new THREE.MeshToonMaterial({
      color,
      gradientMap: toonGradient(),
      emissive: opts.emissive ?? '#000000',
      emissiveIntensity: opts.emissiveIntensity ?? 0,
      transparent: opts.transparent ?? (opts.opacity ?? 1) < 1,
      opacity: opts.opacity ?? 1,
    });
    cache.set(key, m);
  }
  return m;
}

export function glowMat(color: string, opacity = 0.6): THREE.MeshBasicMaterial {
  const key = `glow:${color}:${opacity}`;
  let m = cache.get(key) as THREE.MeshBasicMaterial | undefined;
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    cache.set(key, m);
  }
  return m;
}

export function basic(color: string): THREE.MeshBasicMaterial {
  const key = `basic:${color}`;
  let m = cache.get(key) as THREE.MeshBasicMaterial | undefined;
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color });
    cache.set(key, m);
  }
  return m;
}

const labelCache = new Map<string, THREE.CanvasTexture>();

/** Text decal (cap prints, jersey numbers) drawn on a canvas, so no font files are fetched. */
export function labelTexture(text: string, fg: string, bg: string | null = null, w = 256, h = 128): THREE.CanvasTexture {
  const key = `${text}:${fg}:${bg}:${w}x${h}`;
  const hit = labelCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = h * 0.72;
  ctx.font = `900 ${size}px system-ui, -apple-system, Segoe UI, sans-serif`;
  while (ctx.measureText(text).width > w * 0.92 && size > 10) {
    size -= 4;
    ctx.font = `900 ${size}px system-ui, -apple-system, Segoe UI, sans-serif`;
  }
  ctx.lineWidth = Math.max(4, size / 9);
  ctx.strokeStyle = 'rgba(20,10,30,0.85)';
  ctx.strokeText(text, w / 2, h / 2 + 4);
  ctx.fillText(text, w / 2, h / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  labelCache.set(key, tex);
  return tex;
}

/**
 * Plush "velvet" material for fur and fabric: a physical material with sheen, matching the soft
 * toy look of the character sheets. Falls back to Lambert on low quality.
 */
export function fur(color: string, opts: { low?: boolean; emissive?: string; emissiveIntensity?: number; sheen?: string } = {}): THREE.Material {
  const key = `fur:${color}:${opts.low ? 1 : 0}:${opts.emissive ?? ''}:${opts.emissiveIntensity ?? 0}:${opts.sheen ?? ''}`;
  let m = cache.get(key);
  if (!m) {
    if (opts.low) {
      m = new THREE.MeshLambertMaterial({ color, emissive: opts.emissive ?? '#000000', emissiveIntensity: opts.emissiveIntensity ?? 0 });
    } else {
      const c = new THREE.Color(color);
      m = new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.78,
        metalness: 0,
        sheen: 1,
        sheenRoughness: 0.45,
        sheenColor: new THREE.Color(opts.sheen ?? c.clone().lerp(new THREE.Color('#ffffff'), 0.45)),
        emissive: opts.emissive ?? '#000000',
        emissiveIntensity: opts.emissiveIntensity ?? 0,
      });
    }
    cache.set(key, m);
  }
  return m;
}

/** Glossy surfaces: eyes, nose, paw pads, visors. */
export function gloss(color: string, opts: { low?: boolean; emissive?: string; emissiveIntensity?: number; opacity?: number; roughness?: number; metalness?: number } = {}): THREE.Material {
  const key = `gloss:${color}:${opts.low ? 1 : 0}:${opts.emissive ?? ''}:${opts.emissiveIntensity ?? 0}:${opts.opacity ?? 1}:${opts.roughness ?? 0.25}:${opts.metalness ?? 0}`;
  let m = cache.get(key);
  if (!m) {
    const transparent = (opts.opacity ?? 1) < 1;
    m = opts.low
      ? new THREE.MeshLambertMaterial({ color, emissive: opts.emissive ?? '#000000', emissiveIntensity: opts.emissiveIntensity ?? 0, transparent, opacity: opts.opacity ?? 1 })
      : new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.25, metalness: opts.metalness ?? 0, emissive: opts.emissive ?? '#000000', emissiveIntensity: opts.emissiveIntensity ?? 0, transparent, opacity: opts.opacity ?? 1, depthWrite: !transparent });
    cache.set(key, m);
  }
  return m;
}

let shadowTex: THREE.CanvasTexture | null = null;
/** Soft blob shadow: far cheaper than real shadows and reads well under a plush character. */
export function blobShadow(): THREE.CanvasTexture {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(20,8,40,0.55)');
  g.addColorStop(1, 'rgba(20,8,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

/** Soft matte surfaces for scenery. */
export function matte(color: string, opts: { opacity?: number } = {}): THREE.Material {
  const key = `matte:${color}:${opts.opacity ?? 1}`;
  let m = cache.get(key);
  if (!m) {
    const transparent = (opts.opacity ?? 1) < 1;
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, transparent, opacity: opts.opacity ?? 1 });
    cache.set(key, m);
  }
  return m;
}
