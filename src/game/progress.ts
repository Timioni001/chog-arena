import { BOT_SPECIES, botYield, canMerge, mergeCost, MAX_BOT_LEVEL, type OwnedBot } from './bots';
import { addXp, canRankUp, skillTotals, type SkillRanks } from './progression';
import { COMBO_REWARD, COMBO_TRIES, dailyCombo, dailyQuests, dayKey, nextStreak, scoreCombo, weekKey, type ComboMark, type ComboSymbol, type QuestKind } from './daily';
import { PASS, PASS_XP_PER_TIER, passTier, SEASON } from './season';
import { START_MMR, updateMmr } from './mmr';
import { offlineEarnings, regenEnergy, comboMultiplier } from './tap';

/** Everything a Chog has earned. Keyed by token id, so it travels with the NFT. */
export interface Progress {
  version: 1;
  updatedAt: number;
  level: number;
  xp: number;
  skillPoints: number;
  skills: SkillRanks;
  sparks: number;
  lifetimeSparks: number;
  energy: number;
  energyAt: number;
  lastSeen: number;
  taps: number;
  bots: OwnedBot[];
  equipped: string[];
  mmr: number;
  games: number;
  wins: number;
  streakWins: number;
  bestStreak: number;
  weekly: { week: string; points: number; wins: number };
  seasonPoints: number;
  campaign: Record<string, number>;
  quests: { day: string; progress: Partial<Record<QuestKind, number>>; claimed: string[] };
  checkin: { last: string | null; streak: number };
  combo: { day: string; guesses: { guess: ComboSymbol[]; marks: ComboMark[] }[]; solved: boolean };
  pass: { season: number; xp: number; free: number[]; holder: number[] };
  history: MatchSummary[];
  cosmetics: string[];
  /** Clan chest milestones already claimed, as "<season>:<points>". */
  clanChest?: string[];
  /** Daily boosts used. */
  boosts?: { day: string; refill: number; turbo: number };
  /** Referral reward tiers already claimed. */
  refClaimed?: number[];
  /** Equipped gear set (cosmetic), e.g. "runner". */
  gear?: string | null;
  nextBotUid: number;
  /** Sources/sinks ledger for the economy dashboard. */
  ledger: Record<string, number>;
}

export interface MatchSummary {
  id: string;
  at: number;
  mode: 'ranked' | 'campaign' | 'practice' | 'challenge';
  opponent: string;
  won: boolean | null;
  score: number;
  mmrDelta: number;
  lanes: (0 | 1 | null)[];
}

export function newProgress(now = Date.now()): Progress {
  return {
    version: 1,
    updatedAt: now,
    level: 1,
    xp: 0,
    skillPoints: 0,
    skills: {},
    sparks: 500,
    lifetimeSparks: 0,
    energy: 500,
    energyAt: now,
    lastSeen: now,
    taps: 0,
    bots: [{ uid: 'b1', species: 'pip', level: 1 }],
    equipped: ['b1'],
    mmr: START_MMR,
    games: 0,
    wins: 0,
    streakWins: 0,
    bestStreak: 0,
    weekly: { week: weekKey(now), points: 0, wins: 0 },
    seasonPoints: 0,
    campaign: {},
    quests: { day: dayKey(now), progress: {}, claimed: [] },
    checkin: { last: null, streak: 0 },
    combo: { day: dayKey(now), guesses: [], solved: false },
    pass: { season: SEASON.id, xp: 0, free: [], holder: [] },
    history: [],
    cosmetics: [],
    nextBotUid: 2,
    ledger: {},
  };
}

function touch(p: Progress, now: number): Progress {
  const day = dayKey(now);
  const week = weekKey(now);
  let next = { ...p, updatedAt: now };
  if (next.quests.day !== day) next = { ...next, quests: { day, progress: {}, claimed: [] } };
  if (next.combo.day !== day) next = { ...next, combo: { day, guesses: [], solved: false } };
  if (next.weekly.week !== week) next = { ...next, weekly: { week, points: 0, wins: 0 } };
  return next;
}

