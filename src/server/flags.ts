import 'server-only';
import { kv } from './kv';

export interface Flag {
  tokenId: number;
  reason: string;
  at: number;
  /** Unix ms when the flag lifts automatically; null = until reviewed. */
  until: number | null;
}

/** Public, auditable flag list: every flagged Chog is shown with its reason. */
export async function listFlags(): Promise<Flag[]> {
  const ids = await kv().smembers('flags');
  const now = Date.now();
  const flags = (await Promise.all(ids.map((id) => kv().get<Flag>(`flag:${id}`)))).filter((f): f is Flag => !!f && (f.until === null || f.until > now));
  return flags.sort((a, b) => b.at - a.at);
}

export async function activeFlag(tokenId: number): Promise<Flag | null> {
  const f = await kv().get<Flag>(`flag:${tokenId}`);
  if (!f || (f.until !== null && f.until <= Date.now())) return null;
  return f;
}

export async function setFlag(tokenId: number, reason: string, days: number | null): Promise<Flag> {
  const f: Flag = { tokenId, reason: reason.slice(0, 200), at: Date.now(), until: days ? Date.now() + days * 86_400_000 : null };
  await kv().set(`flag:${tokenId}`, f);
  await kv().sadd('flags', String(tokenId));
  return f;
}

export async function clearFlag(tokenId: number): Promise<void> {
  await kv().del(`flag:${tokenId}`);
  await kv().srem('flags', String(tokenId));
}
