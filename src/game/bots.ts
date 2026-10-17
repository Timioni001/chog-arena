import type { CardDef } from './cards';
import type { Element, Rarity } from './types';

/** Original companion species. Each has a battle card and a passive Spark yield. */
export interface BotSpecies {
  id: string;
  name: string;
  rarity: Rarity;
  element: Element;
  /** Sparks per hour at level 1. */
  yield: number;
  price: number;
  color: string;
  accent: string;
  shape: 'drone' | 'mite' | 'orb' | 'crab' | 'kite' | 'golem';
  card: Omit<CardDef, 'id' | 'source' | 'element'>;
  blurb: string;
}

export const BOT_SPECIES: BotSpecies[] = [
  { id: 'pip', name: 'Pip Drone', rarity: 'common', element: 'void', yield: 40, price: 600, color: '#b9a6ff', accent: '#ffd166', shape: 'drone', blurb: 'Hums. Fetches Sparks. Loves you.', card: { name: 'Pip Ping', cost: 1, power: 1, ability: { kind: 'echo' }, text: 'Ping! Another card.', glyph: 'drone' } },
  { id: 'ember', name: 'Ember Mite', rarity: 'common', element: 'flame', yield: 45, price: 750, color: '#ff7a45', accent: '#ffe08a', shape: 'mite', blurb: 'Tiny, toasty, slightly bitey.', card: { name: 'Mite Bite', cost: 2, power: 3, ability: { kind: 'none' }, text: 'Small and hot.', glyph: 'mite' } },
  { id: 'drip', name: 'Drip Orb', rarity: 'uncommon', element: 'tide', yield: 70, price: 1600, color: '#36c9ff', accent: '#e0fbff', shape: 'orb', blurb: 'A floating puddle with opinions.', card: { name: 'Drip Shield', cost: 2, power: 2, ability: { kind: 'ward' }, text: 'Nothing gets through the bubble.', glyph: 'orb' } },
  { id: 'sprout', name: 'Sprout Crab', rarity: 'uncommon', element: 'moss', yield: 75, price: 1800, color: '#5fd068', accent: '#ffd1e8', shape: 'crab', blurb: 'Grows a leaf every time it pinches.', card: { name: 'Pinch Patch', cost: 3, power: 3, ability: { kind: 'rally', amount: 1 }, text: 'The garden grows together.', glyph: 'crab' } },
  { id: 'zap', name: 'Zap Kite', rarity: 'rare', element: 'tide', yield: 120, price: 4200, color: '#7ab8ff', accent: '#fff36b', shape: 'kite', blurb: 'Rides storm fronts for fun.', card: { name: 'Kite Strike', cost: 3, power: 4, ability: { kind: 'lucky', chance: 0.3 }, text: 'Lightning picks favourites.', glyph: 'kite' } },
  { id: 'cinder', name: 'Cinder Golem', rarity: 'epic', element: 'flame', yield: 200, price: 9000, color: '#ff5a5a', accent: '#ffb347', shape: 'golem', blurb: 'Built from a cooled volcano. Still warm.', card: { name: 'Golem Slam', cost: 5, power: 8, ability: { kind: 'hex', amount: 1 }, text: 'Everything nearby flinches.', glyph: 'golem' } },
  { id: 'grove', name: 'Grove Warden', rarity: 'legendary', element: 'moss', yield: 340, price: 20000, color: '#3ee08f', accent: '#f6ff9e', shape: 'golem', blurb: 'An old forest that learned to walk.', card: { name: 'Warden Root', cost: 4, power: 5, ability: { kind: 'rally', amount: 2 }, text: 'Roots hold the line.', glyph: 'golem' } },
];

export const MAX_BOT_LEVEL = 10;

export interface OwnedBot {
  uid: string;
  species: string;
  level: number;
}

export function speciesOf(bot: OwnedBot): BotSpecies {
  const s = BOT_SPECIES.find((x) => x.id === bot.species);
  if (!s) throw new Error(`unknown bot species ${bot.species}`);
  return s;
}

/** Yield doubles roughly every 3 levels. */
export function botYield(bot: OwnedBot, yieldBonus = 0): number {
  const s = speciesOf(bot);
  return Math.round(s.yield * 1.26 ** (bot.level - 1) * (1 + yieldBonus));
}

/** Catizen-style merge: two bots of the same species and level make one bot one level higher. */
export function canMerge(a: OwnedBot, b: OwnedBot): boolean {
  return a.uid !== b.uid && a.species === b.species && a.level === b.level && a.level < MAX_BOT_LEVEL;
}

export function mergeCost(level: number): number {
  return Math.round(150 * 1.6 ** (level - 1));
}

export function botCard(bot: OwnedBot): CardDef {
  const s = speciesOf(bot);
  const bonus = Math.floor((bot.level - 1) / 3);
  return { ...s.card, id: `bot-${s.id}-${bot.level}`, power: s.card.power + bonus, element: s.element, source: 'bot', origin: `Bot: ${s.name} Lv${bot.level}` };
}

export interface SlotRules {
  slots: number;
}

/** Guests get 1 slot, holders 2, Rare-and-above holders 3. */
export function botSlots(holder: boolean, tier: string | null): number {
  if (!holder) return 1;
  if (tier && ['Rare', 'Epic', 'Legendary'].includes(tier)) return 3;
  return 2;
}
