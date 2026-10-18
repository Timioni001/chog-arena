'use client';

/** Tiny WebAudio synth: every sound is generated, so there are no audio files to download. */
let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(v: boolean) {
  enabled = v;
}

function ac(): AudioContext | null {
  if (!enabled || typeof window === 'undefined') return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.12, when = 0, slideTo?: number) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, gain = 0.08, when = 0, freq = 1200) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + when;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export const sfx = {
  tap: (combo: number) => tone(420 + Math.min(combo, 80) * 6, 0.07, 'triangle', 0.08),
  crit: () => { tone(880, 0.08, 'square', 0.06); tone(1320, 0.12, 'square', 0.05, 0.06); },
  overcharge: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'sawtooth', 0.05, i * 0.06)),
  card: () => noise(0.09, 0.12, 0, 600),
  reveal: () => tone(300, 0.18, 'sine', 0.08, 0, 700),
  buff: () => tone(660, 0.12, 'triangle', 0.07, 0, 990),
  hex: () => tone(400, 0.2, 'sawtooth', 0.05, 0, 160),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'triangle', 0.09, i * 0.1)),
  lose: () => [440, 392, 330, 262].forEach((f, i) => tone(f, 0.25, 'sine', 0.08, i * 0.13)),
  coin: () => { tone(988, 0.06, 'square', 0.05); tone(1319, 0.14, 'square', 0.05, 0.06); },
  level: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'square', 0.05, i * 0.07)),
  click: () => tone(700, 0.04, 'triangle', 0.05),
  error: () => tone(180, 0.15, 'square', 0.05),
};

export function haptic(pattern: number | number[] = 8) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    /* unsupported */
  }
}