function earn(p: Progress, amount: number, source: string): Progress {
  return {
    ...p,
    sparks: p.sparks + amount,
    lifetimeSparks: p.lifetimeSparks + Math.max(0, amount),
    ledger: { ...p.ledger, [source]: (p.ledger[source] ?? 0) + amount },
    quests: amount > 0 ? bumpQuest(p.quests, 'sparks', amount) : p.quests,
  };
}

function spend(p: Progress, amount: number, sink: string): Progress | null {
  if (p.sparks < amount) return null;
  return { ...p, sparks: p.sparks - amount, ledger: { ...p.ledger, [sink]: (p.ledger[sink] ?? 0) - amount } };
}

function bumpQuest(q: Progress['quests'], kind: QuestKind, by: number): Progress['quests'] {
  return { ...q, progress: { ...q.progress, [kind]: (q.progress[kind] ?? 0) + by } };
}

function gainXp(p: Progress, xp: number): { p: Progress; levelsGained: number } {
  const r = addXp(p.level, p.xp, xp);
  return { p: { ...p, level: r.level, xp: r.xp, skillPoints: p.skillPoints + r.skillPoints }, levelsGained: r.levelsGained };
}

// ------------------------------------------------------------------ energy & taps

export interface EnergyRules {
  cap: number;
  regenPerSec: number;
  tapPower: number;
  critChance: number;
}

export function currentEnergy(p: Progress, rules: EnergyRules, now: number): number {
  return Math.floor(regenEnergy(p.energy, rules.cap, rules.regenPerSec, now - p.energyAt));
}

export interface TapOutcome {
  p: Progress;
  gained: number;
  crit: boolean;
  ok: boolean;
}

/** One tap. `roll` is a 0..1 random number supplied by the caller (crit roll). */
export function applyTap(p0: Progress, rules: EnergyRules, combo: number, boost: number, roll: number, now: number): TapOutcome {
  const p = touch(p0, now);
  const energy = currentEnergy(p, rules, now);
  if (energy < 1) return { p, gained: 0, crit: false, ok: false };
  const crit = roll < rules.critChance;
  const gained = Math.round(rules.tapPower * comboMultiplier(combo) * boost * (crit ? 5 : 1));
  let next: Progress = { ...p, energy: energy - 1, energyAt: now, taps: p.taps + 1, quests: bumpQuest(p.quests, 'taps', 1) };
  next = earn(next, gained, 'taps');
  return { p: next, gained, crit, ok: true };
}

export function passiveRate(p: Progress, yieldBonus: number): number {
  return p.bots.filter((b) => p.equipped.includes(b.uid)).reduce((s, b) => s + botYield(b, yieldBonus), 0);
}

export function collectOffline(p0: Progress, yieldBonus: number, capHours: number, now: number): { p: Progress; earned: number; hours: number } {
  const p = touch(p0, now);
  const elapsed = Math.max(0, now - p.lastSeen);
  const rate = passiveRate(p, yieldBonus);
  const earned = offlineEarnings(rate, elapsed, capHours);
  // Only advance the clock by the time actually paid out, so frequent ticks never lose fractions.
  const capped = elapsed >= capHours * 3_600_000;
  const lastSeen = rate <= 0 || capped ? now : p.lastSeen + Math.floor((earned * 3_600_000) / rate);
  const next = earned > 0 ? earn({ ...p, lastSeen }, earned, 'bots') : { ...p, lastSeen };
  return { p: next, earned, hours: Math.min(capHours, elapsed / 3_600_000) };
}

// ------------------------------------------------------------------ bots

export function buyBot(p: Progress, speciesId: string, now: number): Progress | null {
  const s = BOT_SPECIES.find((x) => x.id === speciesId);
  if (!s) return null;
  const paid = spend(touch(p, now), s.price, 'shop:bots');
  if (!paid) return null;
  return { ...paid, bots: [...paid.bots, { uid: `b${paid.nextBotUid}`, species: s.id, level: 1 }], nextBotUid: paid.nextBotUid + 1 };
}

export function grantBot(p: Progress, speciesId: string): Progress {
  return { ...p, bots: [...p.bots, { uid: `b${p.nextBotUid}`, species: speciesId, level: 1 }], nextBotUid: p.nextBotUid + 1 };
}

