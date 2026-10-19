'use client';

import { animate, AnimatePresence, motion } from 'framer-motion';
import { Check, Crown, Gift, HandCoins, Lock, Sparkles, Trophy, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { formatUnits, parseUnits } from 'viem';
import { monad } from 'viem/chains';
import { useAccount, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from 'wagmi';
import { create } from 'zustand';
import { CHOG_TOKEN, erc20Abi, PASS_ADDRESS, passAbi, SEASONS_ADDRESS, seasonsAbi } from '@/lib/wagmi';
import { HOLDER_GEAR, PASS, SEASON } from '@/game/season';
import { rankShareBps } from '@/game/prizes';
import { fmt, useLoadout, useNow } from '@/lib/hooks';
import { useGame } from '@/lib/store';
import { art, variantById, type VariantId } from '@/lib/art';
import { track } from '@/lib/analytics';
import { sfx } from '@/lib/sound';
import { Img, Modal, Spark, toast } from './ui';

const SID = BigInt(SEASON.id);

/** Live pool: uncommitted $CHOG in ChogArenaSeasons plus this season's MON in ChogPass. */
export function usePrizePool() {
  const { address } = useAccount();
  const seasons = SEASONS_ADDRESS || undefined;
  const pass = PASS_ADDRESS || undefined;
  const live = { refetchInterval: 30_000 };
  const bal = useReadContract({ address: CHOG_TOKEN, abi: erc20Abi, functionName: 'balanceOf', args: seasons ? [seasons] : undefined, query: { enabled: !!seasons, ...live } });
  const committed = useReadContract({ address: seasons, abi: seasonsAbi, functionName: 'totalCommitted', query: { enabled: !!seasons, ...live } });
  const ps = useReadContract({ address: pass, abi: passAbi, functionName: 'seasons', args: [SID], query: { enabled: !!pass, ...live } });
  const bps = useReadContract({ address: pass, abi: passAbi, functionName: 'prizeBps', query: { enabled: !!pass } });
  const owned = useReadContract({ address: pass, abi: passAbi, functionName: 'hasPass', args: address ? [SID, address] : undefined, query: { enabled: !!pass && !!address } });
  const chog = bal.data !== undefined && committed.data !== undefined ? (bal.data > committed.data ? bal.data - committed.data : 0n) : null;
  const passLive = !!ps.data && ps.data[1] > 0n;
  return {
    chog,
    mon: ps.data ? ps.data[3] : null,
    price: passLive ? ps.data![0] : null,
    sold: ps.data ? ps.data[6] : 0,
    prizeBps: bps.data ?? 5000,
    hasPass: owned.data === true,
    passLive,
    live: chog !== null || passLive,
    refetch: () => { void ps.refetch(); void owned.refetch(); void bal.refetch(); },
  };
}

/** The premium track is free for Chog holders and open to anyone who buys the pass. */
export function usePremium(): { premium: boolean; viaHolder: boolean; viaPass: boolean } {
  const lo = useLoadout();
  const { hasPass } = usePrizePool();
  return { premium: lo.isHolder || hasPass, viaHolder: lo.isHolder, viaPass: hasPass };
}

export const usePassModal = create<{ open: null | 'pass' | 'sponsor'; show: (m: 'pass' | 'sponsor') => void; close: () => void }>((set) => ({
  open: null,
  show: (open) => { track('pass_modal', { kind: open }); set({ open }); },
  close: () => set({ open: null }),
}));

const mon = (v: bigint | null | undefined) => (v === null || v === undefined ? 0 : Number(formatUnits(v, 18)));
const money = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: n >= 100 ? 0 : 2 });

