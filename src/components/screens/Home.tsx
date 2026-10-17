'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Bot, ScrollText, Swords, Zap, Flame, Sparkles as SparkIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChogModel, type AnimCue } from '../three/ChogModel';
import { Stage, World, webglAvailable } from '../three/Scene';
import { ChogSprite } from '../ChogSprite';
import { Bar, Button, ElementBadge, Modal, Panel, Pill, Spark, toast } from '../ui';
import { useGame } from '@/lib/store';
import { fmt, useLoadout, useNow, useProgress, useQuality, useReducedMotion } from '@/lib/hooks';
import { applyTap, collectOffline, currentEnergy, passiveRate } from '@/game/progress';
import { COMBO_WINDOW_MS, MAX_TAPS_PER_SEC, OVERCHARGE_AT, comboMultiplier } from '@/game/tap';
import { xpForLevel } from '@/game/progression';
import { leagueFor } from '@/game/mmr';
import { ARCHETYPES } from '@/game/chog';
import { haptic, sfx } from '@/lib/sound';
import { GuestBanner } from '../GuestBanner';
import { ART, GEAR } from '@/lib/art';
import type { Gear } from '../three/ChogModel';
import { SEASON } from '@/game/season';

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
  const tapTimes = useRef<number[]>([]);
  const fid = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const [gl] = useState(() => webglAvailable());
  const prevLevel = useRef(p.level);

  const energy = currentEnergy(p, lo.energy, now);
  const rate = passiveRate(p, lo.yieldBonus);
  const overcharged = overUntil > now;

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
      const out = applyTap(cur, lo.energy, c.n, over, Math.random(), t);
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
    [lo.energy, overUntil, settings.haptics],
  );

  const league = leagueFor(p.mmr);
  const xpNeed = xpForLevel(p.level);
  const homeColors = useMemo<[string, string]>(() => [lo.look.bg[0], lo.look.bg[1]], [lo.look.bg]);

  return (
    <div className="space-y-3">
      {!lo.isHolder && <GuestBanner />}
      <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
        {/* tap stage */}
        <div ref={stageRef} className="game-surface no-select relative h-[min(62dvh,560px)] min-h-[380px] overflow-hidden rounded-[32px] border border-line shadow-[0_30px_80px_-40px_rgba(30,10,70,0.9)]">
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

          {/* overlays */}
          <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1b1236]/45 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md"><Bot size={13} strokeWidth={1.8} /> {fmt(rate)} / hour</span>
              <span className="eyebrow rounded-full bg-[#1b1236]/45 px-3 py-1 !text-[0.6rem] !text-white/85 backdrop-blur-md">{ARCHETYPES[lo.profile.archetype].name}</span>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <ElementBadge element={lo.profile.element} />
              {comboN > 4 && (
                <div className="rounded-full bg-[#1b1236]/50 px-3 py-1 font-display text-sm font-semibold text-gold backdrop-blur-md">
                  x{comboMultiplier(comboN).toFixed(2)} combo
                </div>
              )}
            </div>
          </div>
          {floaters.map((f) => (
            <div key={f.id} className={`pointer-events-none absolute animate-float-up font-display drop-shadow-[0_2px_0_rgba(0,0,0,0.6)] ${f.crit ? 'text-3xl text-gold' : 'text-2xl text-white'}`} style={{ left: f.x, top: f.y - 20 }}>
              {f.crit ? `CRIT ${f.text}` : f.text}
            </div>
          ))}
          {p.taps < 3 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-36 text-center">
              <span className="inline-block animate-bounce rounded-full bg-white/85 px-5 py-2 font-display text-lg font-semibold text-[#2a1450] shadow-lg">Tap your Chog</span>
            </div>
          )}
          <AnimatePresence>
            {overcharged && (
              <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 top-16 text-center font-display text-4xl font-semibold italic shimmer-text">
                Overcharge ×2
              </motion.div>
            )}
          </AnimatePresence>
          <div className="pointer-events-none absolute inset-x-3 bottom-3 space-y-2 rounded-[22px] bg-[#1b1236]/55 p-3.5 text-white backdrop-blur-xl">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 font-semibold tabular-nums"><Zap size={15} className="text-gold" fill="currentColor" /> {Math.floor(energy)} <span className="text-white/50">/ {lo.energy.cap}</span></span>
              <span className="text-xs text-white/65">+{lo.energy.regenPerSec}/s · {lo.energy.tapPower} per tap</span>
            </div>
            <Bar value={energy} max={lo.energy.cap} color="#ffc861" height={8} label="Energy" />
            <div className="flex items-center gap-2 text-xs font-bold text-white/80">
              <Flame size={14} className={overcharged ? 'text-cheek' : 'text-white/60'} />
              <Bar value={overcharged ? (overUntil - now) / OVERCHARGE_MS : chargePct} max={1} color={overcharged ? '#ff5fa2' : '#9b74f0'} height={5} className="flex-1" label="Overcharge" />
              <span>{overcharged ? 'Overcharged' : 'Charge'}</span>
            </div>
          </div>
        </div>

        {/* side column */}
        <div className="grid content-start gap-3">
          <Panel>
            <div className="flex items-start justify-between">
              <div>
                <div className="eyebrow">Level {p.level} · {lo.ascension.name}</div>
                <div className="mt-2 flex items-center gap-2 font-display text-[2.6rem] font-semibold leading-none tabular-nums"><Spark className="text-[0.8em]" /> {fmt(p.sparks)}</div>
              </div>
              <Button tone="panel" size="sm" onClick={() => setScreen('lab')}>
                <SparkIcon size={15} /> {p.skillPoints > 0 ? `${p.skillPoints} skill pts` : 'Lab'}
              </Button>
            </div>
            <Bar value={p.xp} max={xpNeed} className="mt-4" height={6} label="Experience" />
            <div className="mt-1.5 flex justify-between text-xs text-dim"><span>Experience</span><span className="tabular-nums">{fmt(p.xp)} / {fmt(xpNeed)}</span></div>
          </Panel>
          <Button tone="chog" size="lg" className="w-full !min-h-16 !text-lg" onClick={() => setScreen('battle')}>
            <Swords size={20} strokeWidth={1.8} /> Enter the arena
          </Button>
          <div className="grid grid-cols-3 gap-2">
            {([['bots', 'Bots', <Bot key="b" size={19} strokeWidth={1.8} />], ['quests', 'Quests', <ScrollText key="q" size={19} strokeWidth={1.8} />]] as const).map(([id, label, icon]) => (
              <button key={id} onClick={() => setScreen(id)} className="glass btn-soft flex flex-col items-center gap-1 rounded-[22px] py-3 text-xs font-semibold">
                {icon} {label}
              </button>
            ))}
            <button onClick={() => setScreen('ranks')} className="glass btn-soft flex flex-col items-center gap-0.5 rounded-[22px] py-3 text-xs font-semibold">
              <span className="font-display text-base font-semibold" style={{ color: league.color }}>{league.name}</span>
              <span className="tabular-nums text-dim">{p.mmr} MMR</span>
            </button>
          </div>
          <SeasonBanner onOpen={() => setScreen('quests')} />
        </div>
      </div>

      <FeaturedStrip />

      <Modal open={!!offline} onClose={() => setOffline(null)} title="Welcome back!">
        <div className="flex items-center gap-4">
          <ChogSprite look={lo.look} size={88} />
          <p className="text-dim">
            Your bots kept working for <b className="text-ink">{offline ? offline.hours.toFixed(1) : 0}h</b> and earned
            <span className="mt-1 flex items-center gap-1 font-display text-3xl text-gold"><Spark /> {fmt(offline?.earned ?? 0)}</span>
          </p>
        </div>
        <Button className="mt-4 w-full" tone="gold" onClick={() => { sfx.coin(); setOffline(null); }}>Collect</Button>
      </Modal>
    </div>
  );
}

