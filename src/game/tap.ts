/** Tap & energy economy. All numbers are integers so the server can recompute them exactly. */
export interface EnergyConfig {
  cap: number;
  regenPerSec: number;
  tapPower: number;
  critChance: number;
}

export const BASE_ENERGY_CAP = 500;
export const BASE_REGEN = 1.5;
export const MAX_TAPS_PER_SEC = 15;
export const COMBO_WINDOW_MS = 450;
export const OVERCHARGE_AT = 60;

export function energyConfig(opts: { focus: number; holderBoost: number; skillCap: number; skillRegen: number; skillTap: number; skillCrit: number; luck: number; level: number }): EnergyConfig {
  const focusMul = 1 + Math.max(0, opts.focus - 10) / 100;
  const boost = 1 + opts.holderBoost;
  return {
    cap: Math.round((BASE_ENERGY_CAP * focusMul + opts.skillCap) * boost),
    regenPerSec: Math.round((BASE_REGEN * focusMul + opts.skillRegen) * boost * 100) / 100,
    tapPower: 1 + Math.floor(opts.level / 5) + opts.skillTap,
    critChance: Math.min(0.25, 0.03 + opts.luck / 400 + opts.skillCrit),
  };
}

export function regenEnergy(current: number, cap: number, regenPerSec: number, elapsedMs: number): number {
  return Math.min(cap, current + (regenPerSec * Math.max(0, elapsedMs)) / 1000);
}

/** Combo multiplier: rises with consecutive quick taps, caps at 2x. */
export function comboMultiplier(combo: number): number {
  return 1 + Math.min(1, combo / 100);
}

export function offlineEarnings(perHour: number, elapsedMs: number, capHours: number): number {
  const hours = Math.min(capHours, Math.max(0, elapsedMs) / 3_600_000);
  return Math.floor(perHour * hours);
}

/** Server-side sanity check for a batch of taps reported by a client. */
export function plausibleTaps(taps: number, windowMs: number): boolean {
  return taps >= 0 && taps <= Math.ceil((windowMs / 1000) * MAX_TAPS_PER_SEC) + 5;
}
