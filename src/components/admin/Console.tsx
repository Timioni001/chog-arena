'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity, BadgeDollarSign, Ban, Coins, Download, ExternalLink, Flame, Gauge, LayoutDashboard, LogOut, Megaphone, PauseCircle,
  PlayCircle, RefreshCw, Search, Server, ShieldCheck, Swords, Trophy, UserRound, Users, Wallet,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';
import { useAccount, useConnect, useWriteContract } from 'wagmi';
import { HBars, Kpi, SplitBar, Status, TimeChart } from './charts';

/* ------------------------------------------------------------------ data */

interface Day { day: string; dau: number; newDevices: number; d1: number; d7: number; d30: number; events: Record<string, number>; economy: Record<string, number>; matches: Record<string, { n: number; w: number }> }
interface Flag { tokenId: number; reason: string; at: number; until: number | null }
interface StatsResp { store: string; days: Day[]; reach: { dau: number; wau: number; mau: number; devices: number; matches: number }; flags: Flag[]; players: { ranked: number; clans: number }; season: { id: number; name: string; start: number; end: number } }
interface Income {
  at: number; block: number;
  pass: null | { address: string; owner: string | null; paused: boolean; treasury: string | null; prizeBps: number; price: number; sold: number; gross: number; toPool: number; toTreasury: number; pool: number; sponsorsAndRollovers: number; claimed: number; treasuryOwed: number; balance: number; end: number; claimDeadline: number; rootSet: boolean };
  shop: null | { address: string; owner: string | null; paused: boolean; treasury: string | null; prizeVault: string | null; burnBps: number; prizeBps: number; items: { id: number; name: string; price: number; sold: number; supply: number; active: boolean; gross: number }[]; gross: number; burned: number; toPrize: number; toTreasury: number };
  vault: null | { address: string; owner: string | null; paused: boolean; balance: number; committed: number; free: number; pool: number; claimed: number; rootSet: boolean };
  treasuries: { address: string; mon: number; chog: number }[];
}
interface Feed { t: number; hash: string; kind: 'pass' | 'sponsor' | 'shop'; who: string; amount: number; asset: 'MON' | 'CHOG'; note?: string }
interface ClaimsMeta { root: string; total: string; count: number; publishedAt: number }
interface IncomeResp { income: Income | null; error: string | null; series: { day: string; mon: number; chog: number; passes: number; snapshot: boolean }[]; feed: Feed[]; claims: { chog: ClaimsMeta | null; mon: ClaimsMeta | null } }
interface Player { tokenId: number; name: string; title: string | null; tier: string | null; element: string; archetype: string; owner: string | null; flag: Flag | null; record: { mmr: number; games: number; wins: number; streak: number; best: number; seasonPoints: number; displayName: string | null; clanId: string | null; address: string | null; updatedAt: number } }
interface TopRow { rank: number; tokenId: number; name: string; score: number; mmr?: number; games?: number; wins?: number; address: string | null }
interface Ops { announcement: { text: string; tone: 'info' | 'event' | 'warn'; until: number | null; at: number } | null; rankedPaused: boolean }
interface OpsResp { ops: Ops; log: { t: number; action: string; detail?: string; ip: string }[] }
interface SystemResp {
  store: { kind: string; ok: boolean; ms: number; error?: string };
  rpc: { ok: boolean; ms: number; block: number | null; host: string; keyed: boolean; error?: string };
  access: { cloudflareAccess: boolean; walletAllowlist: boolean };
  secrets: Record<string, boolean>;
  contracts: Record<string, string | null>;
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path, { cache: 'no-store' });
  if (r.status === 401) { location.reload(); throw new Error('Signed out'); }
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
  return j as T;
}
async function send<T>(path: string, method: 'POST' | 'DELETE', body?: unknown): Promise<T> {
  const r = await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
  return j as T;
}

