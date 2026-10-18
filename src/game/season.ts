export const PASS_TIERS = 30;
export const PASS_XP_PER_TIER = 200;

export type PassReward =
  | { kind: 'sparks'; amount: number }
  | { kind: 'bot'; species: string }
  | { kind: 'energy'; amount: number }
  | { kind: 'cosmetic'; id: string; name: string };

export interface PassTier {
  tier: number;
  free: PassReward;
  holder: PassReward;
}

export const SEASON = {
  id: 1,
  name: 'Season 1 · Spikes Rising',
  start: Date.UTC(2026, 9, 6),
  end: Date.UTC(2026, 10, 3),
};

/** Variant gear sets on the pass: tier -> [gear id, name]. */
export const FREE_GEAR: Record<number, [string, string]> = { 3: ['runner', 'Speed Runner'], 6: ['forest', 'Forest Ranger'], 12: ['desert', 'Desert Nomad'], 18: ['ocean', 'Ocean Diver'], 24: ['cyber', 'Cyber Ninja'] };
export const HOLDER_GEAR: Record<number, [string, string]> = { 5: ['hoodie', 'Cozy Hoodie'], 10: ['space', 'Space Explorer'], 15: ['ice', 'Ice Guardian'], 25: ['crystal', 'Crystal Mage'] };

export const PASS: PassTier[] = Array.from({ length: PASS_TIERS }, (_, i) => {
  const t = i + 1;
  const free: PassReward =
    FREE_GEAR[t] ? { kind: 'cosmetic', id: `gear-${FREE_GEAR[t][0]}`, name: `${FREE_GEAR[t][1]} gear` }
    : t % 10 === 0 ? { kind: 'bot', species: t === 30 ? 'zap' : 'drip' }
    : t % 3 === 0 ? { kind: 'energy', amount: 300 }
    : { kind: 'sparks', amount: 250 + t * 40 };
  const holder: PassReward =
    HOLDER_GEAR[t] ? { kind: 'cosmetic', id: `gear-${HOLDER_GEAR[t][0]}`, name: `${HOLDER_GEAR[t][1]} gear` }
    : t === 30 ? { kind: 'cosmetic', id: 'frame-mythic', name: 'Season Crown Frame' }
    : t === 20 ? { kind: 'bot', species: 'cinder' }
    : t % 5 === 0 ? { kind: 'cosmetic', id: `trail-s1-${t}`, name: ['Ember Trail', 'Tide Trail', 'Moss Trail', 'Void Trail'][(t / 5 - 1) % 4] }
    : { kind: 'sparks', amount: 500 + t * 80 };
  return { tier: t, free, holder };
});

export function passTier(passXp: number): { tier: number; into: number } {
  const tier = Math.min(PASS_TIERS, Math.floor(passXp / PASS_XP_PER_TIER));
  return { tier, into: passXp - tier * PASS_XP_PER_TIER };
}