function CountUp({ value, className = '' }: { value: number; className?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const c = animate(shown, value, { duration: 1.4, ease: [0.16, 1, 0.3, 1], onUpdate: setShown });
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <span className={`tnum ${className}`}>{money(shown)}</span>;
}

function useCountdown() {
  const now = useNow(1000);
  const ms = Math.max(0, SEASON.end - now);
  const d = Math.floor(ms / 86_400_000), h = Math.floor((ms / 3_600_000) % 24), m = Math.floor((ms / 60_000) % 60), s = Math.floor((ms / 1000) % 60);
  return { ms, parts: [[d, 'd'], [h, 'h'], [m, 'm'], [s, 's']] as const };
}

const PREMIUM_SPARKS = PASS.reduce((a, t) => a + (t.holder.kind === 'sparks' ? t.holder.amount : 0), 0);
const PREMIUM_GEAR = Object.values(HOLDER_GEAR).map(([id]) => id as VariantId);

/* ------------------------------------------------------------------ prize pool card */

export function PrizePoolCard({ full = false }: { full?: boolean }) {
  const pool = usePrizePool();
  const { premium } = usePremium();
  const show = usePassModal((s) => s.show);
  const { parts, ms } = useCountdown();
  const monPool = mon(pool.mon);
  const chogPool = mon(pool.chog);
  const podium = [2, 1, 3].map((r) => ({ r, bps: rankShareBps(r) }));
  return (
    <section className="relative isolate overflow-hidden rounded-[30px] p-5 text-mist ring-1 ring-gold/25 sm:p-6" style={{ background: 'radial-gradient(120% 90% at 90% -10%, rgba(255,200,97,0.30), transparent 55%), radial-gradient(80% 80% at 0% 100%, rgba(90,15,175,0.55), transparent 60%), linear-gradient(150deg, #34106a, #1a0a2e 55%, #12061f)' }}>
      <div className="grid-bg pointer-events-none absolute inset-0 -z-10 opacity-40" />
      {[0, 1, 2, 3].map((i) => (
        <Spark key={i} className={`pointer-events-none absolute -z-10 animate-drift text-gold/70 ${['right-[8%] top-[22%] text-2xl', 'right-[24%] top-[8%] text-base', 'right-[4%] bottom-[30%] text-lg', 'right-[18%] bottom-[16%] text-sm'][i]}`} />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-b from-[#ffe6a6] to-gold text-[#3a2400] shadow-[0_0_24px_rgba(255,200,97,0.55)]"><Trophy size={20} /></span>
          <div className="leading-tight">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold/90">Season {SEASON.id} prize pool</div>
            <div className="flex items-center gap-1.5 text-xs text-lilac/70">
              <span className="relative flex size-1.5"><span className={`absolute inset-0 rounded-full ${pool.live ? 'animate-ping bg-lime/70' : ''}`} /><span className={`relative size-1.5 rounded-full ${pool.live ? 'bg-lime' : 'bg-lilac/40'}`} /></span>
              {pool.live ? 'Live onchain' : 'Opens with the season'}
            </div>
          </div>
        </div>
        {ms > 0 && (
          <div className="flex gap-1" aria-label="Time left in the season">
            {parts.map(([v, u]) => (
              <span key={u} className="min-w-[2.6rem] rounded-xl bg-black/30 px-1.5 py-1 text-center ring-1 ring-white/10">
                <span className="block font-display text-sm font-semibold leading-none tnum">{String(v).padStart(2, '0')}</span>
                <span className="text-[9px] uppercase text-lilac/60">{u}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5">
        {pool.live ? (
          <>
            <div className="bg-gradient-to-b from-[#fff4d6] to-gold bg-clip-text font-brand text-[2.9rem] leading-none text-transparent drop-shadow-[0_6px_30px_rgba(255,200,97,0.35)] sm:text-[3.6rem]">
              <CountUp value={monPool} /> <span className="text-[0.5em]">MON</span>
            </div>
            {pool.chog !== null && <div className="mt-1.5 font-display text-lg font-semibold text-lilac">+ <CountUp value={chogPool} /> <span className="text-sm text-lilac/70">$CHOG</span></div>}
          </>
        ) : (
          <div className="bg-gradient-to-b from-[#fff4d6] to-gold bg-clip-text font-brand text-[2.4rem] leading-none text-transparent sm:text-[3rem]">Top 100 split the pot</div>
        )}
        <p className="mt-2 max-w-md text-[13px] text-lilac/70">Fed by {pool.prizeBps / 100}% of every Premium Pass, 40% of shop sales and sponsors. Paid out onchain when the season ends.</p>
      </div>

      {full ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.1fr] lg:items-end">
          <div className="flex items-end justify-center gap-2 sm:gap-3">
            {podium.map(({ r, bps }) => (
              <div key={r} className="flex w-24 flex-col items-center sm:w-28">
                <div className="mb-2 text-center">
                  <div className="font-display text-lg font-bold">{bps / 100}%</div>
                  {pool.live && <div className="text-[11px] text-gold/90 tnum">{money((monPool * bps) / 10_000)} MON</div>}
                </div>
                <div className={`grid w-full place-items-start justify-center rounded-t-2xl pt-2 font-brand text-2xl ${r === 1 ? 'h-28 bg-gradient-to-b from-[#ffe6a6] to-gold text-[#3a2400]' : r === 2 ? 'h-20 bg-gradient-to-b from-lilac to-chog-2 text-royal' : 'h-14 bg-gradient-to-b from-[#ffc9a3] to-flame text-[#3a1200]'}`}>#{r}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[['4–10', rankShareBps(4)], ['11–50', rankShareBps(11)], ['51–100', rankShareBps(51)]].map(([l, bps]) => (
              <div key={l} className="rounded-2xl bg-black/25 px-2 py-3 ring-1 ring-white/10">
                <div className="text-[11px] uppercase tracking-wider text-lilac/60">Rank {l}</div>
                <div className="font-display text-lg font-semibold">{Number(bps) / 100}%<span className="text-xs text-lilac/60"> each</span></div>
                {pool.live && <div className="text-[11px] text-gold/90 tnum">{money((monPool * Number(bps)) / 10_000)} MON</div>}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-1.5 text-[11px] font-semibold">
          {[1, 2, 3].map((r) => <span key={r} className="rounded-full bg-black/30 px-2.5 py-1 ring-1 ring-white/10">#{r} · {rankShareBps(r) / 100}%</span>)}
          <span className="rounded-full bg-black/30 px-2.5 py-1 text-lilac/70 ring-1 ring-white/10">Top 100 paid</span>
        </div>
      )}

      <div className={`mt-5 flex flex-wrap gap-2 ${full ? 'lg:justify-end' : ''}`}>
        {premium ? (
          <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-lime/15 px-4 text-sm font-semibold text-lime ring-1 ring-lime/30"><Check size={16} /> Premium active</span>
        ) : (
          <button onClick={() => show('pass')} className="btn-soft inline-flex min-h-11 items-center gap-2 rounded-full bg-gradient-to-b from-[#ffe6a6] to-gold px-5 text-sm font-bold text-[#3a2400] shadow-[0_12px_30px_-10px_rgba(255,200,97,0.8)] hover:brightness-105">
            <Crown size={16} /> Get Premium{pool.price !== null ? ` · ${money(mon(pool.price))} MON` : ''}
          </button>
        )}
        <button onClick={() => show('sponsor')} className="btn-soft inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-mist ring-1 ring-white/20 hover:bg-white/10"><HandCoins size={16} /> Sponsor the pool</button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ premium banner */

export function PremiumPassBanner() {
  const { premium, viaHolder } = usePremium();
  const pool = usePrizePool();
  const show = usePassModal((s) => s.show);
  return (
    <section className="relative isolate overflow-hidden rounded-[30px] p-5 ring-1 ring-gold/25 sm:p-7" style={{ background: 'radial-gradient(90% 120% at 100% 50%, rgba(255,200,97,0.22), transparent 60%), linear-gradient(120deg, #2a0f52, #49225b 55%, #6e3482)' }}>
      <div className="relative z-10 max-w-md">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold ring-1 ring-gold/30"><Crown size={13} /> Premium Pass · Season {SEASON.id}</div>
        <h3 className="mt-3 font-display text-[1.8rem] font-bold leading-[1.05] tracking-[-0.03em] text-mist sm:text-[2.2rem]">{premium ? 'Premium is yours.' : 'Unlock the Premium track.'}</h3>
        <p className="mt-2 text-sm text-lilac/80">
          {premium
            ? viaHolder ? 'Your Chog unlocks every Premium reward this season. Claim them on the track below.' : 'Thanks for backing the season. Every Premium reward on the track below is yours to claim.'
            : `${PREMIUM_GEAR.length} gear sets, the Cinder bot, season trails, the Crown frame and ${fmt(PREMIUM_SPARKS)} bonus Sparks. ${pool.prizeBps / 100}% of the price goes straight into the prize pool.`}
        </p>
        <div className="mt-4">
          {premium ? (
            <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-lime/15 px-4 text-sm font-semibold text-lime ring-1 ring-lime/30"><Check size={16} /> {viaHolder ? 'Unlocked by your Chog' : 'Premium active'}</span>
          ) : (
            <button onClick={() => show('pass')} className="btn-soft inline-flex min-h-12 items-center gap-2 rounded-full bg-gradient-to-b from-[#ffe6a6] to-gold px-6 font-bold text-[#3a2400] shadow-[0_14px_34px_-12px_rgba(255,200,97,0.85)] hover:brightness-105">
              <Crown size={17} /> {pool.price !== null ? `Get Premium · ${money(mon(pool.price))} MON` : 'See what’s inside'}
            </button>
          )}
        </div>
      </div>
      <div className="pointer-events-none absolute -bottom-4 right-[-40px] hidden h-[115%] w-[52%] sm:block">
        {PREMIUM_GEAR.slice(0, 3).map((id, i) => (
          <Img key={id} src={art.cut(id)} className="absolute bottom-0 h-[78%] w-auto drop-shadow-[0_18px_24px_rgba(0,0,0,0.5)]" style={{ left: `${i * 26}%`, zIndex: i === 1 ? 3 : 2, transform: `rotate(${(i - 1) * 6}deg) scale(${i === 1 ? 1.08 : 0.92})` }} />
        ))}
      </div>
      <div className="pointer-events-none mt-4 flex justify-end gap-1 sm:hidden">
        {PREMIUM_GEAR.map((id) => <Img key={id} src={art.cut(id)} className="h-20 w-auto drop-shadow-[0_10px_14px_rgba(0,0,0,0.45)]" />)}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ dialogs */

function useMonadWrite() {
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();
  const client = usePublicClient({ chainId: monad.id });
  // Payable calls carry `value`, which the generic write signature can't infer here.
  const send = async (args: { address: `0x${string}`; abi: typeof passAbi; functionName: 'buy' | 'sponsor'; args: readonly unknown[]; value: bigint; chainId: number }) => {
    if (chainId !== monad.id) await switchChainAsync({ chainId: monad.id });
    const hash = await writeContractAsync(args as never);
    await client?.waitForTransactionReceipt({ hash });
    return hash;
  };
  return { send, isPending };
}

export function PassDialogs() {
  const open = usePassModal((s) => s.open);
  const close = usePassModal((s) => s.close);
  return (
    <>
      <Modal open={open === 'pass'} onClose={close} wide><PassBody onDone={close} /></Modal>
      <Modal open={open === 'sponsor'} onClose={close} title="Sponsor the prize pool"><SponsorBody onDone={close} /></Modal>
    </>
  );
}

function PassBody({ onDone }: { onDone: () => void }) {
  const { address } = useAccount();
  const setScreen = useGame((s) => s.setScreen);
  const pool = usePrizePool();
  const { premium, viaHolder } = usePremium();
  const { send, isPending } = useMonadWrite();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const perks: [React.ReactNode, string, string][] = [
    [<Crown key="c" size={18} />, 'All 30 Premium tiers', 'A second reward on every tier of the season pass.'],
    [<Sparkles key="s" size={18} />, `${PREMIUM_GEAR.length} gear sets`, PREMIUM_GEAR.map((g) => variantById(g).name).join(', ') + '.'],
    [<Gift key="g" size={18} />, 'Cinder bot, trails & Crown frame', 'Exclusive cosmetics that show in every match.'],
    [<Zap key="z" size={18} />, `${fmt(PREMIUM_SPARKS)} bonus Sparks`, 'Paid out tier by tier as you play.'],
    [<Trophy key="t" size={18} />, `${pool.prizeBps / 100}% to the prize pool`, 'Half your pass grows the pot the top 100 split.'],
  ];
  const buy = async () => {
    if (!PASS_ADDRESS || pool.price === null) return;
    setBusy(true);
    try {
      await send({ address: PASS_ADDRESS, abi: passAbi, functionName: 'buy', args: [SID], value: pool.price, chainId: monad.id });
      pool.refetch();
      sfx.level();
      setDone(true);
      track('pass_bought', { season: SEASON.id });
    } catch (e) {
      toast.bad((e as Error).message.split('\n')[0]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="-m-6">
      <div className="relative h-44 overflow-hidden rounded-t-[28px] sm:h-52" style={{ background: 'radial-gradient(70% 90% at 50% 100%, rgba(255,200,97,0.4), transparent 70%), linear-gradient(140deg, #3d0075, #6e3482)' }}>
        <div className="grid-bg absolute inset-0 opacity-50" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-center">
          {PREMIUM_GEAR.map((id, i) => (
            <motion.div key={id} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.08 * i, type: 'spring', stiffness: 260, damping: 22 }}>
              <Img src={art.cut(id)} eager className={`-mx-3 w-auto drop-shadow-[0_14px_20px_rgba(0,0,0,0.45)] ${i === 1 || i === 2 ? 'h-40 sm:h-48' : 'h-32 sm:h-40'}`} />
            </motion.div>
          ))}
        </div>
        <div className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold ring-1 ring-gold/30 backdrop-blur"><Crown size={13} /> Premium Pass</div>
      </div>
      <div className="p-6">
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="py-4 text-center">
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-gradient-to-b from-[#ffe6a6] to-gold text-[#3a2400] shadow-[0_0_40px_rgba(255,200,97,0.6)]"><Crown size={30} /></div>
              <h3 className="mt-4 font-display text-2xl font-bold">Welcome to Premium</h3>
              <p className="mt-1 text-sm text-dim">Your Premium rewards are waiting on the season pass track.</p>
              <button onClick={() => { onDone(); setScreen('quests'); }} className="btn-soft mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-mist px-6 font-semibold text-royal">Claim my rewards</button>
            </motion.div>
          ) : (
            <motion.div key="offer" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h3 className="font-display text-2xl font-bold tracking-[-0.02em]">Season {SEASON.id} Premium Pass</h3>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {perks.map(([icon, t, d]) => (
                  <li key={t} className="flex gap-3 rounded-2xl border border-line bg-panel-2 p-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold">{icon}</span>
                    <span className="min-w-0"><span className="block text-sm font-semibold">{t}</span><span className="block text-xs text-dim">{d}</span></span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-panel-2 p-4 ring-1 ring-line">
                <div>
                  <div className="text-xs text-dim">One season · no subscription</div>
                  <div className="font-brand text-3xl text-gold">{pool.price !== null ? `${money(mon(pool.price))} MON` : 'Opens soon'}</div>
                </div>
                {premium ? (
                  <span className="inline-flex min-h-12 items-center gap-2 rounded-full bg-lime/15 px-5 font-semibold text-lime ring-1 ring-lime/30"><Check size={17} /> {viaHolder ? 'Free with your Chog' : 'You have Premium'}</span>
                ) : !PASS_ADDRESS || pool.price === null ? (
                  <span className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white/5 px-5 text-sm font-semibold text-dim ring-1 ring-line"><Lock size={15} /> Sales open with the season</span>
                ) : !address ? (
                  <button onClick={() => { onDone(); setScreen('profile'); }} className="btn-soft inline-flex min-h-12 items-center gap-2 rounded-full bg-mist px-6 font-semibold text-royal">Connect wallet to buy</button>
                ) : (
                  <button onClick={buy} disabled={busy || isPending} className="btn-soft inline-flex min-h-12 items-center gap-2 rounded-full bg-gradient-to-b from-[#ffe6a6] to-gold px-6 font-bold text-[#3a2400] shadow-[0_14px_34px_-12px_rgba(255,200,97,0.85)] disabled:opacity-60">
                    <Crown size={17} /> {busy ? 'Confirming…' : 'Buy Premium'}
                  </button>
                )}
              </div>
              <p className="mt-3 text-[11px] text-dim">Chog holders get Premium free. Purchases are final and onchain on Monad. Premium unlocks cosmetics and Sparks only: it never changes ranked strength.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SponsorBody({ onDone }: { onDone: () => void }) {
  const { address } = useAccount();
  const setScreen = useGame((s) => s.setScreen);
  const pool = usePrizePool();
  const { send } = useMonadWrite();
  const [amount, setAmount] = useState('5');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const value = useMemo(() => { try { return parseUnits(amount || '0', 18); } catch { return 0n; } }, [amount]);
  const go = async () => {
    if (!PASS_ADDRESS || value <= 0n) return;
    setBusy(true);
    try {
      await send({ address: PASS_ADDRESS, abi: passAbi, functionName: 'sponsor', args: [SID, note.slice(0, 80)], value, chainId: monad.id });
      pool.refetch();
      sfx.coin();
      toast.good(`Thank you! ${amount} MON added to the prize pool.`);
      track('pool_sponsor', { season: SEASON.id });
      onDone();
    } catch (e) {
      toast.bad((e as Error).message.split('\n')[0]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-dim">Every MON you add goes straight to this season’s pool and is paid to the top 100 when the season ends. Projects that sponsor a season can get their name on the season banner: reach out on X.</p>
      <div className="flex flex-wrap gap-2">
        {['1', '5', '25', '100'].map((a) => (
          <button key={a} onClick={() => setAmount(a)} className={`min-h-10 rounded-full px-4 text-sm font-semibold ring-1 transition ${amount === a ? 'bg-gold text-[#3a2400] ring-gold' : 'ring-line hover:bg-panel-2'}`}>{a} MON</button>
        ))}
      </div>
      <label className="block">
        <span className="text-xs font-semibold text-dim">Amount (MON)</span>
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} className="mt-1 h-12 w-full rounded-2xl border border-line bg-panel-2 px-4 font-display text-lg outline-none focus:border-chog-2" />
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-dim">Message (optional, public)</span>
        <input value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} placeholder="gm Chogs" className="mt-1 h-12 w-full rounded-2xl border border-line bg-panel-2 px-4 outline-none focus:border-chog-2" />
      </label>
      {!PASS_ADDRESS || !pool.passLive ? (
        <div className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-white/5 text-sm font-semibold text-dim ring-1 ring-line"><Lock size={15} /> Sponsoring opens with the season</div>
      ) : !address ? (
        <button onClick={() => { onDone(); setScreen('profile'); }} className="btn-soft flex min-h-12 w-full items-center justify-center rounded-full bg-mist font-semibold text-royal">Connect wallet</button>
      ) : (
        <button onClick={go} disabled={busy || value <= 0n} className="btn-soft flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#ffe6a6] to-gold font-bold text-[#3a2400] disabled:opacity-60"><HandCoins size={17} /> {busy ? 'Confirming…' : `Add ${amount || 0} MON to the pool`}</button>
      )}
    </div>
  );
}
