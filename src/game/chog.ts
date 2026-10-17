import rules from './config/trait-rules.json';
import { STARTER_CARDS, type Ability, type CardDef } from './cards';
import { DECK_SIZE } from './battle';
import { botCard, type OwnedBot } from './bots';
import { displayNumber, rarityRank, titleOf, traitCount, traitRarity, traitsOf, COLLECTION } from './collection';
import type { Element, Stats, StatKey, Trait } from './types';

type CardRule = { match: string; name: string; cost: number; power: number; ability: Ability; glyph: string; text: string };
type Synergy = { id: string; name: string; match: string; min: number; bonus: Partial<Stats> };

const RULES = rules as unknown as {
  elementKeywords: { match: string; element: Element }[];
  statByCategory: Record<string, StatKey>;
  baseStats: Record<string, Stats>;
  tierMultiplier: Record<string, number>;
  cards: Record<string, CardRule[]>;
  synergies: Synergy[];
};

export type Archetype = 'Origin' | 'Skull' | 'Radioactive' | '1:1' | 'Guest';

export const ARCHETYPES: Record<Archetype, { name: string; tagline: string; color: string }> = {
  Origin: { name: 'Origin Spiker', tagline: 'The classic quill-hooded brawler.', color: '#8b5cf6' },
  Skull: { name: 'Bone Bristle', tagline: 'Rattles in, hits hard, takes hits.', color: '#e8e2d0' },
  Radioactive: { name: 'Glowback', tagline: 'Leaks green light and raw speed.', color: '#39ff6a' },
  '1:1': { name: 'Mythic Single', tagline: 'Hand-made legends. One of each.', color: '#ffd166' },
  Guest: { name: 'Demo Spiker', tagline: 'A loaner. Ranked needs a real Chog.', color: '#9aa0b5' },
};

export interface ChogProfile {
  tokenId: number | null;
  number: number | null;
  name: string;
  title: string | null;
  archetype: Archetype;
  tier: string | null;
  traits: Trait[];
  element: Element;
  stats: Stats;
  baseStats: Stats;
  synergies: { id: string; name: string; bonus: Partial<Stats> }[];
  rarityRank: number | null;
  traitCards: CardDef[];
  isGuest: boolean;
}

function regex(src: string) {
  return new RegExp(src, 'i');
}

export function elementOfText(text: string): Element | null {
  for (const k of RULES.elementKeywords) if (regex(k.match).test(text)) return k.element;
  return null;
}

function traitValue(traits: Trait[], type: string): string | null {
  return traits.find((t) => t.type === type)?.value ?? null;
}

function archetypeOf(traits: Trait[]): Archetype {
  const base = traitValue(traits, 'Base');
  if (base === 'Skull' || base === 'Radioactive' || base === '1:1') return base;
  return 'Origin';
}

function mainElement(traits: Trait[], title: string | null): Element {
  for (const source of [title, traitValue(traits, 'Aura'), traitValue(traits, 'Background'), traitValue(traits, 'Skin')]) {
    if (!source) continue;
    const e = elementOfText(source);
    if (e) return e;
  }
  return 'void';
}

function cardFor(category: string, value: string | null, fallbackElement: Element, tokenKey: string): CardDef | null {
  const list = RULES.cards[category];
  if (!list) return null;
  const v = value ?? 'none';
  const rule = list.find((r) => (r.match === 'none' ? v === 'none' : v !== 'none' && regex(r.match).test(v)));
  if (!rule) return null;
  const count = value ? traitCount(category, value) : COLLECTION.supply;
  // Rare trait values hit a little harder: +1 under 2% of supply, +2 under 0.5%.
  const share = count / COLLECTION.supply;
  const bonus = share < 0.005 ? 2 : share < 0.02 ? 1 : 0;
  return {
    id: `${tokenKey}-${category}`.toLowerCase(),
    name: rule.name,
    cost: rule.cost,
    power: rule.power + bonus,
    element: (value && elementOfText(value)) || (category === 'Aura' || category === 'Background' ? fallbackElement : 'void'),
    ability: rule.ability,
    source: category === 'Base' ? 'form' : 'trait',
    text: rule.text,
    glyph: rule.glyph,
    origin: value ? `${category}: ${value}` : `${category}: none`,
  };
}

function applyBonus(stats: Stats, bonus: Partial<Stats>) {
  for (const [k, v] of Object.entries(bonus)) stats[k as StatKey] += v ?? 0;
}

