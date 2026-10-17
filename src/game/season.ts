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

export const PASS: PassTier[] = Array.from({ length: PASS_TIERS }, (_, i) => {
  const t = i + 1;
  const free: PassReward =
    t === 3 ? { kind: 'cosmetic', id: 'gear-runner', name: 'Speed Runner gear' }
    : t % 10 === 0 ? { kind: 'bot', species: t === 30 ? 'zap' : 'drip' }
    : t % 3 === 0 ? { kind: 'energy', amount: 300 }
    : { kind: 'sparks', amount: 250 + t * 40 };
  const holder: PassReward =
    t === 5 ? { kind: 'cosmetic', id: 'gear-hoodie', name: 'Cozy Hoodie gear' }
    : t === 10 ? { kind: 'cosmetic', id: 'gear-space', name: 'Space Explorer gear' }
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