export function mergeBots(p0: Progress, a: string, b: string, now: number): Progress | null {
  const p = touch(p0, now);
  const A = p.bots.find((x) => x.uid === a), B = p.bots.find((x) => x.uid === b);
  if (!A || !B || !canMerge(A, B) || A.level >= MAX_BOT_LEVEL) return null;
  const paid = spend(p, mergeCost(A.level), 'merge');
  if (!paid) return null;
  const merged: OwnedBot = { uid: A.uid, species: A.species, level: A.level + 1 };
  return {
    ...paid,
    bots: paid.bots.filter((x) => x.uid !== b).map((x) => (x.uid === a ? merged : x)),
    equipped: paid.equipped.filter((u) => u !== b),
    quests: bumpQuest(paid.quests, 'merge', 1),
  };
}

export function equipBot(p: Progress, uid: string, slots: number): Progress | null {
  if (!p.bots.some((b) => b.uid === uid) || p.equipped.includes(uid)) return null;
  const equipped = [...p.equipped, uid];
  while (equipped.length > slots) equipped.shift();
  return { ...p, equipped };
}

export function unequipBot(p: Progress, uid: string): Progress {
  return { ...p, equipped: p.equipped.filter((u) => u !== uid) };
}

/** Sell a bot back for 30% of its list price: a soft sink against hoarding. */
export function scrapBot(p: Progress, uid: string): Progress | null {
  const b = p.bots.find((x) => x.uid === uid);
  if (!b || p.bots.length <= 1) return null;
  const s = BOT_SPECIES.find((x) => x.id === b.species)!;
  const refund = Math.round(s.price * 0.3 * b.level);
  return earn({ ...p, bots: p.bots.filter((x) => x.uid !== uid), equipped: p.equipped.filter((u) => u !== uid) }, refund, 'scrap');
}

// ------------------------------------------------------------------ skills

export function rankSkill(p: Progress, nodeId: string): Progress | null {
  if (!canRankUp(p.skills, nodeId, p.skillPoints)) return null;
  return { ...p, skillPoints: p.skillPoints - 1, skills: { ...p.skills, [nodeId]: (p.skills[nodeId] ?? 0) + 1 } };
}

export function respec(p: Progress): Progress | null {
  const refunded = Object.values(p.skills).reduce((a, b) => a + b, 0);
  const cost = 1000 + p.level * 100;
  const paid = spend(p, cost, 'respec');
  if (!paid || refunded === 0) return null;
  return { ...paid, skills: {}, skillPoints: p.skillPoints + refunded };
}

export { skillTotals };

// ------------------------------------------------------------------ matches

export interface MatchReward {
  sparks: number;
  xp: number;
  mmrDelta: number;
  levelsGained: number;
  passXp: number;
}

