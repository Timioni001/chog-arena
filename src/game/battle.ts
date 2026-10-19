import { abilityText, type CardDef } from './cards';
import { beats } from './elements';
import { createRng, type Rng } from './rng';
import type { Element, Stats } from './types';

export const LANES = 3;
export const MAX_TURNS = 6;
export const DECK_SIZE = 12;
export const START_HAND = 3;
export const MAX_HAND = 7;

export type LaneKind =
  | 'open'
  | 'ember'
  | 'tidepool'
  | 'grove'
  | 'narrow'
  | 'static'
  | 'gravity'
  | 'sanctuary';

export interface LaneDef {
  kind: LaneKind;
  name: string;
  text: string;
}

export const LANE_LIBRARY: Record<LaneKind, LaneDef> = {
  open: { kind: 'open', name: 'Open Field', text: 'No tricks. Just Chogs.' },
  ember: { kind: 'ember', name: 'Ember Vent', text: 'Flame cards here get +2.' },
  tidepool: { kind: 'tidepool', name: 'Tide Pool', text: 'Tide cards here get +2.' },
  grove: { kind: 'grove', name: 'Moss Grove', text: 'Moss cards here get +2.' },
  narrow: { kind: 'narrow', name: 'Narrow Bridge', text: 'Only 2 cards per side fit here.' },
  static: { kind: 'static', name: 'Static Field', text: 'Cards revealed here crit 25% more often.' },
  gravity: { kind: 'gravity', name: 'Gravity Well', text: 'Cards costing 4+ get +3 here.' },
  sanctuary: { kind: 'sanctuary', name: 'Sanctuary', text: 'Hex effects do nothing here.' },
};

export interface Fighter {
  name: string;
  stats: Stats;
  deck: CardDef[];
  /** Opaque id: token id, "guest", ghost id... */
  id: string;
  element: Element;
}

export interface CardInstance {
  uid: number;
  def: CardDef;
  /** Base power after stat bonus and crit. */
  base: number;
  /** Accumulated buffs/debuffs from abilities. */
  mod: number;
  crit: boolean;
  turn: number;
  owner: 0 | 1;
}

export interface SideState {
  fighter: Fighter;
  drawPile: CardDef[];
  hand: CardInstance[];
  lanes: CardInstance[][];
  energyBonus: number;
}

export interface Play {
  /** uid of a card in hand */
  uid: number;
  lane: number;
}

export type BattleEvent =
  | { t: 'reveal'; side: 0 | 1; uid: number; lane: number; crit: boolean }
  | { t: 'buff'; side: 0 | 1; lane: number; amount: number; source: number }
  | { t: 'hex'; side: 0 | 1; lane: number; amount: number; source: number; blocked: boolean }
  | { t: 'draw'; side: 0 | 1; count: number }
  | { t: 'charge'; side: 0 | 1; amount: number };

export interface TurnRecord {
  turn: number;
  plays: [Play[], Play[]];
  events: BattleEvent[];
  firstToReveal: 0 | 1;
}

export interface BattleResult {
  winner: 0 | 1 | null;
  laneWinners: (0 | 1 | null)[];
  lanePower: [number, number][];
  totalPower: [number, number];
  /** Score used for ranked points: lanes won * 40 + power margin, clamped. */
  score: [number, number];
}

export interface BattleState {
  seed: string;
  turn: number;
  lanes: LaneDef[];
  sides: [SideState, SideState];
  history: TurnRecord[];
  nextUid: number;
  rng: [number, number, number, number];
  result: BattleResult | null;
}

export class IllegalPlayError extends Error {}

// ------------------------------------------------------------------ stat effects

/** Flat bonus to every card costing 2+. Stats sit around 10–40. */
export function powerBonus(stats: Stats): number {
  return Math.max(0, Math.min(3, Math.floor((stats.power - 10) / 8)));
}
export function guardReduction(stats: Stats): number {
  return Math.max(0, Math.min(2, Math.floor((stats.guard - 10) / 10)));
}
export function critChance(stats: Stats): number {
  return Math.max(0.02, Math.min(0.2, (stats.luck - 5) / 100));
}
export function extraOpeningDraw(stats: Stats): number {
  return stats.focus >= 26 ? 1 : 0;
}

// ------------------------------------------------------------------ setup

export function pickLanes(rng: Rng, forced?: LaneKind[]): LaneDef[] {
  if (forced && forced.length === LANES) return forced.map((k) => LANE_LIBRARY[k]);
  const pool: LaneKind[] = ['ember', 'tidepool', 'grove', 'narrow', 'static', 'gravity', 'sanctuary'];
  const shuffled = rng.shuffle(pool);
  // Always keep one Open Field so every match has a plain lane to read.
  const lanes = [LANE_LIBRARY.open, LANE_LIBRARY[shuffled[0]], LANE_LIBRARY[shuffled[1]]];
  return rng.shuffle(lanes);
}