const n = (v: number, d = 0) => v.toLocaleString('en-US', { maximumFractionDigits: d });
const money = (v: number) => n(v, v < 10 ? 3 : v < 1000 ? 2 : 0);
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const short = (a: string | null | undefined) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—');
const ago = (t: number) => { const s = (Date.now() - t) / 1000; return s < 90 ? 'just now' : s < 5400 ? `${Math.round(s / 60)}m ago` : s < 129600 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`; };
const EXPLORER = 'https://monadvision.com';
const MODES = ['ranked', 'campaign', 'practice', 'challenge'];

/* ------------------------------------------------------------------ shell */

type Tab = 'overview' | 'income' | 'players' | 'ops' | 'system';
const TABS: { id: Tab; label: string; icon: typeof Activity }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'income', label: 'Income', icon: BadgeDollarSign },
  { id: 'players', label: 'Players', icon: Users },
  { id: 'ops', label: 'Live ops', icon: Megaphone },
  { id: 'system', label: 'System', icon: Server },
];

export function AdminConsole() {
  const [tab, setTab] = useState<Tab>('overview');
  const qc = useQueryClient();
  const router = useRouter();
  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => get<StatsResp>('/api/admin/stats'), refetchInterval: 60_000 });
  const income = useQuery({ queryKey: ['admin', 'income'], queryFn: () => get<IncomeResp>('/api/admin/income'), refetchInterval: 120_000 });
  const busy = stats.isFetching || income.isFetching;
  const logout = async () => { await send('/api/admin/session', 'DELETE'); qc.clear(); router.refresh(); };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-[var(--bg)]/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1380px] items-center gap-3 px-4 py-3 sm:px-6">
          <div className="grid size-9 place-items-center rounded-xl bg-chog text-white"><ShieldCheck size={18} /></div>
          <div className="min-w-0 flex-1">
            <div className="font-brand text-lg leading-none">Chog Arena</div>
            <div className="text-xs text-dim">Console · {stats.data ? `${stats.data.season.name} · store ${stats.data.store}` : 'loading'}</div>
          </div>
          <button onClick={() => void qc.invalidateQueries({ queryKey: ['admin'] })} className="flex items-center gap-2 rounded-full border border-line px-3 py-2 text-sm hover:bg-panel-2" aria-label="Refresh data">
            <RefreshCw size={15} className={busy ? 'animate-spin' : ''} /><span className="hidden sm:inline">Refresh</span>
          </button>
          <button onClick={() => void logout()} className="flex items-center gap-2 rounded-full border border-line px-3 py-2 text-sm hover:bg-panel-2" aria-label="Sign out">
            <LogOut size={15} /><span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
        <nav className="mx-auto flex max-w-[1380px] gap-1 overflow-x-auto px-4 pb-2 sm:px-6 lg:hidden" aria-label="Console sections">
          {TABS.map((t) => <TabButton key={t.id} t={t} on={tab === t.id} onClick={() => setTab(t.id)} />)}
        </nav>
      </header>

      <div className="mx-auto flex max-w-[1380px] gap-6 px-4 py-6 sm:px-6">
        <nav className="sticky top-24 hidden h-fit w-52 shrink-0 flex-col gap-1 lg:flex" aria-label="Console sections">
          {TABS.map((t) => <TabButton key={t.id} t={t} on={tab === t.id} onClick={() => setTab(t.id)} rail />)}
          <p className="mt-4 px-3 text-xs text-dim">Auto-refreshes every minute. Revenue is read from the contracts on each load.</p>
        </nav>
        <main className="min-w-0 flex-1 space-y-6">
          {stats.error && <ErrorBox>{(stats.error as Error).message}</ErrorBox>}
          {tab === 'overview' && <Overview stats={stats.data} income={income.data} />}
          {tab === 'income' && <IncomeTab data={income.data} loading={income.isLoading} />}
          {tab === 'players' && <PlayersTab stats={stats.data} />}
          {tab === 'ops' && <OpsTab stats={stats.data} income={income.data} />}
          {tab === 'system' && <SystemTab stats={stats.data} />}
        </main>
      </div>
    </div>
  );
}

function TabButton({ t, on, onClick, rail }: { t: (typeof TABS)[number]; on: boolean; onClick: () => void; rail?: boolean }) {
  const Icon = t.icon;
  return (
    <button onClick={onClick} aria-current={on ? 'page' : undefined} className={`flex shrink-0 items-center gap-2.5 rounded-full px-3.5 py-2 text-sm font-semibold transition ${on ? 'bg-chog text-white' : 'text-dim hover:bg-panel-2 hover:text-ink'} ${rail ? 'w-full rounded-2xl py-2.5' : ''}`}>
      <Icon size={16} /> {t.label}
    </button>
  );
}

function Card({ title, sub, right, children, className = '' }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`surface min-w-0 rounded-3xl p-4 sm:p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div><h2 className="font-display text-lg font-semibold">{title}</h2>{sub && <p className="mt-0.5 text-xs text-dim">{sub}</p>}</div>
        {right}
      </div>
      {children}
    </section>
  );
}

const ErrorBox = ({ children }: { children: ReactNode }) => <div role="alert" className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm">{children}</div>;
const Skeleton = () => <div className="surface h-40 animate-pulse rounded-3xl" />;
const Grid = ({ children, cols = 'grid-cols-2 xl:grid-cols-4' }: { children: ReactNode; cols?: string }) => <div className={`grid gap-4 ${cols}`}>{children}</div>;

/* ------------------------------------------------------------------ overview */

function retention(days: Day[], key: 'd1' | 'd7' | 'd30', lag: number, span = 7) {
  const cohorts = days.slice(lag, lag + span);
  const base = cohorts.reduce((a, d) => a + d.newDevices, 0);
  return { rate: base ? cohorts.reduce((a, d) => a + d[key], 0) / base : null, base };
}

