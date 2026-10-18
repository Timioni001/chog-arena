export type Element = 'flame' | 'tide' | 'moss' | 'void';
export type StatKey = 'power' | 'speed' | 'guard' | 'luck' | 'focus';
export type Stats = Record<StatKey, number>;
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

export interface Trait {
  type: string;
  value: string;
}
