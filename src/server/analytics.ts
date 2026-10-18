import 'server-only';
import { kv } from './kv';
import { dayKey } from '@/game/daily';

const TTL = 60 * 60 * 24 * 60;
const NAME = /^[a-z][a-z0-9_]{0,31}$/;

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Counts events per day, daily actives, and D1/D7 retention by first-seen cohort. */
export async function ingest(device: string, events: { n: string; p?: Record<string, unknown> }[]) {
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(device)) return;
  const day = dayKey();
  const store = kv();
  const seenKey = `seen:${day}:${device}`;
  if (!(await store.get(seenKey))) {
    await store.set(seenKey, 1, 60 * 60 * 48);
    await store.incr(`dau:${day}`, 1, TTL);
    const first = await store.get<string>(`dev:${device}`);
    if (!first) {
      await store.set(`dev:${device}`, day, TTL);
      await store.incr(`cohort:${day}`, 1, TTL);
    } else {
      const diff = daysBetween(first, day);
      if (diff === 1 || diff === 7) await store.incr(`ret:${diff}:${first}`, 1, TTL);
    }
  }
  for (const e of events.slice(0, 50)) {
    if (!NAME.test(e.n)) continue;
    await store.incr(`ev:${day}:${e.n}`, 1, TTL);
    const tag = e.p && (typeof e.p.mode === 'string' ? e.p.mode : typeof e.p.kind === 'string' ? e.p.kind : null);
    if (tag && /^[a-z0-9_]{1,24}$/.test(tag)) await store.incr(`ev:${day}:${e.n}:${tag}`, 1, TTL);
  }
}

/** Records Spark flow per source/sink from successive cloud saves (diff of the save's ledger). */
export async function recordLedger(prev: Record<string, number> | undefined, next: Record<string, number>) {
  const day = dayKey();
  for (const [k, v] of Object.entries(next)) {
    const d = v - (prev?.[k] ?? 0);
    if (d !== 0 && /^[a-z:_]{1,32}$/.test(k)) await kv().incr(`eco:${day}:${k}`, Math.round(d), TTL);
  }
}

export const TRACKED = [
  'session_start', 'tutorial_done', 'wallet_connected', 'sign_in', 'match_start', 'match_finish', 'quest_claim', 'checkin', 'combo_solved',
  'bot_buy', 'bot_merge', 'boost', 'pass_claim', 'share', 'challenge_copy', 'referral_landing', 'prize_claim',
];
export const LEDGER = ['taps', 'bots', 'battle:ranked', 'battle:campaign', 'battle:practice', 'battle:challenge', 'quests', 'checkin', 'combo', 'pass', 'clanChest', 'scrap', 'shop:bots', 'merge', 'respec'];

export async function stats(days = 14) {
  const store = kv();
  const out = [];
  for (let i = 0; i < days; i++) {
    const day = dayKey(Date.now() - i * 86_400_000);
    const [dau, cohort, d1, d7] = await Promise.all([store.get<number>(`dau:${day}`), store.get<number>(`cohort:${day}`), store.get<number>(`ret:1:${day}`), store.get<number>(`ret:7:${day}`)]);
    const events: Record<string, number> = {};
    for (const n of TRACKED) events[n] = (await store.get<number>(`ev:${day}:${n}`)) ?? 0;
    const economy: Record<string, number> = {};
    for (const k of LEDGER) economy[k] = (await store.get<number>(`eco:${day}:${k}`)) ?? 0;
    out.push({ day, dau: dau ?? 0, newDevices: cohort ?? 0, d1: d1 ?? 0, d7: d7 ?? 0, events, economy });
  }
  return out;
}
