import type { Fighter } from './battle';
import type { Stage } from './campaign';
import type { CardDef } from './cards';
import { STARTER_CARDS } from './cards';
import type { Element, Stats } from './types';

const BIAS_CARDS: Record<Element, CardDef[]> = {
  flame: [
    { id: 'en-f1', name: 'Cinder Jab', cost: 1, power: 2, element: 'flame', ability: { kind: 'none' }, source: 'starter', text: 'Hot hands.', glyph: 'flame' },
    { id: 'en-f2', name: 'Lava Lob', cost: 3, power: 4, element: 'flame', ability: { kind: 'hex', amount: 1 }, source: 'starter', text: 'Splash zone.', glyph: 'flame' },
    { id: 'en-f3', name: 'Bull Rush', cost: 4, power: 6, element: 'flame', ability: { kind: 'none' }, source: 'starter', text: 'Horns first.', glyph: 'horn' },
    { id: 'en-f4', name: 'Stampede', cost: 6, power: 9, element: 'flame', ability: { kind: 'swarm', amount: 1 }, source: 'starter', text: 'The whole horde.', glyph: 'horn' },
  ],
  tide: [
    { id: 'en-t1', name: 'Splash', cost: 1, power: 1, element: 'tide', ability: { kind: 'echo' }, source: 'starter', text: 'Plip.', glyph: 'drop' },
    { id: 'en-t2', name: 'Undertow', cost: 3, power: 3, element: 'tide', ability: { kind: 'hex', amount: 1 }, source: 'starter', text: 'Pulls you under.', glyph: 'drop' },
    { id: 'en-t3', name: 'Bubble Wall', cost: 2, power: 2, element: 'tide', ability: { kind: 'ward' }, source: 'starter', text: 'Wobbly but firm.', glyph: 'bubble' },
    { id: 'en-t4', name: 'Tsunami', cost: 6, power: 9, element: 'tide', ability: { kind: 'none' }, source: 'starter', text: 'Big wave.', glyph: 'drop' },
  ],
  moss: [
    { id: 'en-m1', name: 'Spore Puff', cost: 1, power: 1, element: 'moss', ability: { kind: 'charge', amount: 1 }, source: 'starter', text: 'Achoo.', glyph: 'leaf' },
    { id: 'en-m2', name: 'Bramble', cost: 2, power: 3, element: 'moss', ability: { kind: 'none' }, source: 'starter', text: 'Prickly.', glyph: 'leaf' },
    { id: 'en-m3', name: 'Overgrowth', cost: 4, power: 4, element: 'moss', ability: { kind: 'rally', amount: 1 }, source: 'starter', text: 'Everything grows.', glyph: 'leaf' },
    { id: 'en-m4', name: 'Ancient Root', cost: 5, power: 7, element: 'moss', ability: { kind: 'ward' }, source: 'starter', text: 'Older than chains.', glyph: 'leaf' },
  ],
  void: [
    { id: 'en-v1', name: 'Probe', cost: 1, power: 2, element: 'void', ability: { kind: 'none' }, source: 'starter', text: 'Beep.', glyph: 'drone' },
    { id: 'en-v2', name: 'Tractor Pull', cost: 3, power: 3, element: 'void', ability: { kind: 'hex', amount: 2 }, source: 'starter', text: 'Up you go.', glyph: 'ufo' },
    { id: 'en-v3', name: 'Cloak', cost: 2, power: 3, element: 'void', ability: { kind: 'ward' }, source: 'starter', text: 'Now you see it.', glyph: 'ufo' },
    { id: 'en-v4', name: 'Mothership', cost: 6, power: 10, element: 'void', ability: { kind: 'none' }, source: 'starter', text: 'Look up.', glyph: 'ufo' },
  ],
};

export function stageFighter(stage: Stage): Fighter {
  const e = stage.enemy;
  const base = 10 + e.power * 2;
  const stats: Stats = { power: base + (e.boss ? 4 : 0), speed: base, guard: base, luck: 6 + e.power, focus: base };
  const bias = BIAS_CARDS[e.deckBias];
  const deck: CardDef[] = [];
  for (let i = 0; deck.length < 12; i++) {
    const src = i < 8 ? bias[i % bias.length] : STARTER_CARDS[i % STARTER_CARDS.length];
    deck.push({ ...src, id: `${src.id}-${i}`, power: src.power + Math.floor(e.power / 3) });
  }
  return { id: `stage-${stage.id}`, name: e.name, stats, deck, element: e.element };
}