export function createBattle(seed: string, a: Fighter, b: Fighter, forcedLanes?: LaneKind[]): BattleState {
  if (a.deck.length !== DECK_SIZE || b.deck.length !== DECK_SIZE) {
    throw new IllegalPlayError(`decks must have ${DECK_SIZE} cards`);
  }
  const rng = createRng(seed);
  const lanes = pickLanes(rng, forcedLanes);
  const state: BattleState = {
    seed,
    turn: 1,
    lanes,
    sides: [makeSide(a), makeSide(b)],
    history: [],
    nextUid: 1,
    rng: rng.state(),
    result: null,
  };
  for (const side of [0, 1] as const) {
    const s = state.sides[side];
    s.drawPile = rng.shuffle(s.drawPile);
    draw(state, side, START_HAND + extraOpeningDraw(s.fighter.stats));
  }
  // Each side draws for turn 1 as well.
  for (const side of [0, 1] as const) draw(state, side, 1);
  state.rng = rng.state();
  return state;
}

function makeSide(f: Fighter): SideState {
  return { fighter: f, drawPile: f.deck.slice(), hand: [], lanes: [[], [], []], energyBonus: 0 };
}

function draw(state: BattleState, side: 0 | 1, count: number): number {
  const s = state.sides[side];
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    if (s.hand.length >= MAX_HAND) break;
    const def = s.drawPile.shift();
    if (!def) break;
    s.hand.push({ uid: state.nextUid++, def, base: def.power, mod: 0, crit: false, turn: 0, owner: side });
    drawn++;
  }
  return drawn;
}

// ------------------------------------------------------------------ queries

export function energyFor(state: BattleState, side: 0 | 1): number {
  return state.turn + state.sides[side].energyBonus;
}

export function laneCapacity(lane: LaneDef): number {
  return lane.kind === 'narrow' ? 2 : 4;
}

/** Live power of one card, including ongoing effects and element edges. */
export function cardPower(state: BattleState, card: CardInstance, laneIndex: number): number {
  const lane = state.lanes[laneIndex];
  const mine = state.sides[card.owner].lanes[laneIndex];
  const theirs = state.sides[card.owner === 0 ? 1 : 0].lanes[laneIndex];
  let p = card.base + card.mod;
  const el = card.def.element;
  if (lane.kind === 'ember' && el === 'flame') p += 2;
  if (lane.kind === 'tidepool' && el === 'tide') p += 2;
  if (lane.kind === 'grove' && el === 'moss') p += 2;
  if (lane.kind === 'gravity' && card.def.cost >= 4) p += 3;
  const ab = card.def.ability;
  if (ab.kind === 'lone' && mine.length === 1) p += ab.amount;
  if (ab.kind === 'swarm') p += ab.amount * (mine.length - 1);
  // Element edge: +1 for each enemy card here that this card's element beats.
  for (const e of theirs) if (beats(el, e.def.element)) p += 1;
  return Math.max(0, p);
}

export function lanePower(state: BattleState, side: 0 | 1, laneIndex: number): number {
  return state.sides[side].lanes[laneIndex].reduce((sum, c) => sum + cardPower(state, c, laneIndex), 0);
}

export function validatePlays(state: BattleState, side: 0 | 1, plays: Play[]): void {
  if (state.result) throw new IllegalPlayError('battle is over');
  const s = state.sides[side];
  const seen = new Set<number>();
  const added = [0, 0, 0];
  let spent = 0;
  for (const p of plays) {
    if (seen.has(p.uid)) throw new IllegalPlayError('card played twice');
    seen.add(p.uid);
    if (!Number.isInteger(p.lane) || p.lane < 0 || p.lane >= LANES) throw new IllegalPlayError('bad lane');
    const card = s.hand.find((c) => c.uid === p.uid);
    if (!card) throw new IllegalPlayError('card not in hand');
    spent += card.def.cost;
    added[p.lane]++;
    if (s.lanes[p.lane].length + added[p.lane] > laneCapacity(state.lanes[p.lane])) {
      throw new IllegalPlayError('lane is full');
    }
  }
  if (spent > energyFor(state, side)) throw new IllegalPlayError('not enough energy');
}

// ------------------------------------------------------------------ turn resolution

/**
 * Resolve one simultaneous turn. Both sides lock in plays, then cards reveal in initiative order:
 * whoever is winning more lanes reveals first; ties go to the higher Speed stat, then alternate.
 */
