import 'server-only';
import { getAddress } from 'viem';
import { kv } from './kv';

export interface ClaimEntry {
  address: `0x${string}`;
  amount: string;
  proof: `0x${string}`[];
  tokens: number[];
}

export interface ClaimsMeta {
  season: number;
  root: `0x${string}`;
  total: string;
  count: number;
  publishedAt: number;
}

export async function publishClaims(season: number, root: `0x${string}`, total: string, entries: ClaimEntry[]): Promise<ClaimsMeta> {
  for (const e of entries) await kv().set(`claims:${season}:${getAddress(e.address).toLowerCase()}`, e);
  const meta: ClaimsMeta = { season, root, total, count: entries.length, publishedAt: Date.now() };
  await kv().set(`claimsmeta:${season}`, meta);
  return meta;
}

export async function getClaim(season: number, address: string): Promise<{ meta: ClaimsMeta | null; claim: ClaimEntry | null }> {
  const meta = await kv().get<ClaimsMeta>(`claimsmeta:${season}`);
  if (!meta) return { meta: null, claim: null };
  return { meta, claim: await kv().get<ClaimEntry>(`claims:${season}:${getAddress(address).toLowerCase()}`) };
}
