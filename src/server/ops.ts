import 'server-only';
import { kv } from './kv';

export interface Announcement {
  text: string;
  tone: 'info' | 'event' | 'warn';
  /** Unix ms when the banner stops showing; null = until cleared. */
  until: number | null;
  at: number;
}

export interface Ops {
  announcement: Announcement | null;
  /** Kill switch for ranked matchmaking (maintenance, an exploit, a contract migration). */
  rankedPaused: boolean;
}

const KEY = 'ops:settings';

export async function getOps(): Promise<Ops> {
  const o = (await kv().get<Ops>(KEY)) ?? { announcement: null, rankedPaused: false };
  if (o.announcement?.until && o.announcement.until < Date.now()) o.announcement = null;
  return o;
}

export async function setOps(patch: Partial<Ops>): Promise<Ops> {
  const next = { ...(await getOps()), ...patch };
  await kv().set(KEY, next);
  return next;
}
