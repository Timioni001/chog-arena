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
        <div ref={stageRef} className="game-surface no-select relative h-[min(60dvh,540px)] min-h-[360px] overflow-hidden rounded-[28px] border border-line bg-panel">
          {gl ? (
            <Stage quality={quality} reducedMotion={reduced} onPointerDown={onTap} className="absolute inset-0 cursor-pointer" camera={[0, 1.35, 5.8]} target={[0, 0.72, 0]} frameWidth={3.3}>
              <World backdrop="home" homeColors={homeColors} />
              <ChogModel look={lo.look} cue={cue} ascension={lo.ascension.ring} />
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
              <Pill className="!bg-black/40 !text-white backdrop-blur"><Bot size={12} /> {fmt(rate)}/h</Pill>
              <Pill className="!bg-black/40 !text-white backdrop-blur">{ARCHETYPES[lo.profile.archetype].name}</Pill>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <ElementBadge element={lo.profile.element} />
              {comboN > 4 && (
                <div className="rounded-full bg-black/45 px-2.5 py-1 font-pixel text-sm text-gold backdrop-blur">
                  x{comboMultiplier(comboN).toFixed(2)} combo
                </div>
              )}
            </div>
          </div>
          {floaters.map((f) => (
            <div key={f.id} className={`pointer-events-none absolute animate-float-up font-pixel drop-shadow-[0_2px_0_rgba(0,0,0,0.6)] ${f.crit ? 'text-3xl text-gold' : 'text-2xl text-white'}`} style={{ left: f.x, top: f.y - 20 }}>
              {f.crit ? `CRIT ${f.text}` : f.text}
            </div>
          ))}
          {p.taps < 3 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-36 text-center font-pixel text-2xl text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.5)]">
              <span className="inline-block animate-bounce">Tap your Chog!</span>
            </div>
          )}
          <AnimatePresence>
            {overcharged && (
              <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 top-16 text-center font-pixel text-3xl shimmer-text">
                OVERCHARGE ×2
              </motion.div>
            )}
          </AnimatePresence>
          <div className="pointer-events-none absolute inset-x-3 bottom-3 space-y-2 rounded-2xl bg-black/45 p-3 text-white backdrop-blur">
            <div className="flex items-center justify-between text-sm font-bold">
              <span className="flex items-center gap-1"><Zap size={16} className="text-gold" /> {Math.floor(energy)} / {lo.energy.cap}</span>
              <span className="text-white/70">+{lo.energy.regenPerSec}/s · {lo.energy.tapPower}/tap</span>
            </div>
            <Bar value={energy} max={lo.energy.cap} color="#ffd166" height={10} label="Energy" />
            <div className="flex items-center gap-2 text-xs font-bold text-white/80">
              <Flame size={14} className={overcharged ? 'text-cheek' : 'text-white/60'} />
              <Bar value={overcharged ? (overUntil - now) / OVERCHARGE_MS : chargePct} max={1} color={overcharged ? '#ff8fc8' : '#a98bff'} height={6} className="flex-1" label="Overcharge" />
              <span>{overcharged ? 'Overcharged' : 'Charge'}</span>
            </div>
          </div>
        </div>

        {/* side column */}
        <div className="grid content-start gap-3">
          <Panel>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-dim">Level {p.level} · {lo.ascension.name}</div>
                <div className="mt-1 flex items-center gap-2 font-pixel text-3xl"><Spark /> {fmt(p.sparks)}</div>
              </div>
              <Button tone="panel" size="sm" onClick={() => setScreen('lab')}>
                <SparkIcon size={16} /> {p.skillPoints > 0 ? `${p.skillPoints} pts` : 'Lab'}
              </Button>
            </div>
            <Bar value={p.xp} max={xpNeed} className="mt-3" label="Experience" />
            <div className="mt-1 text-right text-xs text-dim">{fmt(p.xp)} / {fmt(xpNeed)} XP</div>
          </Panel>
          <div className="grid grid-cols-3 gap-2">
            <Button tone="chog" size="lg" className="col-span-3 !text-xl" onClick={() => setScreen('battle')}>
              <Swords /> Battle
            </Button>
            <Button tone="panel" onClick={() => setScreen('bots')} className="flex-col !gap-0 py-2 text-xs">
              <Bot size={20} /> Bots
            </Button>
            <Button tone="panel" onClick={() => setScreen('quests')} className="flex-col !gap-0 py-2 text-xs">
              <ScrollText size={20} /> Quests
            </Button>
            <Button tone="panel" onClick={() => setScreen('ranks')} className="flex-col !gap-0 py-2 text-xs">
              <span className="font-pixel text-sm" style={{ color: league.color }}>{league.name}</span> {p.mmr}
            </Button>
          </div>
          <Panel className="hidden lg:block">
            <div className="text-sm font-bold text-dim">How Sparks work</div>
            <ul className="mt-2 space-y-1.5 text-sm">
              <li>⚡ Each tap spends 1 energy. Quick taps build a combo up to ×2.</li>
              <li>🔥 Fill the charge bar to Overcharge: double Sparks for 8s.</li>
              <li>🤖 Equipped bots earn every hour, even offline (up to {lo.offlineHours}h).</li>
              <li>🍀 Luck raises your crit chance ({Math.round(lo.energy.critChance * 100)}%): crits pay ×5.</li>
            </ul>
          </Panel>
        </div>
      </div>

      <Modal open={!!offline} onClose={() => setOffline(null)} title="Welcome back!">
        <div className="flex items-center gap-4">
          <ChogSprite look={lo.look} size={88} />
          <p className="text-dim">
            Your bots kept working for <b className="text-ink">{offline ? offline.hours.toFixed(1) : 0}h</b> and earned
            <span className="mt-1 flex items-center gap-1 font-pixel text-3xl text-gold"><Spark /> {fmt(offline?.earned ?? 0)}</span>
          </p>
        </div>
        <Button className="mt-4 w-full" tone="gold" onClick={() => { sfx.coin(); setOffline(null); }}>Collect</Button>
      </Modal>
    </div>
  );
}
