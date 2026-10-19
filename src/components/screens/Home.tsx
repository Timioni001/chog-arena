'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, BatteryCharging, Bot, ChevronLeft, ChevronRight, Flame, Rocket, Sparkles as SparkIcon, Swords, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChogModel, type AnimCue, type Gear } from '../three/ChogModel';
import { Stage, World, webglAvailable } from '../three/Scene';
import { ChogSprite } from '../ChogSprite';
import { Bar, Button, ElementBadge, Img, Modal, Spark, toast } from '../ui';
import { useGame } from '@/lib/store';
import { fmt, useLoadout, useNow, useProgress, useQuality, useReducedMotion } from '@/lib/hooks';
import { applyTap, boostRefill, boostTurbo, boostsLeft, collectOffline, currentEnergy, passiveRate, TURBO_MS, TURBO_MULT } from '@/game/progress';
import { track } from '@/lib/analytics';
import { COMBO_WINDOW_MS, MAX_TAPS_PER_SEC, OVERCHARGE_AT, comboMultiplier } from '@/game/tap';
import { xpForLevel } from '@/game/progression';
import { leagueFor } from '@/game/mmr';
import { ARCHETYPES } from '@/game/chog';
import { haptic, sfx } from '@/lib/sound';
import { GuestBanner } from '../GuestBanner';
import { art, faceOf, VARIANTS, type Variant } from '@/lib/art';
import { CharacterFan, Donut, StoryBrowse, useVariantState } from '../showcase';
import { PrizePoolCard } from '../PrizePool';
import type { Progress } from '@/game/progress';

interface Floater { id: number; x: number; y: number; text: string; crit: boolean }

const OVERCHARGE_MS = 8000;

