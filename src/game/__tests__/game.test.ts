import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, DECK_SIZE, MAX_TURNS, IllegalPlayError, lanePower, type Fighter } from '../battle';
import { choosePlays } from '../ai';
import { buildDeck, buildProfile, guestProfile, holdingsMultiplier, profileForToken } from '../chog';
import { COLLECTION, traitsOf } from '../collection';
import { canMerge, botYield } from '../bots';
import { addXp, canRankUp, skillTotals } from '../progression';
import { dailyCombo, scoreCombo, nextStreak, dailyQuests } from '../daily';
import { updateMmr, leagueFor } from '../mmr';
import { replayMatch } from '../match';
import { createRng } from '../rng';

function fighter(tokenId: number | null): Fighter {
  const p = tokenId === null ? guestProfile() : profileForToken(tokenId);
  return { id: String(tokenId ?? 'guest'), name: p.name, stats: p.stats, deck: buildDeck(p, []), element: p.element };
}

describe('collection index', () => {
  it('matches onchain supply and has every token', () => {
    expect(COLLECTION.supply).toBe(1969);
    expect(COLLECTION.tokens.length).toBe(1969);
    expect(COLLECTION.contract.toLowerCase()).toBe('0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763');
  });
  it('trait counts add up to supply in every category', () => {
    for (const t of COLLECTION.types) expect(COLLECTION.counts[t].reduce((a, b) => a + b, 0)).toBe(COLLECTION.supply);
  });
  it('ranks are a permutation', () => {
    expect(new Set(COLLECTION.ranks).size).toBe(COLLECTION.supply);
  });
});

describe('chog profiles', () => {
  it('builds a profile and a 12-card deck for every token', () => {
    for (let id = 1; id <= COLLECTION.supply; id++) {
      const p = profileForToken(id);
      const deck = buildDeck(p, []);
      expect(deck).toHaveLength(DECK_SIZE);
      expect(p.traitCards.length).toBeGreaterThanOrEqual(4);
      for (const v of Object.values(p.stats)) expect(v).toBeGreaterThan(0);
    }
  });
  it('maps tiers to archetypes from real traits', () => {
    const skull = Array.from({ length: COLLECTION.supply }, (_, i) => i + 1).find((id) => traitsOf(id).some((t) => t.type === 'Base' && t.value === 'Skull'))!;
    expect(profileForToken(skull).archetype).toBe('Skull');
    expect(profileForToken(561).archetype).toBe('1:1');
    expect(profileForToken(561).title).toBe('Blaze');
  });
  it('guests are weaker than holders on average', () => {
    const g = guestProfile();
    const sum = (s: Record<string, number>) => Object.values(s).reduce((a, b) => a + b, 0);
    const avg = Array.from({ length: 50 }, (_, i) => sum(profileForToken(i * 39 + 1).stats)).reduce((a, b) => a + b) / 50;
    expect(sum(g.stats)).toBeLessThan(avg);
  });
  it('caps holdings + tier bonus at 15%', () => {
    for (const tier of ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']) {
      const p = buildProfile({ tokenId: 1, traits: traitsOf(1), tier });
      const tierMul = { Common: 1, Uncommon: 1.03, Rare: 1.06, Epic: 1.09, Legendary: 1.12 }[tier]!;
      expect(tierMul * holdingsMultiplier(50, p.tier)).toBeLessThanOrEqual(1.15 + 1e-9);
    }
  });
});

describe('battle engine', () => {
  it('runs a full AI vs AI match to a result', () => {
    const s = createBattle('seed-1', fighter(1462), fighter(900));
    for (let t = 0; t < MAX_TURNS; t++) resolveTurn(s, choosePlays(s, 0), choosePlays(s, 1));
    expect(s.result).not.toBeNull();
    expect(s.history).toHaveLength(MAX_TURNS);
  });
  it('is deterministic for the same seed and plays', () => {
    const run = () => {
      const s = createBattle('det', fighter(10), fighter(20));
      for (let t = 0; t < MAX_TURNS; t++) resolveTurn(s, choosePlays(s, 0, 'master'), choosePlays(s, 1, 'adept'));
      return JSON.stringify(s.result);
    };
    expect(run()).toBe(run());
  });
  it('rejects illegal plays', () => {
    const s = createBattle('illegal', fighter(1), fighter(2));
    expect(() => resolveTurn(s, [{ uid: 9999, lane: 0 }], [])).toThrow(IllegalPlayError);
    const expensive = s.sides[0].hand.find((c) => c.def.cost > 1);
    if (expensive) expect(() => resolveTurn(s, [{ uid: expensive.uid, lane: 0 }], [])).toThrow(IllegalPlayError);
  });
  it('AI crushes a player who never plays', () => {
    let wins = 0;
    for (let i = 0; i < 20; i++) {
      const s = createBattle(`ai-${i}`, fighter(100 + i), fighter(100 + i));
      for (let t = 0; t < MAX_TURNS; t++) resolveTurn(s, choosePlays(s, 0, 'master'), []);
      if (s.result!.winner === 0) wins++;
    }
    expect(wins).toBe(20);
  });
  it('lane power never goes negative', () => {
    const s = createBattle('neg', fighter(5), fighter(6));
    for (let t = 0; t < MAX_TURNS; t++) resolveTurn(s, choosePlays(s, 0), choosePlays(s, 1));
    for (let l = 0; l < 3; l++) for (const side of [0, 1] as const) expect(lanePower(s, side, l)).toBeGreaterThanOrEqual(0);
  });
});