export function resolveTurn(state: BattleState, playsA: Play[], playsB: Play[]): TurnRecord {
  validatePlays(state, 0, playsA);
  validatePlays(state, 1, playsB);
  const rng = createRng(state.rng);
  const first = initiative(state);
  const events: BattleEvent[] = [];
  const order: [0 | 1, Play[]][] = first === 0 ? [[0, playsA], [1, playsB]] : [[1, playsB], [0, playsA]];
  const chargeNext: [number, number] = [0, 0];

  // Remove played cards from hand, place them face-down.
  const placed: CardInstance[][] = [[], []];
  for (const [side, plays] of order) {
    const s = state.sides[side];
    for (const p of plays) {
      const idx = s.hand.findIndex((c) => c.uid === p.uid);
      const [card] = s.hand.splice(idx, 1);
      card.turn = state.turn;
      s.lanes[p.lane].push(card);
      placed[side].push(card);
    }
  }

  // Reveal.
  for (const [side] of order) {
    const s = state.sides[side];
    const foe = state.sides[side === 0 ? 1 : 0];
    for (const card of placed[side]) {
      const laneIndex = s.lanes.findIndex((l) => l.includes(card));
      const lane = state.lanes[laneIndex];
      const ab = card.def.ability;
      let base = card.def.power;
      if (card.def.cost >= 2) base += powerBonus(s.fighter.stats);
      if (ab.kind === 'surge' && state.turn === MAX_TURNS) base += ab.amount;
      let crit = critChance(s.fighter.stats);
      if (ab.kind === 'lucky') crit += ab.chance;
      if (lane.kind === 'static') crit += 0.25;
      card.crit = base > 0 && rng.chance(Math.min(0.9, crit));
      card.base = card.crit ? Math.ceil(base * 1.5) : base;
      events.push({ t: 'reveal', side, uid: card.uid, lane: laneIndex, crit: card.crit });

      switch (ab.kind) {
        case 'rally': {
          for (const ally of s.lanes[laneIndex]) if (ally !== card) ally.mod += ab.amount;
          events.push({ t: 'buff', side, lane: laneIndex, amount: ab.amount, source: card.uid });
          break;
        }
        case 'hex': {
          const blocked = lane.kind === 'sanctuary' || foe.lanes[laneIndex].some((c) => c.def.ability.kind === 'ward');
          if (!blocked) {
            const amt = Math.max(0, ab.amount - guardReduction(foe.fighter.stats));
            for (const enemy of foe.lanes[laneIndex]) enemy.mod -= amt;
          }
          events.push({ t: 'hex', side, lane: laneIndex, amount: ab.amount, source: card.uid, blocked });
          break;
        }
        case 'echo': {
          const n = draw(state, side, 1);
          events.push({ t: 'draw', side, count: n });
          break;
        }
        case 'charge': {
          chargeNext[side] += ab.amount;
          events.push({ t: 'charge', side, amount: ab.amount });
          break;
        }
        default:
          break;
      }
    }
  }

  const record: TurnRecord = { turn: state.turn, plays: [playsA, playsB], events, firstToReveal: first };
  state.history.push(record);

  if (state.turn >= MAX_TURNS) {
    state.result = scoreBattle(state);
  } else {
    state.turn += 1;
    for (const side of [0, 1] as const) {
      state.sides[side].energyBonus = chargeNext[side];
      draw(state, side, 1);
    }
  }
  state.rng = rng.state();
  return record;
}

function initiative(state: BattleState): 0 | 1 {
  let lead = 0;
  for (let l = 0; l < LANES; l++) {
    const a = lanePower(state, 0, l), b = lanePower(state, 1, l);
    if (a > b) lead++;
    else if (b > a) lead--;
  }
  if (lead > 0) return 0;
  if (lead < 0) return 1;
  const sa = state.sides[0].fighter.stats.speed, sb = state.sides[1].fighter.stats.speed;
  if (sa !== sb) return sa > sb ? 0 : 1;
  return (state.turn % 2 === 1 ? 0 : 1) as 0 | 1;
}

export function scoreBattle(state: BattleState): BattleResult {
  const laneWinners: (0 | 1 | null)[] = [];
  const powers: [number, number][] = [];
  let wins: [number, number] = [0, 0];
  let total: [number, number] = [0, 0];
  for (let l = 0; l < LANES; l++) {
    const a = lanePower(state, 0, l), b = lanePower(state, 1, l);
    powers.push([a, b]);
    total = [total[0] + a, total[1] + b];
    if (a > b) { laneWinners.push(0); wins = [wins[0] + 1, wins[1]]; }
    else if (b > a) { laneWinners.push(1); wins = [wins[0], wins[1] + 1]; }
    else laneWinners.push(null);
  }
  let winner: 0 | 1 | null = null;
  if (wins[0] > wins[1]) winner = 0;
  else if (wins[1] > wins[0]) winner = 1;
  else if (total[0] !== total[1]) winner = total[0] > total[1] ? 0 : 1;
  const score = (side: 0 | 1): number => {
    const margin = total[side] - total[side === 0 ? 1 : 0];
    return Math.max(0, Math.min(200, wins[side] * 40 + Math.max(0, margin) + (winner === side ? 50 : 0)));
  };
  return { winner, laneWinners, lanePower: powers, totalPower: total, score: [score(0), score(1)] };
}

/** Deep clone that keeps CardDef references shared (they are immutable). */
export function cloneBattle(state: BattleState): BattleState {
  const cloneCard = (c: CardInstance): CardInstance => ({ ...c });
  const cloneSide = (s: SideState): SideState => ({
    fighter: s.fighter,
    drawPile: s.drawPile.slice(),
    hand: s.hand.map(cloneCard),
    lanes: s.lanes.map((l) => l.map(cloneCard)),
    energyBonus: s.energyBonus,
  });
  return {
    ...state,
    sides: [cloneSide(state.sides[0]), cloneSide(state.sides[1])],
    history: state.history.slice(),
    rng: [...state.rng] as [number, number, number, number],
  };
}