export function HomeScreen() {
  const lo = useLoadout();
  const p = useProgress();
  const update = useGame((s) => s.update);
  const setScreen = useGame((s) => s.setScreen);
  const settings = useGame((s) => s.settings);
  const quality = useQuality();
  const reduced = useReducedMotion();
  const now = useNow(250);
  const [cue, setCue] = useState<AnimCue>({ kind: 'idle', id: 0 });
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [offline, setOffline] = useState<{ earned: number; hours: number } | null>(null);
  const combo = useRef({ n: 0, last: 0 });
  const [comboN, setComboN] = useState(0);
  const charge = useRef(0);
  const [chargePct, setChargePct] = useState(0);
  const [overUntil, setOverUntil] = useState(0);
  const [turboUntil, setTurboUntil] = useState(0);
  const tapTimes = useRef<number[]>([]);
  const fid = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const [gl] = useState(() => webglAvailable());
  const prevLevel = useRef(p.level);

  const energy = currentEnergy(p, lo.energy, now);
  const rate = passiveRate(p, lo.yieldBonus);
  const overcharged = overUntil > now;
  const turbo = turboUntil > now;
  const left = boostsLeft(p, now);
  const refill = () => {
    if (update((cur) => boostRefill(cur, lo.energy, Date.now()))) { sfx.level(); toast.good('Full tank!'); track('boost', { kind: 'refill' }); }
    else toast.info(left.refill <= 0 ? 'No refills left today.' : 'Energy is already full.');
  };
  const startTurbo = () => {
    if (update((cur) => boostTurbo(cur, Date.now()))) { setTurboUntil(Date.now() + TURBO_MS); sfx.overcharge(); track('boost', { kind: 'turbo' }); }
    else toast.info('No Turbo left today.');
  };

  // Offline earnings on arrival, then a passive tick.
  useEffect(() => {
    const st = useGame.getState();
    const cur = st.progress[st.activeKey];
    if (!cur) return;
    const r = collectOffline(cur, lo.yieldBonus, lo.offlineHours, Date.now());
    st.update(() => r.p);
    if (r.earned > 0 && r.hours > 0.05) setOffline({ earned: r.earned, hours: r.hours });
    const id = setInterval(() => {
      const s2 = useGame.getState();
      const c2 = s2.progress[s2.activeKey];
      if (c2) s2.update(() => collectOffline(c2, lo.yieldBonus, lo.offlineHours, Date.now()).p);
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lo.tokenId]);

  useEffect(() => {
    if (p.level > prevLevel.current) {
      setCue((c) => ({ kind: 'levelup', id: c.id + 1 }));
      sfx.level();
      haptic([20, 40, 20]);
      toast.good(`Level ${p.level}! +${p.level - prevLevel.current} skill point${p.level - prevLevel.current > 1 ? 's' : ''}`);
    }
    prevLevel.current = p.level;
  }, [p.level]);

  const onTap = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const t = Date.now();
      const recent = tapTimes.current.filter((x) => t - x < 1000);
      if (recent.length >= MAX_TAPS_PER_SEC) return; // fair-play cap
      recent.push(t);
      tapTimes.current = recent;
      const st = useGame.getState();
      const cur = st.progress[st.activeKey];
      if (!cur) return;
      const c = combo.current;
      c.n = t - c.last < COMBO_WINDOW_MS ? c.n + 1 : 0;
      c.last = t;
      const over = overUntil > t;
      const boost = (over ? 2 : 1) * (turboUntil > t ? TURBO_MULT : 1);
      const out = applyTap(cur, lo.energy, c.n, boost, Math.random(), t);
      if (!out.ok) {
        sfx.error();
        setCue((x) => ({ kind: 'hit', id: x.id + 1 }));
        if (c.n % 5 === 0) toast.info('Out of energy: it refills on its own, or battle while you wait.');
        return;
      }
      st.update(() => out.p);
      setComboN(c.n);
      if (!over) {
        charge.current = Math.min(OVERCHARGE_AT, charge.current + 1);
        if (charge.current >= OVERCHARGE_AT) {
          charge.current = 0;
          setOverUntil(t + OVERCHARGE_MS);
          sfx.overcharge();
          haptic([30, 30, 60]);
          setCue((x) => ({ kind: 'charge', id: x.id + 1 }));
        }
        setChargePct(charge.current / OVERCHARGE_AT);
      }
      const rect = stageRef.current?.getBoundingClientRect();
      const x = rect ? e.clientX - rect.left : 0;
      const y = rect ? e.clientY - rect.top : 0;
      const id = ++fid.current;
      setFloaters((f) => [...f.slice(-14), { id, x, y, text: `+${out.gained}`, crit: out.crit }]);
      setTimeout(() => setFloaters((f) => f.filter((z) => z.id !== id)), 900);
      setCue((x2) => ({ kind: 'tap', id: x2.id + 1 }));
      if (out.crit) { sfx.crit(); if (settings.haptics) haptic(25); }
      else { sfx.tap(c.n); if (settings.haptics) haptic(6); }
    },
    [lo.energy, overUntil, turboUntil, settings.haptics],
  );

  const league = leagueFor(p.mmr);
  const xpNeed = xpForLevel(p.level);
  const homeColors = useMemo<[string, string]>(() => [lo.look.bg[0], lo.look.bg[1]], [lo.look.bg]);

  return (
    <div className="space-y-6">
      {!lo.isHolder && <GuestBanner />}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Spotlight />

          <section>
            <SectionHead title="Tap arena" right={<span className="flex items-center gap-2 text-sm text-dim"><span className="size-2 rounded-full" style={{ background: league.color }} /> {league.name} · <span className="tnum">{p.mmr}</span> MMR</span>} />
            <div ref={stageRef} className="game-surface no-select relative h-[min(64dvh,560px)] min-h-[400px] overflow-hidden rounded-[32px] ring-1 ring-line shadow-[0_40px_90px_-50px_rgba(61,0,117,0.95)]">
              {gl ? (
                <Stage quality={quality} reducedMotion={reduced} onPointerDown={onTap} className="absolute inset-0 cursor-pointer" camera={[0, 1.35, 5.8]} target={[0, 0.72, 0]} frameWidth={3.3} frameHeight={4.3}>
                  <World backdrop="home" homeColors={homeColors} />
                  <ChogModel look={lo.look} cue={cue} ascension={lo.ascension.ring} gear={(p.gear as Gear) ?? null} />
                </Stage>
              ) : (
                <div onPointerDown={onTap} className="absolute inset-0 grid cursor-pointer place-items-center" style={{ background: `radial-gradient(circle at 50% 40%, ${lo.look.bg[0]}, ${lo.look.bg[1]})` }}>
                  <motion.div key={cue.id} initial={{ scaleY: 0.86, scaleX: 1.08 }} animate={{ scaleY: 1, scaleX: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 12 }}>
                    <ChogSprite look={lo.look} size={260} background={false} />
                  </motion.div>
                </div>
              )}

              <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-night/50 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md"><Bot size={13} strokeWidth={1.8} /> {fmt(rate)} / hour</span>
                  <span className="eyebrow rounded-full bg-night/50 px-3 py-1 !text-[0.6rem] !text-white/85 backdrop-blur-md">{ARCHETYPES[lo.profile.archetype].name}</span>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <ElementBadge element={lo.profile.element} />
                  {comboN > 4 && (
                    <div className="rounded-full bg-night/55 px-3 py-1 font-brand text-base text-gold backdrop-blur-md">x{comboMultiplier(comboN).toFixed(2)} combo</div>
                  )}
                </div>
              </div>
              {floaters.map((f) => (
                <div key={f.id} className={`pointer-events-none absolute animate-float-up font-brand drop-shadow-[0_2px_0_rgba(0,0,0,0.6)] ${f.crit ? 'text-3xl text-gold' : 'text-2xl text-white'}`} style={{ left: f.x, top: f.y - 20 }}>
                  {f.crit ? `CRIT ${f.text}` : f.text}
                </div>
              ))}
              {p.taps < 3 && (
                <div className="pointer-events-none absolute inset-x-0 bottom-36 text-center">
                  <span className="inline-block animate-bounce rounded-full bg-mist px-5 py-2 font-display text-lg font-semibold text-royal shadow-lg">Tap your Chog</span>
                </div>
              )}
              <AnimatePresence>
                {turbo && !overcharged && (
                  <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 top-16 text-center font-brand text-4xl text-cheek drop-shadow">Turbo ×3</motion.div>
                )}
                {overcharged && (
                  <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 top-16 text-center font-brand text-4xl shimmer-text">Overcharge ×2</motion.div>
                )}
              </AnimatePresence>
              <div className="pointer-events-none absolute inset-x-3 bottom-3 space-y-2 rounded-[22px] bg-night/60 p-3.5 text-white ring-1 ring-white/10 backdrop-blur-xl">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 font-semibold tnum"><Zap size={15} className="text-gold" fill="currentColor" /> {Math.floor(energy)} <span className="text-white/50">/ {lo.energy.cap}</span></span>
                  <span className="text-xs text-white/65">+{lo.energy.regenPerSec}/s · {lo.energy.tapPower} per tap</span>
                </div>
                <Bar value={energy} max={lo.energy.cap} color="#ffc861" height={8} label="Energy" />
                <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
                  <Flame size={14} className={overcharged ? 'text-cheek' : 'text-white/60'} />
                  <Bar value={overcharged ? (overUntil - now) / OVERCHARGE_MS : chargePct} max={1} color={overcharged ? '#ff5fa2' : '#9b7fd8'} height={5} className="flex-1" label="Overcharge" />
                  <span>{overcharged ? 'Overcharged' : 'Charge'}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button onClick={refill} disabled={left.refill <= 0} className="surface btn-soft lift flex items-center gap-3 rounded-[22px] px-4 py-3.5 text-left disabled:opacity-45">
                <span className="grid size-10 place-items-center rounded-2xl bg-gold/15 text-gold"><BatteryCharging size={20} strokeWidth={1.8} /></span>
                <span><span className="block text-sm font-semibold">Full Tank</span><span className="text-xs text-dim">{left.refill}/3 today</span></span>
              </button>
              <button onClick={startTurbo} disabled={left.turbo <= 0 || turbo} className={`surface btn-soft lift flex items-center gap-3 rounded-[22px] px-4 py-3.5 text-left disabled:opacity-45 ${turbo ? 'ring-2 ring-cheek' : ''}`}>
                <span className="grid size-10 place-items-center rounded-2xl bg-cheek/15 text-cheek"><Rocket size={20} strokeWidth={1.8} /></span>
                <span><span className="block text-sm font-semibold">{turbo ? `Turbo ${Math.ceil((turboUntil - now) / 1000)}s` : 'Turbo ×3'}</span><span className="text-xs text-dim">{left.turbo}/3 today</span></span>
              </button>
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <PrizePoolCard />
          <QuickRows rate={rate} league={`${league.name} · ${p.mmr} MMR`} />
          <StatsCard p={p} xpNeed={xpNeed} onLab={() => setScreen('lab')} />
          <SquadCard />
        </aside>
      </div>

      <CharacterFan onPick={() => setScreen('chogs')} />
      <StoryBrowse />

      <Modal open={!!offline} onClose={() => setOffline(null)} title="Welcome back!">
        <div className="flex items-center gap-4">
          <ChogSprite look={lo.look} size={88} />
          <p className="text-dim">
            Your bots kept working for <b className="text-ink">{offline ? offline.hours.toFixed(1) : 0}h</b> and earned
            <span className="mt-1 flex items-center gap-1 font-brand text-3xl text-gold"><Spark /> {fmt(offline?.earned ?? 0)}</span>
          </p>
        </div>
        <Button className="mt-4 w-full" tone="gold" onClick={() => { sfx.coin(); setOffline(null); }}>Collect</Button>
      </Modal>
    </div>
  );
}

function SectionHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="font-display text-[1.35rem] font-semibold tracking-[-0.02em]">{title}</h2>
      {right}
    </div>
  );
}

/** Featured card after the dashboard reference: colour block, copy on the left, the character breaking out of the top. */
function Spotlight() {
  const setScreen = useGame((s) => s.setScreen);
  const reduced = useReducedMotion();
  const { owns, equipped, equip } = useVariantState();
  const [i, setI] = useState(() => Math.max(0, VARIANTS.findIndex((v) => v.id === 'forest')));
  const [hold, setHold] = useState(false);
  useEffect(() => {
    if (hold || reduced) return;
    const t = setTimeout(() => setI((x) => (x + 1) % VARIANTS.length), 7000);
    return () => clearTimeout(t);
  }, [hold, reduced, i]);
  const v = VARIANTS[i];
  const own = owns(v);
  const faces = VARIANTS.filter((x) => x.emotes.length && x.id !== v.id).slice(0, 3);
  return (
    <section className="relative pt-10 sm:pt-12" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}>
      <AnimatePresence mode="wait">
        <motion.div key={v.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35, ease: 'easeOut' }} className="relative h-[236px] rounded-[32px] sm:h-[290px]" style={{ background: `linear-gradient(115deg, color-mix(in srgb, ${v.color} 88%, white) 0%, ${v.color} 38%, #3d0075 100%)`, color: v.ink }}>
          <div className="noise absolute inset-0 overflow-hidden rounded-[32px]">
            <div className="absolute -right-16 -top-24 size-80 rounded-full bg-white/10" />
            <div className="absolute bottom-[-40%] right-[18%] size-72 rounded-full bg-black/15 blur-2xl" />
            <div className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.22),transparent_60%)]" />
          </div>
          <div className="relative flex h-full max-w-[60%] flex-col p-5 sm:max-w-[54%] sm:p-7">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-mist px-3 py-1 text-xs font-semibold text-royal"><SparkIcon size={13} /> {own ? (equipped === v.id ? 'Equipped' : 'Owned') : 'Featured'}</span>
              <span className="hidden rounded-full bg-black/20 px-2.5 py-1 text-[11px] font-semibold backdrop-blur sm:inline" style={{ color: v.ink }}>No. {String(v.no).padStart(2, '0')}</span>
            </div>
            <h2 className="mt-3 font-display text-[1.9rem] font-bold leading-[0.98] tracking-[-0.035em] sm:text-[2.7rem]">{v.name}</h2>
            <p className="mt-2 line-clamp-2 hidden max-w-sm text-[13px] opacity-80 sm:block">{v.blurb}</p>
            <div className="mt-auto flex items-center gap-3">
              <div className="hidden -space-x-2.5 sm:flex">
                {faces.map((f) => <Img key={f.id} src={faceOf(f)} className="size-9 rounded-full object-cover ring-2" style={{ background: f.color, ['--tw-ring-color' as string]: v.color }} />)}
              </div>
              <button onClick={() => (own ? equip(v) : setScreen('chogs'))} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-mist px-4 text-sm font-semibold text-royal shadow-lg hover:bg-white">
                {own ? (equipped === v.id ? 'View Chogs' : 'Equip') : `Unlock · ${v.unlock?.track === 'holder' ? 'Holder' : 'Free'} T${v.unlock?.tier}`} <ArrowUpRight size={15} />
              </button>
            </div>
          </div>
          <Img src={art.cut(v.id)} eager className="pointer-events-none absolute bottom-0 right-[-2%] h-[122%] w-auto max-w-[62%] object-contain object-bottom drop-shadow-[0_26px_30px_rgba(0,0,0,0.45)] sm:right-[3%] sm:h-[128%]" />
        </motion.div>
      </AnimatePresence>
      {/* pager sits top-left, clear of the character breaking out on the right */}
      <div className="absolute left-1 top-0 flex h-9 items-center gap-3 sm:left-2 sm:h-11">
        <span className="font-display text-xs font-semibold tnum text-dim"><span className="text-ink">{String(i + 1).padStart(2, '0')}</span> / {String(VARIANTS.length).padStart(2, '0')}</span>
        <div className="flex items-center gap-1" role="tablist" aria-label="Featured Chogs">
          {VARIANTS.map((x, k) => (
            <button key={x.id} role="tab" aria-selected={k === i} aria-label={x.name} onClick={() => setI(k)} className="group grid h-5 place-items-center">
              <span className={`relative block h-[3px] overflow-hidden rounded-full transition-all duration-300 ${k === i ? 'w-8 bg-white/15' : 'w-3 bg-white/15 group-hover:bg-white/35'}`}>
                {k === i && <span key={`${i}-${hold}`} className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-chog-3 to-mist" style={{ animation: hold || reduced ? 'none' : 'pagerfill 7s linear forwards', width: hold || reduced ? '100%' : undefined }} />}
              </span>
            </button>
          ))}
        </div>
        <div className="hidden items-center gap-1 sm:flex">
          <button onClick={() => setI((x) => (x - 1 + VARIANTS.length) % VARIANTS.length)} className="grid size-7 place-items-center rounded-full text-dim ring-1 ring-white/10 hover:bg-white/5 hover:text-ink" aria-label="Previous featured Chog"><ChevronLeft size={14} /></button>
          <button onClick={() => setI((x) => (x + 1) % VARIANTS.length)} className="grid size-7 place-items-center rounded-full text-dim ring-1 ring-white/10 hover:bg-white/5 hover:text-ink" aria-label="Next featured Chog"><ChevronRight size={14} /></button>
        </div>
      </div>
    </section>
  );
}