function SeasonBanner({ onOpen }: { onOpen: () => void }) {
  const days = Math.max(0, Math.ceil((SEASON.end - Date.now()) / 86_400_000));
  return (
    <button onClick={onOpen} className="group relative h-40 overflow-hidden rounded-[28px] border border-line text-left">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ART.heroRunner} alt="" className="absolute inset-0 size-full object-cover object-[30%_40%] transition duration-500 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#1b1236]/90 via-[#1b1236]/40 to-transparent" />
      <div className="relative flex h-full flex-col justify-end p-5 text-white">
        <div className="eyebrow !text-white/70">Season 1 · {days} days left</div>
        <div className="mt-1 font-display text-2xl font-semibold italic">Spikes Rising</div>
        <div className="mt-1 text-sm text-white/80">Speed Runner gear unlocks at pass tier 3.</div>
      </div>
    </button>
  );
}

function FeaturedStrip() {
  const setScreen = useGame((s) => s.setScreen);
  const items = [
    { title: 'The Wild Chog', sub: 'Five zones. One curious creature.', img: ART.heroWild, go: 'campaign' as const, eyebrow: 'Campaign' },
    { title: GEAR[2].name, sub: GEAR[2].tagline, img: GEAR[2].hero, go: 'lab' as const, eyebrow: 'Holder gear' },
    { title: GEAR[1].name, sub: GEAR[1].tagline, img: GEAR[1].hero, go: 'lab' as const, eyebrow: 'Holder gear' },
  ];
  return (
    <section>
      <div className="eyebrow mb-3 mt-2">Featured</div>
      <div className="scroll-x -mx-4 flex snap-x gap-3 px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0">
        {items.map((it) => (
          <button key={it.title} onClick={() => setScreen(it.go)} className="group relative h-56 w-[78%] shrink-0 snap-start overflow-hidden rounded-[28px] border border-line text-left sm:w-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.img} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1b1236]/90 via-[#1b1236]/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 text-white">
              <div className="eyebrow !text-white/70">{it.eyebrow}</div>
              <div className="mt-1 font-display text-xl font-semibold">{it.title}</div>
              <div className="text-sm text-white/75">{it.sub}</div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
