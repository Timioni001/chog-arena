export const MAX_LEVEL = 50;

/** XP needed to go from `level` to `level + 1`. Smooth early, steeper late. */
export function xpForLevel(level: number): number {
  return Math.round(60 * level ** 1.45 + 40);
}

export function addXp(level: number, xp: number, gained: number): { level: number; xp: number; levelsGained: number; skillPoints: number } {
  let l = level, x = xp + gained, gainedLevels = 0;
  while (l < MAX_LEVEL && x >= xpForLevel(l)) {
    x -= xpForLevel(l);
    l++;
    gainedLevels++;
  }
  if (l >= MAX_LEVEL) x = 0;
  return { level: l, xp: x, levelsGained: gainedLevels, skillPoints: gainedLevels };
}

/** Ascension tiers change the 3D look (aura rings, crown spikes, sparkle trail). */
export const ASCENSIONS = [
  { level: 1, name: 'Hatchling', ring: 0 },
  { level: 10, name: 'Spiker', ring: 1 },
  { level: 20, name: 'Bristle Knight', ring: 2 },
  { level: 35, name: 'Storm Quill', ring: 3 },
  { level: 50, name: 'Arch Chog', ring: 4 },
] as const;

export function ascensionFor(level: number) {
  let a: (typeof ASCENSIONS)[number] = ASCENSIONS[0];
  for (const x of ASCENSIONS) if (level >= x.level) a = x;
  return a;
}

// ------------------------------------------------------------------ skill tree

export type Branch = 'attack' | 'defense' | 'economy';

export interface SkillNode {
  id: string;
  branch: Branch;
  name: string;
  text: string;
  maxRank: number;
  requires?: string;
  /** Effect per rank. */
  effect:
    | { kind: 'stat'; stat: 'power' | 'speed' | 'guard' | 'luck' | 'focus'; perRank: number }
    | { kind: 'tapPower'; perRank: number }
    | { kind: 'energyCap'; perRank: number }
    | { kind: 'regen'; perRank: number }
    | { kind: 'offlineHours'; perRank: number }
    | { kind: 'botYield'; perRank: number }
    | { kind: 'critTap'; perRank: number };
}

export const SKILL_TREE: SkillNode[] = [
  { id: 'a1', branch: 'attack', name: 'Sharp Quills', text: '+2 Power per rank', maxRank: 3, effect: { kind: 'stat', stat: 'power', perRank: 2 } },
  { id: 'a2', branch: 'attack', name: 'Quick Paws', text: '+2 Speed per rank', maxRank: 3, requires: 'a1', effect: { kind: 'stat', stat: 'speed', perRank: 2 } },
  { id: 'a3', branch: 'attack', name: 'Lucky Spikes', text: '+2 Luck per rank', maxRank: 3, requires: 'a2', effect: { kind: 'stat', stat: 'luck', perRank: 2 } },
  { id: 'a4', branch: 'attack', name: 'Heavy Bonk', text: '+3 Power per rank', maxRank: 2, requires: 'a3', effect: { kind: 'stat', stat: 'power', perRank: 3 } },
  { id: 'd1', branch: 'defense', name: 'Thick Fur', text: '+2 Guard per rank', maxRank: 3, effect: { kind: 'stat', stat: 'guard', perRank: 2 } },
  { id: 'd2', branch: 'defense', name: 'Calm Mind', text: '+2 Focus per rank', maxRank: 3, requires: 'd1', effect: { kind: 'stat', stat: 'focus', perRank: 2 } },
  { id: 'd3', branch: 'defense', name: 'Spine Wall', text: '+3 Guard per rank', maxRank: 2, requires: 'd2', effect: { kind: 'stat', stat: 'guard', perRank: 3 } },
  { id: 'd4', branch: 'defense', name: 'Deep Breath', text: '+3 Focus per rank', maxRank: 2, requires: 'd3', effect: { kind: 'stat', stat: 'focus', perRank: 3 } },
  { id: 'e1', branch: 'economy', name: 'Strong Taps', text: '+1 Spark per tap per rank', maxRank: 5, effect: { kind: 'tapPower', perRank: 1 } },
  { id: 'e2', branch: 'economy', name: 'Big Battery', text: '+150 energy cap per rank', maxRank: 4, requires: 'e1', effect: { kind: 'energyCap', perRank: 150 } },
  { id: 'e3', branch: 'economy', name: 'Fast Charge', text: '+0.5 energy/s per rank', maxRank: 4, requires: 'e2', effect: { kind: 'regen', perRank: 0.5 } },
  { id: 'e4', branch: 'economy', name: 'Bot Tuning', text: '+8% bot yield per rank', maxRank: 4, requires: 'e2', effect: { kind: 'botYield', perRank: 0.08 } },
  { id: 'e5', branch: 'economy', name: 'Night Shift', text: '+1h offline earnings cap per rank', maxRank: 3, requires: 'e4', effect: { kind: 'offlineHours', perRank: 1 } },
  { id: 'e6', branch: 'economy', name: 'Crit Fingers', text: '+2% tap crit per rank', maxRank: 3, requires: 'e3', effect: { kind: 'critTap', perRank: 0.02 } },
];

export type SkillRanks = Record<string, number>;

export function canRankUp(ranks: SkillRanks, nodeId: string, points: number): boolean {
  const node = SKILL_TREE.find((n) => n.id === nodeId);
  if (!node || points <= 0) return false;
  if ((ranks[nodeId] ?? 0) >= node.maxRank) return false;
  if (node.requires && (ranks[node.requires] ?? 0) < 1) return false;
  return true;
}

export function skillTotals(ranks: SkillRanks) {
  const out = { stats: { power: 0, speed: 0, guard: 0, luck: 0, focus: 0 }, tapPower: 0, energyCap: 0, regen: 0, offlineHours: 0, botYield: 0, critTap: 0 };
  for (const node of SKILL_TREE) {
    const r = ranks[node.id] ?? 0;
    if (!r) continue;
    const e = node.effect;
    if (e.kind === 'stat') out.stats[e.stat] += e.perRank * r;
    else out[e.kind] += e.perRank * r;
  }
  return out;
}
