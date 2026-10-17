import data from '../data/collection.json';
import type { Trait } from './types';

export interface CollectionIndex {
  chainId: number;
  contract: string;
  name: string;
  symbol: string;
  supply: number;
  firstTokenId: number;
  metadataBase: string;
  imageBase: string;
  indexedAt: string;
  types: string[];
  values: Record<string, string[]>;
  counts: Record<string, number[]>;
  tokens: number[][];
  scores: number[];
  ranks: number[];
  numbers: number[];
  titles: Record<string, string>;
}

export const COLLECTION = data as unknown as CollectionIndex;

export function isValidTokenId(id: number): boolean {
  return Number.isInteger(id) && id >= COLLECTION.firstTokenId && id < COLLECTION.firstTokenId + COLLECTION.supply;
}

/** Traits for a token, straight from the indexed metadata. "None" values are dropped. */
export function traitsOf(tokenId: number): Trait[] {
  if (!isValidTokenId(tokenId)) throw new Error(`token ${tokenId} is not in the collection`);
  const row = COLLECTION.tokens[tokenId - COLLECTION.firstTokenId];
  const out: Trait[] = [];
  COLLECTION.types.forEach((type, i) => {
    const value = COLLECTION.values[type][row[i]];
    if (value !== 'None') out.push({ type, value });
  });
  return out;
}

export function traitCount(type: string, value: string): number {
  const i = COLLECTION.values[type]?.indexOf(value) ?? -1;
  return i >= 0 ? COLLECTION.counts[type][i] : 0;
}

/** 0 = most common value in its category, 1 = rarest. Log-scaled so mid-rare values still matter. */
export function traitRarity(type: string, value: string): number {
  const counts = COLLECTION.counts[type];
  if (!counts) return 0;
  const c = traitCount(type, value) || 1;
  const max = Math.max(...counts);
  if (max <= 1) return 1;
  return 1 - Math.log(c) / Math.log(max);
}

export function rarityRank(tokenId: number): number {
  return COLLECTION.ranks[tokenId - COLLECTION.firstTokenId];
}

export function displayNumber(tokenId: number): number {
  return COLLECTION.numbers[tokenId - COLLECTION.firstTokenId];
}

export function titleOf(tokenId: number): string | null {
  return COLLECTION.titles[String(tokenId)] ?? null;
}

export function marketLinks(tokenId: number) {
  return {
    opensea: `https://opensea.io/item/monad/${COLLECTION.contract.toLowerCase()}/${tokenId}`,
    magicEden: `https://magiceden.io/item-details/monad/${COLLECTION.contract.toLowerCase()}/${tokenId}`,
    explorer: `https://monadvision.com/nft/${COLLECTION.contract}/${tokenId}`,
  };
}