export function recordMatch(
  p0: Progress,
  m: { id: string; mode: MatchSummary['mode']; opponent: string; opponentMmr: number; won: boolean | null; score: number; lanes: (0 | 1 | null)[]; elementLaneWin: boolean; stageId?: string; stageReward?: { sparks: number; xp: number } },
  now: number,
): { p: Progress; reward: MatchReward } {
  let p = touch(p0, now);
  const outcome = m.won === null ? 0.5 : m.won ? 1 : 0;
  let mmrDelta = 0;
  if (m.mode === 'ranked') {
    const mmr = updateMmr(p.mmr, m.opponentMmr, outcome as 0 | 0.5 | 1, p.games);
    mmrDelta = mmr - p.mmr;
    p = { ...p, mmr, seasonPoints: p.seasonPoints + m.score, weekly: { ...p.weekly, points: p.weekly.points + m.score, wins: p.weekly.wins + (m.won ? 1 : 0) } };
  }
  const streakWins = m.won ? p.streakWins + 1 : 0;
  p = { ...p, games: p.games + 1, wins: p.wins + (m.won ? 1 : 0), streakWins, bestStreak: Math.max(p.bestStreak, streakWins) };

  let sparks = m.won ? 400 : m.won === null ? 200 : 120;
  let xp = m.won ? 80 : 35;
  if (m.mode === 'practice') { sparks = Math.round(sparks / 4); xp = Math.round(xp / 2); }
  if (m.mode === 'ranked') { sparks += Math.min(300, streakWins * 50); }
  if (m.mode === 'campaign' && m.won && m.stageId) {
    const first = !p.campaign[m.stageId];
    if (first && m.stageReward) { sparks += m.stageReward.sparks; xp += m.stageReward.xp; }
    // Stars: one per lane won, plus one for a dominant score.
    const stars = Math.max(1, Math.min(3, m.lanes.filter((l) => l === 0).length + (m.score >= 150 ? 1 : 0)));
    p = { ...p, campaign: { ...p.campaign, [m.stageId]: Math.max(p.campaign[m.stageId] ?? 0, stars) } };
  }
  p = earn(p, sparks, `battle:${m.mode}`);
  const g = gainXp(p, xp);
  p = g.p;
  let quests = bumpQuest(p.quests, 'battles', 1);
  if (m.won) quests = bumpQuest(quests, 'wins', 1);
  if (m.mode === 'campaign' && m.won) quests = bumpQuest(quests, 'campaign', 1);
  if (m.elementLaneWin) quests = bumpQuest(quests, 'elementWin', 1);
  const passXp = m.won ? 60 : 25;
  p = { ...p, quests, pass: { ...p.pass, xp: p.pass.xp + passXp } };
  const summary: MatchSummary = { id: m.id, at: now, mode: m.mode, opponent: m.opponent, won: m.won, score: m.score, mmrDelta, lanes: m.lanes };
  p = { ...p, history: [summary, ...p.history].slice(0, 30) };
  return { p, reward: { sparks, xp, mmrDelta, levelsGained: g.levelsGained, passXp } };
}

// ------------------------------------------------------------------ daily

export function claimQuest(p0: Progress, questId: string, now: number): Progress | null {
  const p = touch(p0, now);
  const q = dailyQuests(p.quests.day).find((x) => x.id === questId);
  if (!q || p.quests.claimed.includes(q.id)) return null;
  if ((p.quests.progress[q.kind] ?? 0) < q.goal) return null;
  let next = earn({ ...p, quests: { ...p.quests, claimed: [...p.quests.claimed, q.id] } }, q.reward.sparks, 'quests');
  next = gainXp(next, q.reward.xp).p;
  return { ...next, pass: { ...next.pass, xp: next.pass.xp + q.reward.passXp } };
}

export function checkIn(p0: Progress, now: number): { p: Progress; reward: number } | null {
  const p = touch(p0, now);
  const r = nextStreak(p.checkin.last, p.checkin.streak, dayKey(now));
  if (r.already) return null;
  return { p: earn({ ...p, checkin: { last: dayKey(now), streak: r.streak } }, r.reward, 'checkin'), reward: r.reward };
}

export function guessCombo(p0: Progress, guess: ComboSymbol[], now: number): { p: Progress; marks: ComboMark[]; solved: boolean } | null {
  const p = touch(p0, now);
  if (p.combo.solved || p.combo.guesses.length >= COMBO_TRIES || guess.length !== 3 || new Set(guess).size !== 3) return null;
  const marks = scoreCombo(dailyCombo(p.combo.day), guess);
  const solved = marks.every((m) => m === 'hit');
  let next: Progress = { ...p, combo: { ...p.combo, guesses: [...p.combo.guesses, { guess, marks }], solved } };
  if (solved) {
    // Fewer guesses, bigger prize.
    const prize = Math.round(COMBO_REWARD * (1 - (next.combo.guesses.length - 1) * 0.2));
    next = earn(next, prize, 'combo');
  }
  return { p: next, marks, solved };
}

export function claimPass(p: Progress, tier: number, track: 'free' | 'holder', isHolder: boolean): Progress | null {
  if (track === 'holder' && !isHolder) return null;
  const reached = passTier(p.pass.xp).tier;
  if (tier < 1 || tier > reached) return null;
  if (p.pass[track].includes(tier)) return null;
  const reward = PASS[tier - 1][track];
  let next: Progress = { ...p, pass: { ...p.pass, [track]: [...p.pass[track], tier] } };
  switch (reward.kind) {
    case 'sparks': next = earn(next, reward.amount, 'pass'); break;
    case 'energy': next = { ...next, energy: next.energy + reward.amount }; break;
    case 'bot': next = grantBot(next, reward.species); break;
    case 'cosmetic': next = { ...next, cosmetics: [...new Set([...next.cosmetics, reward.id])] }; break;
  }
  return next;
}