function QuickRows({ rate, league }: { rate: number; league: string }) {
  const setScreen = useGame((s) => s.setScreen);
  const rows: { id: 'battle' | 'campaign' | 'quests' | 'bots'; title: string; sub: string; img: string; tint: string; icon?: React.ReactNode }[] = [
    { id: 'battle', title: 'Ranked battle', sub: league, img: art.emote('runner', 'determined'), tint: '#ff6b4a' },
    { id: 'campaign', title: 'Campaign', sub: 'Five zones to clear', img: art.story('forest', 4), tint: '#5edc8c' },
    { id: 'quests', title: 'Daily quests', sub: 'Check in, combo, pass', img: art.emote('crystal', 'happy'), tint: '#d1c4e9' },
    { id: 'bots', title: 'Bots', sub: `${fmt(rate)} Sparks / hour`, img: art.emote('cyber', 'focused'), tint: '#ff4fd8' },
  ];
  return (
    <div className="space-y-2.5">
      <SectionHead title="Jump in" />
      {rows.map((r) => (
        <button key={r.id} onClick={() => { sfx.click(); setScreen(r.id); }} className="surface lift group flex w-full items-center gap-3 rounded-[22px] p-2.5 pr-4 text-left">
          <Img src={r.img} className="size-14 shrink-0 rounded-2xl object-cover" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{r.title}</span>
            <span className="block truncate text-xs" style={{ color: r.tint }}>{r.sub}</span>
          </span>
          <ChevronRight size={18} className="text-dim transition group-hover:translate-x-0.5 group-hover:text-ink" />
        </button>
      ))}
    </div>
  );
}