function Overview({ stats, income }: { stats?: StatsResp; income?: IncomeResp }) {
  if (!stats) return <Grid><Skeleton /><Skeleton /><Skeleton /><Skeleton /></Grid>;
  const days = stats.days.slice(0, 30);
  const chrono = [...days].reverse();
  const labels = chrono.map((d) => d.day);
  const [today, yday] = days;
  const matchesOf = (d: Day) => MODES.reduce((a, m) => a + (d.matches[m]?.n ?? 0), 0);
  const d1 = retention(stats.days, 'd1', 1), d7 = retention(stats.days, 'd7', 7), d30 = retention(stats.days, 'd30', 30);
  const rev30 = income?.series.reduce((a, s) => a + s.mon, 0) ?? 0;
  const ev = (k: string) => days.reduce((a, d) => a + (d.events[k] ?? 0), 0);
  const delta = (a: number, b: number) => (b ? (a - b) / b : null);
  const rate = (r: number | null) => (r === null ? '—' : `${Math.round(r * 100)}%`);

  return (
    <>
      <Grid>
        <Kpi icon={<UserRound size={14} />} label="Players today" value={n(today?.dau ?? 0)} delta={delta(today?.dau ?? 0, yday?.dau ?? 0)} sub="vs yesterday" trend={chrono.slice(-14).map((d) => d.dau)} />
        <Kpi icon={<Users size={14} />} label="Weekly / monthly" value={`${n(stats.reach.wau)} / ${n(stats.reach.mau)}`} sub={`stickiness ${pct(stats.reach.dau, stats.reach.mau)} (DAU ÷ MAU)`} />
        <Kpi icon={<Swords size={14} />} label="Matches today" value={n(today ? matchesOf(today) : 0)} delta={delta(today ? matchesOf(today) : 0, yday ? matchesOf(yday) : 0)} sub={`${n(stats.reach.matches)} all time`} trend={chrono.slice(-14).map(matchesOf)} />
        <Kpi icon={<Coins size={14} />} label="Revenue, 30 days" value={<>{money(rev30)} <span className="text-base text-dim">MON</span></>} sub={income?.income?.pass ? `${n(income.income.pass.sold)} passes sold` : 'pass contract not set'} trend={income?.series.slice(-14).map((s) => s.mon)} />
      </Grid>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Daily active players" sub="Unique devices per day, last 30 days" className="xl:col-span-2">
          <TimeChart days={labels} series={[{ name: 'Players', values: chrono.map((d) => d.dau) }]} />
        </Card>
        <Card title="Retention" sub="Share of new players who came back, last 7 cohorts">
          <div className="space-y-4">
            {[['Day 1', d1, 0.35], ['Day 7', d7, 0.15], ['Day 30', d30, 0.06]].map(([label, r, target]) => {
              const v = (r as { rate: number | null; base: number }).rate;
              return (
                <div key={label as string}>
                  <div className="mb-1 flex items-baseline justify-between text-sm"><span>{label as string}</span><span><b className="font-display text-xl tabular-nums">{rate(v)}</b> <span className="text-xs text-dim">target {Math.round((target as number) * 100)}%</span></span></div>
                  <div className="relative h-2 rounded-full bg-panel-2">
                    <div className="h-2 rounded-full bg-chog-2" style={{ width: `${Math.min(100, (v ?? 0) * 100)}%` }} />
                    <div className="absolute -top-1 h-4 w-0.5 rounded bg-ink/70" style={{ left: `${(target as number) * 100}%` }} title="Target" />
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-dim">New players today: <b className="text-ink">{n(today?.newDevices ?? 0)}</b> · all-time devices {n(stats.reach.devices)}</p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Matches by mode" sub="Verified by server replay, last 30 days">
          <TimeChart kind="bars" days={labels} series={MODES.map((m) => ({ name: m[0].toUpperCase() + m.slice(1), values: chrono.map((d) => d.matches[m]?.n ?? 0) }))} />
        </Card>
        <Card title="Player funnel" sub="Event counts over 30 days, each step as a share of the first">
          <HBars rows={[
            { name: 'Opened the game', value: ev('session_start') },
            { name: 'Finished the tutorial', value: ev('tutorial_done') },
            { name: 'Played a match', value: ev('match_start') },
            { name: 'Connected a wallet', value: ev('wallet_connected') },
            { name: 'Signed in', value: ev('sign_in') },
            { name: 'Opened the pass', value: ev('pass_modal') },
            { name: 'Bought the pass', value: ev('pass_bought') },
          ]} />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Win rate by mode" sub="Player wins ÷ matches, 30 days">
          <ul className="space-y-3 text-sm">
            {MODES.map((m) => {
              const t = days.reduce((a, d) => ({ n: a.n + (d.matches[m]?.n ?? 0), w: a.w + (d.matches[m]?.w ?? 0) }), { n: 0, w: 0 });
              return <li key={m} className="flex items-center justify-between capitalize"><span>{m}</span><span className="tabular-nums"><b>{pct(t.w, t.n)}</b> <span className="text-xs text-dim">of {n(t.n)}</span></span></li>;
            })}
          </ul>
          <p className="mt-4 text-xs text-dim">Ranked near 50% means matchmaking is fair. Campaign far above 70% means stages are too easy.</p>
        </Card>
        <Economy days={days} />
      </div>

      <Cohorts days={stats.days.slice(0, 14)} />
    </>
  );
}

function Economy({ days }: { days: Day[] }) {
  const keys = Object.keys(days[0]?.economy ?? {});
  const total = (k: string) => days.reduce((a, d) => a + (d.economy[k] ?? 0), 0);
  const sources = keys.filter((k) => total(k) > 0).sort((a, b) => total(b) - total(a));
  const sinks = keys.filter((k) => total(k) < 0).sort((a, b) => total(a) - total(b));
  const sum = (ks: string[]) => ks.reduce((a, k) => a + total(k), 0);
  const inflow = sum(sources), outflow = -sum(sinks);
  return (
    <Card title="Spark economy" sub="From cloud saves, 30 days" className="xl:col-span-2" right={inflow ? <Status ok={outflow / inflow >= 0.5} warn={outflow / inflow >= 0.25}>sinks {pct(outflow, inflow)} of sources</Status> : undefined}>
      <div className="grid gap-6 sm:grid-cols-2">
        <div><div className="mb-2 text-xs font-semibold uppercase tracking-wider text-dim">Sources · {n(inflow)}</div><HBars rows={sources.slice(0, 6).map((k) => ({ name: k, value: total(k) }))} /></div>
        <div><div className="mb-2 text-xs font-semibold uppercase tracking-wider text-dim">Sinks · {n(outflow)}</div>{sinks.length ? <HBars rows={sinks.slice(0, 6).map((k) => ({ name: k, value: -total(k) }))} /> : <p className="text-sm text-dim">No spending recorded yet.</p>}</div>
      </div>
    </Card>
  );
}

function Cohorts({ days }: { days: Day[] }) {
  // A cohort only has a D7 figure once 7 days have passed; younger cells show a dash, not 0%.
  const cell = (a: number, b: number, mature: boolean) => {
    const show = b > 0 && mature;
    return <td className="px-2 py-1.5 text-right tabular-nums" style={{ background: show ? `rgba(155,127,216,${Math.min(0.55, (a / b) * 1.1)})` : undefined }}>{show ? pct(a, b) : '—'}</td>;
  };
  return (
    <Card title="Daily cohorts" sub="Players first seen that day, and who returned 1, 7 and 30 days later" right={<CsvButton days={days} />}>
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="text-left text-xs text-dim"><tr><th className="px-2 py-1">Day</th><th className="px-2 text-right">Active</th><th className="px-2 text-right">New</th><th className="px-2 text-right">D1</th><th className="px-2 text-right">D7</th><th className="px-2 text-right">D30</th><th className="px-2 text-right">Matches</th></tr></thead>
          <tbody>{days.map((d, i) => (
            <tr key={d.day} className="border-t border-line">
              <td className="px-2 py-1.5">{d.day}</td><td className="px-2 text-right tabular-nums">{n(d.dau)}</td><td className="px-2 text-right tabular-nums">{n(d.newDevices)}</td>
              {cell(d.d1, d.newDevices, i >= 1)}{cell(d.d7, d.newDevices, i >= 7)}{cell(d.d30, d.newDevices, i >= 30)}
              <td className="px-2 text-right tabular-nums">{n(MODES.reduce((a, m) => a + (d.matches[m]?.n ?? 0), 0))}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </Card>
  );
}

function CsvButton({ days }: { days: Day[] }) {
  const download = () => {
    const ev = Object.keys(days[0]?.events ?? {});
    const head = ['day', 'dau', 'new', 'd1', 'd7', 'd30', ...MODES.map((m) => `matches_${m}`), ...ev];
    const rows = days.map((d) => [d.day, d.dau, d.newDevices, d.d1, d.d7, d.d30, ...MODES.map((m) => d.matches[m]?.n ?? 0), ...ev.map((k) => d.events[k] ?? 0)]);
    const url = URL.createObjectURL(new Blob([[head, ...rows].map((r) => r.join(',')).join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `chog-arena-daily-${days[0]?.day ?? 'stats'}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  return <button onClick={download} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-panel-2"><Download size={13} /> CSV</button>;
}

/* ------------------------------------------------------------------ income */

const withdrawAbi = [{ type: 'function', name: 'withdrawTreasury', stateMutability: 'nonpayable', inputs: [], outputs: [] }] as const;

function IncomeTab({ data, loading }: { data?: IncomeResp; loading: boolean }) {
  if (loading || !data) return <Grid><Skeleton /><Skeleton /><Skeleton /><Skeleton /></Grid>;
  const { income, series, feed } = data;
  const p = income?.pass, s = income?.shop, v = income?.vault;
  const labels = series.map((x) => x.day);
  const mon30 = series.reduce((a, x) => a + x.mon, 0), chog30 = series.reduce((a, x) => a + x.chog, 0);
  const treasuryMon = income?.treasuries.reduce((a, t) => a + t.mon, 0) ?? 0;
  return (
    <>
      {data.error && <ErrorBox>{data.error}</ErrorBox>}
      {!p && !s && !v && <ErrorBox>No contracts are configured on this build. Set NEXT_PUBLIC_PASS_ADDRESS, NEXT_PUBLIC_SHOP_ADDRESS and NEXT_PUBLIC_SEASONS_ADDRESS as Cloudflare build variables and redeploy.</ErrorBox>}
      <Grid>
        <Kpi icon={<BadgeDollarSign size={14} />} label="Pass sales" value={<>{money(p?.gross ?? 0)} <span className="text-base text-dim">MON</span></>} sub={p ? `${n(p.sold)} × ${money(p.price)} MON` : 'not deployed'} />
        <Kpi icon={<Wallet size={14} />} label="Your share, withdrawable" value={<>{money(p?.treasuryOwed ?? 0)} <span className="text-base text-dim">MON</span></>} sub={<WithdrawButton pass={p?.address} owed={p?.treasuryOwed ?? 0} />} />
        <Kpi icon={<Coins size={14} />} label="Shop sales" value={<>{money(s?.gross ?? 0)} <span className="text-base text-dim">$CHOG</span></>} sub={s ? `${money(s.toTreasury)} to treasury` : 'not deployed'} />
        <Kpi icon={<Flame size={14} />} label="$CHOG burned" value={money(s?.burned ?? 0)} sub={s ? `${s.burnBps / 100}% of every sale` : 'not deployed'} />
      </Grid>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Daily pass revenue" sub="MON, from daily contract snapshots (a day with no console visit rolls into the next)">
          <TimeChart kind="bars" days={labels} series={[{ name: 'MON', values: series.map((x) => x.mon) }]} digits={3} unit=" MON" />
          <p className="mt-2 text-xs text-dim">30 days: <b className="text-ink">{money(mon30)} MON</b> · {n(series.reduce((a, x) => a + x.passes, 0))} passes</p>
        </Card>
        <Card title="Daily shop revenue" sub="$CHOG, same snapshots">
          <TimeChart kind="bars" days={labels} series={[{ name: '$CHOG', values: series.map((x) => x.chog) }]} digits={2} unit=" $CHOG" />
          <p className="mt-2 text-xs text-dim">30 days: <b className="text-ink">{money(chog30)} $CHOG</b></p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Where pass money goes" sub={p ? `${p.prizeBps / 100}% of each pass funds the prize pool` : 'Premium pass'}>
          {p ? <SplitBar unit="MON" parts={[{ name: 'Prize pool', value: p.toPool }, { name: 'Treasury', value: p.toTreasury }, { name: 'Sponsors & rollovers', value: p.sponsorsAndRollovers }]} /> : <p className="text-sm text-dim">Deploy ChogPass to start selling.</p>}
          {p && <dl className="mt-4 grid grid-cols-2 gap-2 text-sm"><Dt k="Pool now" v={`${money(p.pool)} MON`} /><Dt k="Claimed" v={`${money(p.claimed)} MON`} /><Dt k="Contract balance" v={`${money(p.balance)} MON`} /><Dt k="Price" v={`${money(p.price)} MON`} /></dl>}
        </Card>
        <Card title="Where shop $CHOG goes" sub={s ? `${s.burnBps / 100}% burn · ${s.prizeBps / 100}% prizes · ${(10_000 - s.burnBps - s.prizeBps) / 100}% treasury` : 'ChogShop'}>
          {s ? <SplitBar unit="$CHOG" parts={[{ name: 'Burned', value: s.burned }, { name: 'Prize vault', value: s.toPrize }, { name: 'Treasury', value: s.toTreasury }]} /> : <p className="text-sm text-dim">Deploy ChogShop to sell items for $CHOG.</p>}
          {s && <ul className="mt-4 divide-y divide-line text-sm">{s.items.map((it) => <li key={it.id} className="flex items-center justify-between gap-2 py-1.5"><span className="truncate">{it.name}{!it.active && <span className="ml-1 text-xs text-dim">(off)</span>}</span><span className="tabular-nums text-dim"><b className="text-ink">{n(it.sold)}</b>{it.supply ? `/${n(it.supply)}` : ''} sold</span></li>)}</ul>}
        </Card>
        <Card title="Treasury & vaults" sub={income ? `Block ${n(income.block)} · ${ago(income.at)}` : ''}>
          <ul className="space-y-3 text-sm">
            {income?.treasuries.map((t) => (
              <li key={t.address} className="rounded-2xl bg-panel-2 p-3">
                <div className="flex items-center justify-between"><span className="text-xs text-dim">Treasury</span><Addr a={t.address} /></div>
                <div className="mt-1 font-display text-xl tabular-nums">{money(t.mon)} <span className="text-sm text-dim">MON</span> · {money(t.chog)} <span className="text-sm text-dim">$CHOG</span></div>
              </li>
            ))}
            {v && (
              <li className="rounded-2xl bg-panel-2 p-3">
                <div className="flex items-center justify-between"><span className="text-xs text-dim">$CHOG prize vault</span><Addr a={v.address} /></div>
                <div className="mt-1 font-display text-xl tabular-nums">{money(v.balance)} <span className="text-sm text-dim">$CHOG</span></div>
                <div className="text-xs text-dim">{money(v.committed)} committed to roots · {money(v.free)} free for this season</div>
              </li>
            )}
            {!income?.treasuries.length && !v && <li className="text-dim">Nothing to show until the contracts are live.</li>}
          </ul>
          {treasuryMon > 0 && <p className="mt-3 text-xs text-dim">Treasury MON total {money(treasuryMon)}.</p>}
        </Card>
      </div>

      <Card title="Recent purchases" sub="Pass buys, sponsorships and shop sales made in the app, verified from each transaction receipt">
        {feed.length ? (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs text-dim"><tr><th className="px-2 py-1">When</th><th className="px-2">What</th><th className="px-2">Wallet</th><th className="px-2 text-right">Amount</th><th className="px-2" /></tr></thead>
              <tbody>{feed.map((f) => (
                <tr key={f.hash + f.t} className="border-t border-line">
                  <td className="px-2 py-1.5 text-dim">{ago(f.t)}</td>
                  <td className="px-2">{f.kind === 'pass' ? 'Premium Pass' : f.kind === 'sponsor' ? `Sponsor${f.note ? `: “${f.note}”` : ''}` : f.note ?? 'Shop item'}</td>
                  <td className="px-2"><Addr a={f.who} /></td>
                  <td className="px-2 text-right font-semibold tabular-nums">{money(f.amount)} {f.asset === 'CHOG' ? '$CHOG' : 'MON'}</td>
                  <td className="px-2 text-right"><a href={`${EXPLORER}/tx/${f.hash}`} target="_blank" rel="noreferrer" className="inline-flex text-dim hover:text-ink" aria-label="View transaction"><ExternalLink size={14} /></a></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="text-sm text-dim">No purchases yet. They show up here a few seconds after each transaction lands.</p>}
      </Card>
    </>
  );
}

function WithdrawButton({ pass, owed }: { pass?: string; owed: number }) {
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { writeContractAsync, isPending } = useWriteContract();
  const [msg, setMsg] = useState<string | null>(null);
  if (!pass) return <span>pass contract not set</span>;
  if (!isConnected) return <button className="font-semibold text-chog-2 underline" onClick={() => connectors[0] && connect({ connector: connectors[0] })}>Connect wallet to withdraw</button>;
  return (
    <button
      disabled={owed <= 0 || isPending}
      className="font-semibold text-chog-2 underline disabled:no-underline disabled:opacity-60"
      onClick={async () => {
        try { await writeContractAsync({ address: pass as `0x${string}`, abi: withdrawAbi, functionName: 'withdrawTreasury', chainId: 143 }); setMsg('Sent to treasury'); } catch (e) { setMsg((e as Error).message.split('\n')[0].slice(0, 60)); }
      }}
    >
      {msg ?? (isPending ? 'Confirm in wallet…' : owed > 0 ? 'Withdraw to treasury' : 'Nothing to withdraw')}
    </button>
  );
}

const Dt = ({ k, v }: { k: string; v: ReactNode }) => <div className="rounded-xl bg-panel-2 px-3 py-2"><dt className="text-xs text-dim">{k}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>;
const Addr = ({ a }: { a: string | null | undefined }) => (a ? <a href={`${EXPLORER}/address/${a}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-dim hover:text-ink">{short(a)}</a> : <span className="text-xs text-dim">—</span>);

/* ------------------------------------------------------------------ players */

function PlayersTab({ stats }: { stats?: StatsResp }) {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const board = useQuery({ queryKey: ['admin', 'players'], queryFn: () => get<{ top: TopRow[]; holders: number }>('/api/admin/players') });
  const found = useQuery({ queryKey: ['admin', 'player', search], queryFn: () => get<{ results: Player[] }>(`/api/admin/players?q=${encodeURIComponent(search)}`), enabled: !!search });
  return (
    <>
      <Grid>
        <Kpi icon={<Wallet size={14} />} label="Chog holders" value={n(board.data?.holders ?? 0)} sub="unique wallets onchain" />
        <Kpi icon={<Trophy size={14} />} label="Ranked Chogs" value={n(stats?.players.ranked ?? 0)} sub="played ranked this season" />
        <Kpi icon={<Users size={14} />} label="Clans" value={n(stats?.players.clans ?? 0)} />
        <Kpi icon={<Ban size={14} />} label="Flagged" value={n(stats?.flags.length ?? 0)} sub="hidden from prize boards" />
      </Grid>

      <Card title="Find a player" sub="Search by Chog token id or wallet address">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }}>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-line bg-panel-2 px-3 focus-within:border-chog-2">
            <Search size={16} className="text-dim" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="#1234 or 0x…" className="min-w-0 flex-1 bg-transparent py-2.5 outline-none" aria-label="Token id or wallet" />
          </div>
          <button className="rounded-full bg-chog px-5 font-semibold text-white hover:bg-grape">Search</button>
        </form>
        {found.error && <p className="mt-3 text-sm text-danger">{(found.error as Error).message}</p>}
        {found.data && !found.data.results.length && <p className="mt-3 text-sm text-dim">That wallet holds no Chogs.</p>}
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {found.data?.results.map((p) => <PlayerCard key={p.tokenId} p={p} onChange={() => { void qc.invalidateQueries({ queryKey: ['admin'] }); }} />)}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Season leaderboard" sub="Top 25 by season points" className="xl:col-span-2">
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[460px] text-sm">
              <thead className="text-left text-xs text-dim"><tr><th className="px-2 py-1">#</th><th className="px-2">Chog</th><th className="px-2 text-right">Points</th><th className="px-2 text-right">W/L</th><th className="px-2">Wallet</th></tr></thead>
              <tbody>{board.data?.top.map((r) => (
                <tr key={r.tokenId} className="cursor-pointer border-t border-line hover:bg-panel-2" onClick={() => { setQ(String(r.tokenId)); setSearch(String(r.tokenId)); }}>
                  <td className="px-2 py-1.5 tabular-nums text-dim">{r.rank}</td>
                  <td className="px-2"><span className="font-semibold">{r.name}</span> <span className="text-xs text-dim">#{r.tokenId}</span></td>
                  <td className="px-2 text-right tabular-nums">{n(r.score)}</td>
                  <td className="px-2 text-right tabular-nums text-dim">{r.wins ?? '–'}/{r.games !== undefined && r.wins !== undefined ? r.games - r.wins : '–'}</td>
                  <td className="px-2"><Addr a={r.address} /></td>
                </tr>
              ))}</tbody>
            </table>
            {board.data && !board.data.top.length && <p className="px-2 text-sm text-dim">No ranked matches this season yet.</p>}
          </div>
        </Card>
        <FlagsCard flags={stats?.flags ?? []} />
      </div>
    </>
  );
}

function PlayerCard({ p, onChange }: { p: Player; onChange: () => void }) {
  const [reason, setReason] = useState('');
  const [days, setDays] = useState('');
  const act = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), onSuccess: onChange });
  const r = p.record;
  return (
    <div className="rounded-2xl border border-line bg-panel-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-display text-lg font-semibold">{r.displayName ?? p.name} <span className="text-sm text-dim">#{p.tokenId}</span></div>
          <div className="text-xs capitalize text-dim">{[p.tier, p.element, p.archetype].filter(Boolean).join(' · ')}</div>
        </div>
        {p.flag ? <Status ok={false}>flagged</Status> : <Status ok>clean</Status>}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm"><Dt k="MMR" v={n(r.mmr)} /><Dt k="Record" v={`${r.wins}-${r.games - r.wins}`} /><Dt k="Points" v={n(r.seasonPoints)} /></dl>
      <div className="mt-2 text-xs text-dim">Owner <Addr a={p.owner} />{r.clanId && ` · clan ${r.clanId}`} · best streak {r.best}{r.updatedAt ? ` · last ranked ${ago(r.updatedAt)}` : ''}</div>
      {p.flag && <p className="mt-2 text-xs">Flag: {p.flag.reason}{p.flag.until ? ` (lifts ${new Date(p.flag.until).toLocaleDateString()})` : ''}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {p.flag ? (
          <button className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-panel" onClick={() => act.mutate(() => send('/api/admin/flags', 'DELETE', { tokenId: p.tokenId }))}>Clear flag</button>
        ) : (
          <>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Public reason" className="min-w-0 flex-1 rounded-full border border-line bg-transparent px-3 py-1.5 text-xs" />
            <input value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} placeholder="Days" className="w-16 rounded-full border border-line bg-transparent px-3 py-1.5 text-xs" aria-label="Days (blank until reviewed)" />
            <button disabled={!reason.trim()} className="rounded-full bg-danger px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50" onClick={() => act.mutate(() => send('/api/admin/flags', 'POST', { tokenId: p.tokenId, reason, days: days ? Number(days) : null }))}>Flag</button>
          </>
        )}
        {r.displayName && <button className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-panel" onClick={() => act.mutate(() => send('/api/admin/players', 'POST', { action: 'reset_name', tokenId: p.tokenId }))}>Reset name</button>}
      </div>
      {act.error && <p className="mt-2 text-xs text-danger">{(act.error as Error).message}</p>}
    </div>
  );
}

function FlagsCard({ flags }: { flags: Flag[] }) {
  const qc = useQueryClient();
  return (
    <Card title={`Flags (${flags.length})`} sub="Public list; flagged Chogs are hidden from prize boards">
      {flags.length ? (
        <ul className="divide-y divide-line text-sm">{flags.map((f) => (
          <li key={f.tokenId} className="flex items-center gap-2 py-2">
            <div className="min-w-0 flex-1"><b>#{f.tokenId}</b> <span className="text-dim">{f.reason}</span><div className="text-xs text-dim">{ago(f.at)}{f.until ? ` · lifts ${new Date(f.until).toLocaleDateString()}` : ' · until reviewed'}</div></div>
            <button className="rounded-full border border-line px-2.5 py-1 text-xs hover:bg-panel-2" onClick={async () => { await send('/api/admin/flags', 'DELETE', { tokenId: f.tokenId }); void qc.invalidateQueries({ queryKey: ['admin'] }); }}>Clear</button>
          </li>
        ))}</ul>
      ) : <p className="text-sm text-dim">Nobody is flagged.</p>}
    </Card>
  );
}

/* ------------------------------------------------------------------ live ops */

function OpsTab({ stats, income }: { stats?: StatsResp; income?: IncomeResp }) {
  const qc = useQueryClient();
  const ops = useQuery({ queryKey: ['admin', 'ops'], queryFn: () => get<OpsResp>('/api/admin/ops') });
  const [text, setText] = useState('');
  const [tone, setTone] = useState<'info' | 'event' | 'warn'>('event');
  const [hours, setHours] = useState('24');
  const save = useMutation({ mutationFn: (body: unknown) => send('/api/admin/ops', 'POST', body), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ops'] }) });
  const o = ops.data?.ops;
  const season = stats?.season;
  const left = season ? season.end - Date.now() : 0;
  const claims = income?.claims;
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Announcement banner" sub="Shows at the top of the game for every player">
          {o?.announcement && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-chog-2/40 bg-chog/15 p-3 text-sm">
              <Megaphone size={16} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1"><p>{o.announcement.text}</p><p className="mt-1 text-xs text-dim">Live · {o.announcement.until ? `ends ${new Date(o.announcement.until).toLocaleString()}` : 'until cleared'}</p></div>
              <button className="rounded-full border border-line px-3 py-1 text-xs" onClick={() => save.mutate({ announcement: null })}>Take down</button>
            </div>
          )}
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 160))} rows={3} placeholder="Double Spark weekend starts now! Ranked boards reset Monday." className="w-full rounded-2xl border border-line bg-panel-2 p-3 text-sm outline-none focus:border-chog-2" />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            {(['event', 'info', 'warn'] as const).map((t) => <button key={t} onClick={() => setTone(t)} className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${tone === t ? 'bg-chog text-white' : 'border border-line text-dim'}`}>{t}</button>)}
            <label className="ml-auto flex items-center gap-1.5 text-xs text-dim">for <input value={hours} onChange={(e) => setHours(e.target.value.replace(/\D/g, ''))} className="w-12 rounded-full border border-line bg-transparent px-2 py-1 text-center text-ink" /> h (blank = until cleared)</label>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-xs text-dim">{text.length}/160</span>
            <button disabled={!text.trim() || save.isPending} onClick={() => save.mutate({ announcement: { text, tone, hours: hours ? Number(hours) : null } }, { onSuccess: () => setText('') })} className="rounded-full bg-chog px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">Publish</button>
          </div>
          {save.error && <p className="mt-2 text-xs text-danger">{(save.error as Error).message}</p>}
        </Card>

        <Card title="Ranked kill switch" sub="Stops new ranked matches (matches in progress still finish). Use it for exploits, migrations or outages.">
          <div className="flex items-center gap-4 rounded-2xl bg-panel-2 p-4">
            {o?.rankedPaused ? <PauseCircle size={28} className="text-danger" /> : <PlayCircle size={28} className="text-lime" />}
            <div className="flex-1"><div className="font-display text-xl font-semibold">{o?.rankedPaused ? 'Ranked is paused' : 'Ranked is live'}</div><div className="text-xs text-dim">Players see a maintenance banner while paused.</div></div>
            <button onClick={() => save.mutate({ rankedPaused: !o?.rankedPaused })} className={`rounded-full px-4 py-2 text-sm font-semibold ${o?.rankedPaused ? 'bg-lime text-night' : 'bg-danger text-white'}`}>{o?.rankedPaused ? 'Resume' : 'Pause'}</button>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title={season?.name ?? 'Season'} sub={season ? `${new Date(season.start).toLocaleDateString()} to ${new Date(season.end).toLocaleDateString()}` : ''}>
          <div className="font-display text-4xl font-semibold tabular-nums">{left > 0 ? `${Math.floor(left / 86_400_000)}d ${Math.floor((left % 86_400_000) / 3_600_000)}h` : 'Ended'}</div>
          <p className="text-xs text-dim">{left > 0 ? 'until the season snapshot' : 'Build and publish the prize roots below.'}</p>
          {season && <div className="mt-4 h-2 rounded-full bg-panel-2"><div className="h-2 rounded-full bg-chog-2" style={{ width: `${Math.min(100, Math.max(0, ((Date.now() - season.start) / (season.end - season.start)) * 100))}%` }} /></div>}
        </Card>
        <Card title="Prize payouts" sub="Published claim lists vs the root onchain" className="xl:col-span-2">
          <ul className="space-y-3 text-sm">
            <PayoutRow label="MON pool (ChogPass)" meta={claims?.mon ?? null} onchain={income?.income?.pass?.rootSet ?? false} pool={income?.income?.pass ? `${money(income.income.pass.pool)} MON` : null} />
            <PayoutRow label="$CHOG pool (Seasons vault)" meta={claims?.chog ?? null} onchain={income?.income?.vault?.rootSet ?? false} pool={income?.income?.vault ? `${money(income.income.vault.free)} $CHOG free` : null} />
          </ul>
          <p className="mt-4 text-xs text-dim">After the season ends: run <code>npm run prizes:build -- --season {season?.id ?? 1} --publish</code> (add <code>--asset mon</code> for MON), then call <code>setPrizeRoot</code> from the owner multisig. Steps are in docs/DEPLOY.md.</p>
        </Card>
      </div>

      <Card title="Admin activity" sub="Every sign-in and action, newest first">
        <AuditList log={ops.data?.log ?? []} />
      </Card>
    </>
  );
}

function PayoutRow({ label, meta, onchain, pool }: { label: string; meta: ClaimsMeta | null; onchain: boolean; pool: string | null }) {
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-2xl bg-panel-2 p-3">
      <div className="min-w-0 flex-1"><div className="font-semibold">{label}</div><div className="text-xs text-dim">{pool ?? 'contract not set'}{meta ? ` · ${n(meta.count)} winners · published ${ago(meta.publishedAt)}` : ''}</div></div>
      <Status ok={!!meta} warn={!meta}>{meta ? 'list published' : 'list not published'}</Status>
      <Status ok={onchain} warn={!onchain}>{onchain ? 'root onchain' : 'root not set'}</Status>
    </li>
  );
}

function AuditList({ log }: { log: OpsResp['log'] }) {
  if (!log.length) return <p className="text-sm text-dim">No activity yet.</p>;
  return (
    <ul className="divide-y divide-line text-sm">
      {log.map((e) => (
        <li key={e.t + e.action} className="flex flex-wrap items-baseline gap-x-3 py-2">
          <span className={`font-semibold ${e.action === 'login_failed' ? 'text-danger' : ''}`}>{e.action.replace(/_/g, ' ')}</span>
          <span className="min-w-0 flex-1 truncate text-dim">{e.detail}</span>
          <span className="text-xs text-dim">{ago(e.t)} · {e.ip}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ system */

function SystemTab({ stats }: { stats?: StatsResp }) {
  const sys = useQuery({ queryKey: ['admin', 'system'], queryFn: () => get<SystemResp>('/api/admin/system') });
  const d = sys.data;
  const contracts = useMemo(() => Object.entries(d?.contracts ?? {}), [d]);
  if (!d) return <Grid><Skeleton /><Skeleton /></Grid>;
  return (
    <>
      <Grid>
        <Kpi icon={<Gauge size={14} />} label="Database" value={`${d.store.ms} ms`} sub={<Status ok={d.store.ok && d.store.kind === 'upstash'} warn={d.store.ok}>{d.store.kind}</Status>} />
        <Kpi icon={<Activity size={14} />} label="Monad RPC" value={`${d.rpc.ms} ms`} sub={<Status ok={d.rpc.ok}>{d.rpc.block ? `block ${n(d.rpc.block)}` : 'down'}</Status>} />
        <Kpi icon={<ShieldCheck size={14} />} label="Access" value={d.access.cloudflareAccess && d.access.walletAllowlist ? '3 layers' : d.access.cloudflareAccess || d.access.walletAllowlist ? '2 layers' : 'Token only'} sub={<Status ok={d.access.cloudflareAccess} warn>{d.access.cloudflareAccess ? 'Cloudflare Access on' : 'add Cloudflare Access'}</Status>} />
        <Kpi icon={<Users size={14} />} label="Data window" value={`${stats?.days.length ?? 0} days`} sub="daily keys expire after 60 days" />
      </Grid>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Secrets" sub="Set or not; values are never sent to the browser">
          <ul className="grid gap-2 sm:grid-cols-2">
            {Object.entries(d.secrets).map(([k, v]) => <li key={k} className="flex items-center justify-between gap-2 rounded-xl bg-panel-2 px-3 py-2 text-xs"><code className="truncate">{k}</code><Status ok={v} warn={k === 'ADMIN_ADDRESSES' || k === 'ATTESTOR_PRIVATE_KEY'}>{v ? 'set' : 'missing'}</Status></li>)}
          </ul>
          <p className="mt-3 text-xs text-dim">RPC host <code>{d.rpc.host}</code>{d.rpc.keyed ? ' (private endpoint)' : ' (public endpoint: set MONAD_RPC_URL as a secret)'}.</p>
        </Card>
        <Card title="Contracts" sub="Addresses baked into this build">
          <ul className="divide-y divide-line text-sm">
            {contracts.map(([k, v]) => <li key={k} className="flex items-center justify-between gap-2 py-2"><span className="capitalize">{k}</span>{v ? <Addr a={v} /> : <Status ok={false} warn>not set</Status>}</li>)}
          </ul>
        </Card>
      </div>
      <Card title="Lock it down" sub="Recommended setup for chog-arena.online">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-dim">
          <li><b className="text-ink">Cloudflare Access</b>: Zero Trust → Access → Applications → Self-hosted. Add <code>chog-arena.online/admin</code> and <code>chog-arena.online/api/admin</code>, policy “Allow · Emails · your email”, login method One-time PIN.</li>
          <li><b className="text-ink">Wallet allowlist</b>: add the Worker secret <code>ADMIN_ADDRESSES</code> with your wallet. Sign-in then also needs that wallet signed in to the game.</li>
          <li><b className="text-ink">Token</b>: rotate <code>ADMIN_TOKEN</code> any time; every browser is signed out at once.</li>
        </ol>
        <p className="mt-3 text-xs text-dim">Full steps: docs/ADMIN.md.</p>
      </Card>
    </>
  );
}
