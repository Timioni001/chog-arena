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

export function stripeTexture(a: string, b: string): THREE.CanvasTexture {
  const key = `stripe:${a}:${b}`;
  const hit = labelCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? a : b;
    ctx.fillRect(0, i * 8, 64, 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  labelCache.set(key, tex);
  return tex;
}