function StatsCard({ p, xpNeed, onLab }: { p: Progress; xpNeed: number; onLab: () => void }) {
  const L = p.ledger;
  const sum = (pred: (k: string) => boolean) => Object.entries(L).filter(([k, v]) => pred(k) && v > 0).reduce((s, [, v]) => s + v, 0);
  const parts = [
    { label: 'Taps', value: sum((k) => k === 'taps'), color: '#d1c4e9' },
    { label: 'Bots', value: sum((k) => k === 'bots'), color: '#ff5fa2' },
    { label: 'Battles', value: sum((k) => k.startsWith('battle')), color: '#ffc861' },
    { label: 'Rewards', value: sum((k) => ['quests', 'checkin', 'combo', 'pass', 'clanChest'].includes(k)), color: '#63f0ff' },
  ];
  return (
    <div>
      <SectionHead title="Your statistic" right={<button onClick={onLab} className="grid size-9 place-items-center rounded-full text-dim hover:bg-panel-2 hover:text-ink" aria-label="Open Chog Lab"><ArrowUpRight size={18} /></button>} />
      <div className="surface relative overflow-hidden rounded-[30px] p-5">
        <div className="pointer-events-none absolute -top-20 left-1/2 size-64 -translate-x-1/2 rounded-full bg-grape/40 blur-3xl" />
        <div className="relative flex justify-center">
          <Donut parts={parts} size={190} stroke={20}>
            <div>
              <div className="text-[11px] text-dim">Lifetime Sparks</div>
              <div className="font-brand text-[2rem] leading-tight tnum">{fmt(p.lifetimeSparks)}</div>
            </div>
          </Donut>
        </div>
        <div className="relative mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {parts.map((x) => <span key={x.label} className="flex items-center gap-2 text-dim"><span className="size-2 rounded-full" style={{ background: x.color }} />{x.label}<span className="ml-auto text-ink tnum">{fmt(x.value)}</span></span>)}
        </div>
        <div className="relative mt-5 grid grid-cols-3 gap-2 text-center">
          {([['Level', p.level, '#7b3fc0'], ['Wins', p.wins, '#ff5fa2'], ['Taps', p.taps, '#5a0faf']] as const).map(([l, val, c]) => (
            <div key={l} className="flex flex-col items-center gap-1.5">
              <span className="grid size-11 place-items-center rounded-full text-white shadow-lg" style={{ background: c }}>{l === 'Level' ? <SparkIcon size={18} /> : l === 'Wins' ? <Swords size={18} /> : <Zap size={18} />}</span>
              <span className="text-sm font-semibold tnum">{fmt(val)}</span>
              <span className="-mt-1 text-[11px] text-dim">{l}</span>
            </div>
          ))}
        </div>
        <div className="relative mt-4">
          <Bar value={p.xp} max={xpNeed} height={6} color="#9b7fd8" label="Experience" />
          <div className="mt-1.5 flex justify-between text-[11px] text-dim"><span>Level {p.level} → {p.level + 1}</span><span className="tnum">{fmt(p.xp)} / {fmt(xpNeed)} XP</span></div>
        </div>
      </div>
    </div>
  );
}

function SquadCard() {
  const setScreen = useGame((s) => s.setScreen);
  const { owns, equipped } = useVariantState();
  const n = VARIANTS.filter(owns).length;
  return (
    <button onClick={() => setScreen('chogs')} className="surface lift block w-full rounded-[26px] p-4 text-left">
      <div className="flex items-center justify-between">
        <span className="font-semibold">Your Chogs</span>
        <span className="text-xs text-dim">{n} / {VARIANTS.length} unlocked</span>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {VARIANTS.map((v: Variant) => (
          <span key={v.id} className="relative" title={v.name}>
            <Img src={faceOf(v)} className={`aspect-square w-full rounded-2xl object-cover ${owns(v) ? '' : 'opacity-35 grayscale'}`} style={{ background: v.color }} />
            {equipped === v.id && <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-lime ring-2 ring-[var(--panel-solid)]" />}
          </span>
        ))}
      </div>
    </button>
  );
}