export const CLAN_CHEST: { at: number; sparks: number; cosmetic?: string }[] = [
  { at: 1_000, sparks: 1_000 },
  { at: 5_000, sparks: 2_500 },
  { at: 20_000, sparks: 6_000 },
  { at: 60_000, sparks: 15_000, cosmetic: 'frame-clan' },
];

/** Claim a clan chest milestone once per season. `clanPoints` comes from the server's clan board. */
export function claimClanChest(p: Progress, season: number, at: number, clanPoints: number): Progress | null {
  const tier = CLAN_CHEST.find((c) => c.at === at);
  const key = `${season}:${at}`;
  if (!tier || clanPoints < at || (p.clanChest ?? []).includes(key)) return null;
  const next = earn({ ...p, clanChest: [...(p.clanChest ?? []), key] }, tier.sparks, 'clanChest');
  return tier.cosmetic ? { ...next, cosmetics: [...new Set([...next.cosmetics, tier.cosmetic])] } : next;
}

// ------------------------------------------------------------------ boosts

export const BOOSTS_PER_DAY = { refill: 3, turbo: 3 } as const;
export const TURBO_MS = 20_000;
export const TURBO_MULT = 3;

export function boostsLeft(p: Progress, now = Date.now()): { refill: number; turbo: number } {
  const b = p.boosts && p.boosts.day === dayKey(now) ? p.boosts : { refill: 0, turbo: 0 };
  return { refill: BOOSTS_PER_DAY.refill - b.refill, turbo: BOOSTS_PER_DAY.turbo - b.turbo };
}

/** Full Tank: refill energy to the cap. */
export function boostRefill(p0: Progress, rules: EnergyRules, now: number): Progress | null {
  const p = touch(p0, now);
  const left = boostsLeft(p, now);
  if (left.refill <= 0 || currentEnergy(p, rules, now) >= rules.cap) return null;
  const used = p.boosts && p.boosts.day === dayKey(now) ? p.boosts : { day: dayKey(now), refill: 0, turbo: 0 };
  return { ...p, energy: rules.cap, energyAt: now, boosts: { ...used, refill: used.refill + 1 } };
}

/** Turbo: ×3 Sparks per tap for 20 seconds. The caller tracks the end time. */
export function boostTurbo(p0: Progress, now: number): Progress | null {
  const p = touch(p0, now);
  if (boostsLeft(p, now).turbo <= 0) return null;
  const used = p.boosts && p.boosts.day === dayKey(now) ? p.boosts : { day: dayKey(now), refill: 0, turbo: 0 };
  return { ...p, boosts: { ...used, turbo: used.turbo + 1 } };
}

// ------------------------------------------------------------------ referrals

/** Referral rewards are energy and cosmetics only: never $CHOG. */
export const REF_TIERS: { count: number; energy: number; cosmetic?: string; label: string }[] = [
  { count: 1, energy: 500, label: '+500 energy' },
  { count: 3, energy: 1_000, cosmetic: 'frame-friend', label: '+1,000 energy & Friend frame' },
  { count: 10, energy: 2_500, cosmetic: 'trail-crew', label: '+2,500 energy & Crew trail' },
];

export function claimReferral(p: Progress, count: number, verified: number): Progress | null {
  const tier = REF_TIERS.find((t) => t.count === count);
  if (!tier || verified < count || (p.refClaimed ?? []).includes(count)) return null;
  const cosmetics = tier.cosmetic ? [...new Set([...p.cosmetics, tier.cosmetic])] : p.cosmetics;
  return { ...p, energy: p.energy + tier.energy, cosmetics, refClaimed: [...(p.refClaimed ?? []), count] };
}

/** Welcome gift for someone who arrived through an invite link. */
export const INVITEE_ENERGY = 300;

export function equipGear(p: Progress, gear: string | null): Progress | null {
  if (gear !== null && !p.cosmetics.includes(`gear-${gear}`)) return null;
  return { ...p, gear };
}

export { PASS_XP_PER_TIER };
