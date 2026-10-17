import type { Element } from './types';

export type Ability =
  | { kind: 'none' }
  | { kind: 'rally'; amount: number } // On reveal: +amount to your other cards in this lane
  | { kind: 'hex'; amount: number } // On reveal: -amount to every enemy card in this lane
  | { kind: 'surge'; amount: number } // +amount if played on the final turn
  | { kind: 'lucky'; chance: number } // On reveal: extra chance to crit (double base power)
  | { kind: 'ward' } // Your cards in this lane can't be reduced
  | { kind: 'echo' } // On reveal: draw a card
  | { kind: 'charge'; amount: number } // On reveal: +amount energy next turn
  | { kind: 'lone'; amount: number } // Ongoing: +amount while it's your only card here
  | { kind: 'swarm'; amount: number }; // Ongoing: +amount for each other card you have here

export type CardSource = 'trait' | 'form' | 'bot' | 'starter';

export interface CardDef {
  id: string;
  name: string;
  cost: number;
  power: number;
  element: Element;
  ability: Ability;
  source: CardSource;
  /** Short flavor line shown on the card face. */
  text: string;
  /** Visual glyph key used by the card art renderer. */
  glyph: string;
  /** Trait this card came from, if any ("Head: MCGA"). */
  origin?: string;
}

export function abilityText(a: Ability): string {
  switch (a.kind) {
    case 'none':
      return '';
    case 'rally':
      return `On reveal: +${a.amount} to your other cards here.`;
    case 'hex':
      return `On reveal: −${a.amount} to enemy cards here.`;
    case 'surge':
      return `+${a.amount} if played on the final turn.`;
    case 'lucky':
      return `On reveal: +${Math.round(a.chance * 100)}% crit chance.`;
    case 'ward':
      return `Your cards here can't be reduced.`;
    case 'echo':
      return 'On reveal: draw a card.';
    case 'charge':
      return `On reveal: +${a.amount} energy next turn.`;
    case 'lone':
      return `+${a.amount} while it's your only card here.`;
    case 'swarm':
      return `+${a.amount} for each other card you have here.`;
  }
}

/** Filler cards everyone gets so every deck reaches 12. */
export const STARTER_CARDS: CardDef[] = [
  { id: 'st-pebble', name: 'Pebble Toss', cost: 1, power: 2, element: 'void', ability: { kind: 'none' }, source: 'starter', text: 'Small rock, big feelings.', glyph: 'pebble' },
  { id: 'st-dash', name: 'Spike Dash', cost: 1, power: 1, element: 'void', ability: { kind: 'echo' }, source: 'starter', text: 'In and out before they blink.', glyph: 'dash' },
  { id: 'st-huddle', name: 'Huddle Up', cost: 2, power: 2, element: 'void', ability: { kind: 'swarm', amount: 1 }, source: 'starter', text: 'Chogs stick together.', glyph: 'huddle' },
  { id: 'st-roll', name: 'Spin Roll', cost: 2, power: 3, element: 'void', ability: { kind: 'none' }, source: 'starter', text: 'A tidy purple wheel of spikes.', glyph: 'roll' },
  { id: 'st-nap', name: 'Power Nap', cost: 1, power: 0, element: 'void', ability: { kind: 'charge', amount: 2 }, source: 'starter', text: 'Wake up stronger.', glyph: 'nap' },
  { id: 'st-stomp', name: 'Big Stomp', cost: 4, power: 6, element: 'void', ability: { kind: 'none' }, source: 'starter', text: 'The floor felt that.', glyph: 'stomp' },
  { id: 'st-wish', name: 'Coin Wish', cost: 3, power: 3, element: 'void', ability: { kind: 'lucky', chance: 0.35 }, source: 'starter', text: 'Heads: you win. Tails: you also win.', glyph: 'coin' },
];