export function buildProfile(input: { tokenId: number | null; traits: Trait[]; title?: string | null; tier?: string | null }): ChogProfile {
  const { tokenId, traits } = input;
  const isGuest = tokenId === null;
  const title = input.title ?? null;
  const archetype: Archetype = isGuest ? 'Guest' : archetypeOf(traits);
  const tier = input.tier ?? traitValue(traits, 'Tier');
  const element = mainElement(traits, title);

  const stats: Stats = { ...RULES.baseStats[archetype] };
  for (const t of traits) {
    const stat = RULES.statByCategory[t.type];
    if (!stat) continue;
    stats[stat] += 1 + Math.round(3 * traitRarity(t.type, t.value));
  }
  // Element flavour: a small nudge, never a power spike.
  if (element === 'flame') stats.power += 1;
  if (element === 'tide') stats.guard += 1;
  if (element === 'moss') stats.focus += 1;
  if (element === 'void') stats.luck += 1;

  const synergies: ChogProfile['synergies'] = [];
  for (const s of RULES.synergies) {
    const re = regex(s.match);
    const hits = traits.filter((t) => t.type !== 'Tier' && re.test(t.value)).length;
    if (hits >= s.min) {
      synergies.push({ id: s.id, name: s.name, bonus: s.bonus });
      applyBonus(stats, s.bonus);
    }
  }

  const mul = isGuest ? 1 : RULES.tierMultiplier[tier ?? 'Common'] ?? 1;
  const baseStats = { ...stats };
  for (const k of Object.keys(stats) as StatKey[]) stats[k] = Math.round(stats[k] * mul);

  const key = isGuest ? 'guest' : `chog${tokenId}`;
  const categories: [string, string | null][] =
    archetype === '1:1'
      ? [['Base', '1:1']]
      : [
          ['Base', traitValue(traits, 'Base') ?? 'Origin'],
          ['Head', traitValue(traits, 'Head')],
          ['Eyes', traitValue(traits, 'Eyes')],
          ['Mouth', traitValue(traits, 'Mouth')],
          ['Body', traitValue(traits, 'Body')],
          traitValue(traits, 'Accessory') ? ['Accessory', traitValue(traits, 'Accessory')] : ['Background', traitValue(traits, 'Background')],
          ['Aura', traitValue(traits, 'Aura')],
        ];
  const traitCards = categories.map(([c, v]) => cardFor(c, v, element, key)).filter((c): c is CardDef => !!c);
  if (archetype === '1:1') {
    // Legends carry no per-part traits, so their deck is a themed signature set.
    traitCards.push(
      { id: `${key}-legend-a`, name: `${title ?? 'Legend'} Strike`, cost: 4, power: 7, element, ability: { kind: 'none' }, source: 'form', text: 'A move with a name on it.', glyph: 'star', origin: `1:1: ${title}` },
      { id: `${key}-legend-b`, name: 'Spotlight', cost: 2, power: 3, element, ability: { kind: 'lone', amount: 3 }, source: 'form', text: 'All eyes here.', glyph: 'star', origin: `1:1: ${title}` },
      { id: `${key}-legend-c`, name: 'Encore', cost: 3, power: 4, element, ability: { kind: 'surge', amount: 4 }, source: 'form', text: 'Saved the best for last.', glyph: 'star', origin: `1:1: ${title}` },
    );
  }

  const number = isGuest ? null : displayNumber(tokenId!);
  return {
    tokenId,
    number,
    name: isGuest ? 'Demo Chog' : `Chog #${number}`,
    title,
    archetype,
    tier,
    traits,
    element,
    stats,
    baseStats,
    synergies,
    rarityRank: isGuest ? null : rarityRank(tokenId!),
    traitCards,
    isGuest,
  };
}

export function profileForToken(tokenId: number): ChogProfile {
  return buildProfile({ tokenId, traits: traitsOf(tokenId), title: titleOf(tokenId) });
}

/** The loaner Chog. It looks the part but has base stats and no trait bonuses. */
export const GUEST_TRAITS: Trait[] = [
  { type: 'Skin', value: 'Origin' },
  { type: 'Background', value: 'Light Purple' },
  { type: 'Head', value: 'None' },
  { type: 'Eyes', value: 'Happy' },
  { type: 'Mouth', value: 'normal smile' },
];

export function guestProfile(): ChogProfile {
  return buildProfile({ tokenId: null, traits: GUEST_TRAITS.filter((t) => t.value !== 'None'), tier: null });
}

/** Holdings bonus: +3% per extra Chog, and the whole stack (tier + holdings) is capped at +15%. */
export function holdingsMultiplier(owned: number, tier: string | null): number {
  const tierMul = RULES.tierMultiplier[tier ?? 'Common'] ?? 1;
  const holdMul = 1 + Math.min(0.15, Math.max(0, owned - 1) * 0.03);
  return Math.min(1.15, tierMul * holdMul) / tierMul;
}

export function applyHoldings(profile: ChogProfile, owned: number, skillStats: Partial<Stats> = {}): Stats {
  const m = profile.isGuest ? 1 : holdingsMultiplier(owned, profile.tier);
  const out = { ...profile.stats };
  for (const k of Object.keys(out) as StatKey[]) out[k] = Math.round(out[k] * m) + (skillStats[k] ?? 0);
  return out;
}

/** 12-card deck: trait cards first, then equipped bots, then starters to fill. */
export function buildDeck(profile: ChogProfile, bots: OwnedBot[]): CardDef[] {
  const deck: CardDef[] = [...profile.traitCards, ...bots.map(botCard)];
  let i = 0;
  while (deck.length < DECK_SIZE) {
    const s = STARTER_CARDS[i % STARTER_CARDS.length];
    deck.push({ ...s, id: `${s.id}-${i}` });
    i++;
  }
  return deck.slice(0, DECK_SIZE);
}