describe('server replay', () => {
  it('replays a recorded match to the same result', () => {
    const a = fighter(77), b = fighter(1500);
    const s = createBattle('replay-me', a, b);
    const plays = [];
    for (let t = 0; t < MAX_TURNS; t++) {
      const mine = choosePlays(s, 0, 'adept');
      plays.push(mine);
      resolveTurn(s, mine, choosePlays(s, 1, 'adept'));
    }
    const replay = replayMatch({ seed: 'replay-me', player: a, opponent: b, opponentLevel: 'adept', plays });
    expect(replay.result).toEqual(s.result);
  });
  it('rejects a tampered log', () => {
    const a = fighter(77), b = fighter(1500);
    expect(() => replayMatch({ seed: 'x', player: a, opponent: b, opponentLevel: 'adept', plays: [[{ uid: 424242, lane: 1 }]] })).toThrow();
  });
});

describe('economy & progression', () => {
  it('merges only matching bots', () => {
    expect(canMerge({ uid: 'a', species: 'pip', level: 2 }, { uid: 'b', species: 'pip', level: 2 })).toBe(true);
    expect(canMerge({ uid: 'a', species: 'pip', level: 2 }, { uid: 'b', species: 'pip', level: 3 })).toBe(false);
    expect(canMerge({ uid: 'a', species: 'pip', level: 2 }, { uid: 'a', species: 'pip', level: 2 })).toBe(false);
    expect(botYield({ uid: 'a', species: 'pip', level: 4 })).toBeGreaterThan(botYield({ uid: 'a', species: 'pip', level: 1 }));
  });
  it('levels up with xp', () => {
    const r = addXp(1, 0, 10_000);
    expect(r.level).toBeGreaterThan(5);
    expect(r.skillPoints).toBe(r.level - 1);
  });
  it('skill prerequisites hold', () => {
    expect(canRankUp({}, 'a2', 3)).toBe(false);
    expect(canRankUp({ a1: 1 }, 'a2', 3)).toBe(true);
    expect(skillTotals({ a1: 2, e1: 3 }).stats.power).toBe(4);
  });
  it('daily combo feedback works', () => {
    const ans = dailyCombo('2026-10-17');
    expect(new Set(ans).size).toBe(3);
    expect(scoreCombo(ans, ans)).toEqual(['hit', 'hit', 'hit']);
    expect(scoreCombo(ans, [ans[1], ans[2], ans[0]])).toEqual(['near', 'near', 'near']);
  });
  it('streaks continue and reset', () => {
    expect(nextStreak('2026-10-16', 3, '2026-10-17').streak).toBe(4);
    expect(nextStreak('2026-10-10', 3, '2026-10-17').streak).toBe(1);
    expect(nextStreak('2026-10-17', 3, '2026-10-17').already).toBe(true);
  });
  it('quests rotate deterministically', () => {
    expect(dailyQuests('2026-10-17')).toEqual(dailyQuests('2026-10-17'));
    expect(dailyQuests('2026-10-17')).toHaveLength(3);
  });
  it('mmr moves toward the expected result', () => {
    expect(updateMmr(1000, 1000, 1, 0)).toBeGreaterThan(1000);
    expect(updateMmr(1000, 1000, 0, 0)).toBeLessThan(1000);
    expect(leagueFor(1950).name).toBe('Mythic');
  });
  it('rng is seeded', () => {
    expect(createRng('a').next()).toBe(createRng('a').next());
    expect(createRng('a').next()).not.toBe(createRng('b').next());
  });
});
