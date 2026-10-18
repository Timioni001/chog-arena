import {
  LANES,
  MAX_TURNS,
  cardPower,
  cloneBattle,
  energyFor,
  laneCapacity,
  lanePower,
  type BattleState,
  type CardInstance,
  type Play,
} from './battle';
import { createRng } from './rng';

export type AiLevel = 'rookie' | 'adept' | 'master';

/**
 * Deterministic opponent. It reads only public info plus its own hand, scores candidate plays with a
 * one-turn lookahead, and uses a per-turn RNG stream derived from the battle seed so the server can
 * replay exactly what the client saw.
 */
export function choosePlays(state: BattleState, side: 0 | 1, level: AiLevel = 'adept'): Play[] {
  const rng = createRng(`${state.seed}:ai:${side}:${state.turn}`);
  const s = state.sides[side];
  const energy = energyFor(state, side);
  const hand = s.hand.slice().sort((a, b) => b.def.cost - a.def.cost || b.def.power - a.def.power);

  // Enumerate affordable subsets (hand ≤ 7, so ≤ 128).
  const subsets: CardInstance[][] = [];
  const n = hand.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    let cost = 0;
    const pick: CardInstance[] = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) { cost += hand[i].def.cost; pick.push(hand[i]); }
    if (cost <= energy) subsets.push(pick);
  }
  if (subsets.length === 0) return [];

  // Prefer spending energy; keep the best ~24 by total cost then power.
  subsets.sort((a, b) => sum(b, (c) => c.def.cost) - sum(a, (c) => c.def.cost) || sum(b, (c) => c.def.power) - sum(a, (c) => c.def.power));
  const candidates = subsets.slice(0, level === 'rookie' ? 6 : 24);

  let best: Play[] = [];
  let bestScore = evaluate(state, side);
  for (const subset of candidates) {
    const plays = level === 'rookie' && rng.chance(0.5) ? randomLanes(state, side, subset, rng) : assignLanes(state, side, subset);
    if (!plays) continue;
    let score = simulateScore(state, side, plays);
    if (level === 'master') {
      // Wasted energy is wasted tempo; also keep lanes with room for later turns.
      const unspent = energy - sum(subset, (c) => c.def.cost);
      score -= unspent * (state.turn < MAX_TURNS ? 0.9 : 0.3);
      score += futureFlex(state, side, plays);
    }
    if (level === 'rookie') score += rng.next() * 6;
    else if (level === 'adept') score += rng.next() * 3;
    if (score > bestScore) { bestScore = score; best = plays; }
  }
  return best;
}

/** Penalise boards where we can no longer contest a lane we're losing. */
function futureFlex(state: BattleState, side: 0 | 1, plays: Play[]): number {
  if (state.turn >= MAX_TURNS) return 0;
  const foe = side === 0 ? 1 : 0;
  let v = 0;
  for (let l = 0; l < LANES; l++) {
    const filled = state.sides[side].lanes[l].length + plays.filter((p) => p.lane === l).length;
    const room = laneCapacity(state.lanes[l]) - filled;
    const margin = lanePower(state, side, l) - lanePower(state, foe, l);
    if (room === 0 && margin < 0) v -= 4;
    if (room === 0 && margin >= 0 && margin < 3) v -= 1.5;
  }
  return v;
}

function randomLanes(state: BattleState, side: 0 | 1, cards: CardInstance[], rng: ReturnType<typeof createRng>): Play[] | null {
  const used = [0, 0, 0];
  const plays: Play[] = [];
  for (const card of cards) {
    const open = [0, 1, 2].filter((l) => state.sides[side].lanes[l].length + used[l] < laneCapacity(state.lanes[l]));
    if (!open.length) return null;
    const lane = rng.pick(open);
    used[lane]++;
    plays.push({ uid: card.uid, lane });
  }
  return plays;
}

function sum<T>(xs: T[], f: (x: T) => number): number {
  return xs.reduce((a, x) => a + f(x), 0);
}

/** Greedy lane assignment: each card goes where it adds the most to the board evaluation. */
function assignLanes(state: BattleState, side: 0 | 1, cards: CardInstance[]): Play[] | null {
  const sim = cloneBattle(state);
  const plays: Play[] = [];
  for (const card of cards) {
    let bestLane = -1;
    let bestVal = -Infinity;
    for (let l = 0; l < LANES; l++) {
      const laneCards = sim.sides[side].lanes[l];
      if (laneCards.length >= laneCapacity(sim.lanes[l])) continue;
      const placed = { ...card, owner: side, turn: sim.turn };
      laneCards.push(placed);
      const v = evaluate(sim, side) + abilityHint(sim, side, placed, l);
      laneCards.pop();
      if (v > bestVal) { bestVal = v; bestLane = l; }
    }
    if (bestLane < 0) return null;
    sim.sides[side].lanes[bestLane].push({ ...card, owner: side, turn: sim.turn });
    plays.push({ uid: card.uid, lane: bestLane });
  }
  return plays;
}

function abilityHint(state: BattleState, side: 0 | 1, card: CardInstance, lane: number): number {
  const ab = card.def.ability;
  const mine = state.sides[side].lanes[lane];
  const theirs = state.sides[side === 0 ? 1 : 0].lanes[lane];
  switch (ab.kind) {
    case 'rally': return ab.amount * (mine.length - 1) * 0.8;
    case 'hex': return state.lanes[lane].kind === 'sanctuary' ? -3 : ab.amount * theirs.length * 0.8;
    case 'surge': return state.turn === MAX_TURNS ? ab.amount : -2;
    case 'charge': return state.turn < MAX_TURNS ? ab.amount * 0.7 : -3;
    default: return 0;
  }
}

function simulateScore(state: BattleState, side: 0 | 1, plays: Play[]): number {
  const sim = cloneBattle(state);
  const s = sim.sides[side];
  let bonus = 0;
  for (const p of plays) {
    const idx = s.hand.findIndex((c) => c.uid === p.uid);
    const [card] = s.hand.splice(idx, 1);
    card.turn = sim.turn;
    s.lanes[p.lane].push(card);
    bonus += abilityHint(sim, side, card, p.lane);
  }
  return evaluate(sim, side) + bonus;
}

/** Board evaluation from `side`'s perspective: lanes won matter most, margins smooth it out. */
export function evaluate(state: BattleState, side: 0 | 1): number {
  const foe = side === 0 ? 1 : 0;
  const margins: number[] = [];
  for (let l = 0; l < LANES; l++) margins.push(lanePower(state, side, l) - lanePower(state, foe, l));
  margins.sort((a, b) => b - a);
  let v = 0;
  // Winning two lanes is what matters: weight the best two lanes most.
  margins.forEach((m, i) => {
    const w = i < 2 ? 1 : 0.35;
    v += w * (Math.tanh(m / 4) * 10 + m * 0.15);
  });
  return v;
}

export { cardPower };
