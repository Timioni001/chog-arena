import 'server-only';
import { getAddress } from 'viem';
import { kv } from './kv';

export interface ClaimEntry {
  address: `0x${string}`;
  amount: string;
  proof: `0x${string}`[];
  tokens: number[];
}

/** $CHOG pays from ChogArenaSeasons, MON from ChogPass. Same leaf format, separate trees. */
export type PrizeAsset = 'chog' | 'mon';
const ns = (asset: PrizeAsset) => (asset === 'chog' ? '' : `${asset}:`);

export interface ClaimsMeta {
  season: number;
  asset?: PrizeAsset;
  root: `0x${string}`;
  total: string;
  count: number;
  publishedAt: number;
}

export async function publishClaims(season: number, root: `0x${string}`, total: string, entries: ClaimEntry[], asset: PrizeAsset = 'chog'): Promise<ClaimsMeta> {
  for (const e of entries) await kv().set(`claims:${ns(asset)}${season}:${getAddress(e.address).toLowerCase()}`, e);
  const meta: ClaimsMeta = { season, asset, root, total, count: entries.length, publishedAt: Date.now() };
  await kv().set(`claimsmeta:${ns(asset)}${season}`, meta);
  return meta;
}

export async function getClaim(season: number, address: string, asset: PrizeAsset = 'chog'): Promise<{ meta: ClaimsMeta | null; claim: ClaimEntry | null }> {
  const meta = await kv().get<ClaimsMeta>(`claimsmeta:${ns(asset)}${season}`);
  if (!meta) return { meta: null, claim: null };
  return { meta, claim: await kv().get<ClaimEntry>(`claims:${ns(asset)}${season}:${getAddress(address).toLowerCase()}`) };
}
