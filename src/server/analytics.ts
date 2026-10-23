import 'server-only';
import { kv } from './kv';
import { dayKey } from '@/game/daily';

const TTL = 60 * 60 * 24 * 60;
const NAME = /^[a-z][a-z0-9_]{0,31}$/;

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Counts events per day, daily actives (plus a HyperLogLog for WAU/MAU), and D1/D7/D30 retention by first-seen cohort. */
export async function ingest(device: string, events: { n: string; p?: Record<string, unknown> }[]) {
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(device)) return;
  const day = dayKey();
  const store = kv();
  const seenKey = `seen:${day}:${device}`;
  await store.pfadd(`hll:${day}`, device, TTL);
  if (!(await store.get(seenKey))) {
    await store.set(seenKey, 1, 60 * 60 * 48);
    await store.incr(`dau:${day}`, 1, TTL);
    const first = await store.get<string>(`dev:${device}`);
    if (!first) {
      await store.set(`dev:${device}`, day, TTL);
      await store.incr(`cohort:${day}`, 1, TTL);
      await store.incr('tot:devices', 1);
    } else {
      const diff = daysBetween(first, day);
      if (diff === 1 || diff === 7 || diff === 30) await store.incr(`ret:${diff}:${first}`, 1, TTL);
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
  'bot_buy', 'bot_merge', 'boost', 'pass_claim', 'share', 'challenge_copy', 'referral_landing', 'prize_claim', 'pass_modal', 'pass_bought', 'pool_sponsor',
];
export const LEDGER = ['taps', 'bots', 'battle:ranked', 'battle:campaign', 'battle:practice', 'battle:challenge', 'quests', 'checkin', 'combo', 'pass', 'clanChest', 'scrap', 'shop:bots', 'merge', 'respec'];

export const MODES = ['ranked', 'campaign', 'practice', 'challenge'] as const;

/** Server-verified match counts per mode (the client `match_finish` event can be spoofed; these cannot). */
export async function recordMatch(mode: string, won: boolean | null) {
  const day = dayKey();
  await kv().incr(`srv:${day}:m:${mode}`, 1, TTL);
  if (won) await kv().incr(`srv:${day}:w:${mode}`, 1, TTL);
  await kv().incr('tot:matches', 1);
}

export interface DayStats {
  day: string;
  dau: number;
  newDevices: number;
  d1: number;
  d7: number;
  d30: number;
  events: Record<string, number>;
  economy: Record<string, number>;
  matches: Record<string, { n: number; w: number }>;
}

/** The last `days` days, newest first, read in one MGET. */
export async function stats(days = 14): Promise<DayStats[]> {
  const store = kv();
  const dayList = Array.from({ length: days }, (_, i) => dayKey(Date.now() - i * 86_400_000));
  const fields = (day: string) => [
    `dau:${day}`, `cohort:${day}`, `ret:1:${day}`, `ret:7:${day}`, `ret:30:${day}`,
    ...TRACKED.map((n) => `ev:${day}:${n}`),
    ...LEDGER.map((k) => `eco:${day}:${k}`),
    ...MODES.flatMap((m) => [`srv:${day}:m:${m}`, `srv:${day}:w:${m}`]),
  ];
  const per = fields(dayList[0]).length;
  const vals = await store.mget<number>(dayList.flatMap(fields));
  return dayList.map((day, di) => {
    const v = (j: number) => Number(vals[di * per + j] ?? 0);
    let j = 5;
    const events: Record<string, number> = {};
    for (const n of TRACKED) events[n] = v(j++);
    const economy: Record<string, number> = {};
    for (const k of LEDGER) economy[k] = v(j++);
    const matches: Record<string, { n: number; w: number }> = {};
    for (const m of MODES) { matches[m] = { n: v(j), w: v(j + 1) }; j += 2; }
    return { day, dau: v(0), newDevices: v(1), d1: v(2), d7: v(3), d30: v(4), events, economy, matches };
  });
}

/** Unique devices over the last 1, 7 and 30 days, plus all-time totals. */
export async function reach() {
  const store = kv();
  const keys = (n: number) => Array.from({ length: n }, (_, i) => `hll:${dayKey(Date.now() - i * 86_400_000)}`);
  const [dau, wau, mau, [devices, matches]] = await Promise.all([store.pfcount(keys(1)), store.pfcount(keys(7)), store.pfcount(keys(30)), store.mget<number>(['tot:devices', 'tot:matches'])]);
  return { dau, wau, mau, devices: Number(devices ?? 0), matches: Number(matches ?? 0) };
}
