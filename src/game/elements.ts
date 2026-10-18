import type { Element } from './types';

/** Flame scorches Moss, Moss drinks Tide, Tide douses Flame. Void is neutral: never strong, never weak. */
export const BEATS: Record<Element, Element | null> = {
  flame: 'moss',
  moss: 'tide',
  tide: 'flame',
  void: null,
};

export const ELEMENT_META: Record<Element, { label: string; color: string; glow: string; icon: string; blurb: string }> = {
  flame: { label: 'Flame', color: '#ff6a3d', glow: '#ffb347', icon: '🔥', blurb: 'Beats Moss' },
  tide: { label: 'Tide', color: '#2fc6ff', glow: '#8be9ff', icon: '🌊', blurb: 'Beats Flame' },
  moss: { label: 'Moss', color: '#5ee36a', glow: '#b6ff8a', icon: '🌿', blurb: 'Beats Tide' },
  void: { label: 'Void', color: '#a78bfa', glow: '#d8c8ff', icon: '✦', blurb: 'Neutral, steady' },
};

export function beats(a: Element, b: Element): boolean {
  return BEATS[a] === b;
}
