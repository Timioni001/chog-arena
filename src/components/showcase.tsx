'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Lock, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { art, faceOf, VARIANTS, type Variant, type VariantId } from '@/lib/art';
import { useGame } from '@/lib/store';
import { useProgress, useReducedMotion } from '@/lib/hooks';
import { equipGear } from '@/game/progress';
import { sfx } from '@/lib/sound';
import { Img, toast } from './ui';

export function useVariantState() {
  const p = useProgress();
  const update = useGame((s) => s.update);
  const owns = (v: Variant) => v.id === 'wild' || p.cosmetics.includes(`gear-${v.id}`);
  const equipped = (p.gear ?? 'wild') as VariantId;
  const equip = (v: Variant) => {
    if (!owns(v)) return toast.info(`${v.name} unlocks on the ${v.unlock?.track === 'holder' ? 'holder' : 'free'} pass at tier ${v.unlock?.tier}.`);
    if (update((cur) => equipGear(cur, v.id === 'wild' ? null : v.id))) { sfx.buff(); toast.good(`${v.name} equipped.`); }
  };
  return { owns, equipped, equip };
}

export function lockLabel(v: Variant): string {
  return v.unlock ? `${v.unlock.track === 'holder' ? 'Holder' : 'Free'} pass · T${v.unlock.tier}` : 'Starter';
}

/* ------------------------------------------------------------------ fanned carousel */

/** Fanned card carousel, after the console store reference: the active card stands tall in the middle. */
export function CharacterFan({ onPick }: { onPick?: (v: Variant) => void }) {
  const [active, setActive] = useState(1);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const { owns } = useVariantState();
  const n = VARIANTS.length;
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 640);
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  useEffect(() => {
    if (paused || reduced) return;
    const t = setInterval(() => setActive((a) => (a + 1) % n), 4200);
    return () => clearInterval(t);
  }, [paused, reduced, n]);
  const step = (d: number) => { sfx.click(); setActive((a) => (a + d + n) % n); };

  return (
    <section className="relative overflow-hidden rounded-[36px] bg-[#0d0618] px-4 pb-0 pt-10 ring-1 ring-white/5 sm:pt-14" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="grid-bg pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute left-1/2 top-[55%] size-[38rem] -translate-x-1/2 rounded-full bg-grape/35 blur-[110px]" />
      <Img src={art.emote('cyber', 'happy')} className="pointer-events-none absolute left-[7%] top-[18%] hidden w-16 rotate-[-10deg] animate-drift rounded-2xl opacity-80 shadow-lg md:block" />
      <Img src={art.emote('ocean', 'happy')} className="pointer-events-none absolute right-[8%] top-[34%] hidden w-14 rotate-[8deg] animate-drift rounded-2xl opacity-80 shadow-lg [animation-delay:-3s] md:block" />
      <div className="relative mx-auto max-w-xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-lilac ring-1 ring-white/10"><span className="size-1.5 rounded-full bg-gold" /> {VARIANTS.length} variants · earn them on the pass</div>
        <h2 className="mt-4 font-display text-[2.4rem] font-bold leading-[1.02] tracking-[-0.035em] text-mist sm:text-[3.6rem]">Ten looks.<br />One fighter.</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm text-white/55">Every variant dresses your 3D Chog. Your NFT’s traits still decide how it fights.</p>
      </div>

      <div className="relative mx-auto mt-6 h-[300px] max-w-5xl sm:mt-8 sm:h-[400px]">
        {VARIANTS.map((v, i) => {
          let off = i - active;
          if (off > n / 2) off -= n;
          if (off < -n / 2) off += n;
          const a = Math.abs(off);
          const hidden = a > 3;
          return (
            <motion.button
              key={v.id}
              aria-label={off === 0 ? `Open ${v.name}` : `Show ${v.name}`}
              tabIndex={hidden ? -1 : 0}
              onClick={() => (off === 0 ? onPick?.(v) : step(off))}
              className="absolute bottom-0 left-1/2 w-[176px] origin-bottom sm:w-[236px]"
              initial={false}
              animate={{
                x: `calc(-50% + ${off * (narrow ? 118 : 178)}px)`,
                y: a * 26 + (off === 0 ? 0 : 18),
                rotate: off * 6.5,
                scale: 1 - a * 0.07,
                opacity: hidden ? 0 : 1,
                zIndex: 20 - a,
              }}
              transition={{ type: 'spring', stiffness: 220, damping: 28 }}
              style={{ pointerEvents: hidden ? 'none' : 'auto' }}
            >
              <div className="relative h-[262px] overflow-visible rounded-[30px] p-4 text-left shadow-[0_30px_60px_-25px_rgba(0,0,0,0.85)] sm:h-[340px] sm:p-5" style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${v.color} 82%, white), ${v.color} 55%, color-mix(in srgb, ${v.color} 70%, black))`, color: v.ink }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-display text-[1.25rem] font-bold leading-tight sm:text-[1.6rem]">{v.name.split(' ').slice(-1)[0]}</div>
                    <div className="truncate text-[11px] font-medium opacity-70 sm:text-xs">{v.name.split(' ').slice(0, -1).join(' ') || 'Chog'}</div>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-black/25 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">
                    {owns(v) ? <><Check size={11} /> Owned</> : <><Lock size={10} /> T{v.unlock?.tier}</>}
                  </span>
                </div>
                <div className="pointer-events-none absolute inset-x-0 -bottom-1 flex justify-center">
                  <Img src={art.cut(v.id)} className="h-[220px] w-auto max-w-none drop-shadow-[0_18px_22px_rgba(0,0,0,0.4)] sm:h-[290px]" />
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-x-3 bottom-5 z-30 flex items-center justify-between sm:inset-x-6 [&>button]:pointer-events-auto">
        <button onClick={() => step(-1)} className="grid size-11 place-items-center rounded-full bg-mist text-royal shadow-lg" aria-label="Previous"><ChevronLeft size={20} /></button>
        <button onClick={() => step(1)} className="grid size-11 place-items-center rounded-full bg-mist text-royal shadow-lg" aria-label="Next"><ChevronRight size={20} /></button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ profile card */

/** Character profile card, after the squad card reference: big colour, a disc behind the character, bold name. */
export function ProfileCard({ v, onStory, onTry, level }: { v: Variant; onStory?: () => void; onTry?: () => void; level?: number }) {
  const { owns, equipped, equip } = useVariantState();
  const own = owns(v);
  const on = equipped === v.id;
  const dark = isDark(v.color);
  const squad = VARIANTS.filter((x) => x.id !== v.id && x.emotes.length).slice((v.no * 2) % 6, ((v.no * 2) % 6) + 3);
  return (
    <motion.article className="lift group relative flex flex-col overflow-hidden rounded-[30px]" style={{ background: v.color, color: v.ink }}>
      <div className="flex items-center justify-between px-5 pt-5 text-[11px] font-semibold">
        <span className="opacity-60">No. {String(v.no).padStart(2, '0')}</span>
        <span className="flex gap-3"><span>{own ? 'Owned' : 'Locked'}</span><span className="opacity-45">{lockLabel(v)}</span></span>
      </div>
      <div className="relative mx-auto mt-2 aspect-square w-[84%]">
        <div className="absolute inset-[6%] rounded-full" style={{ background: dark ? 'rgba(255,255,255,0.1)' : 'rgba(20,5,31,0.86)' }} />
        <div className="absolute inset-[6%] rounded-full opacity-60 blur-2xl" style={{ background: v.accent }} />
        <Img src={art.cut(v.id)} className="absolute bottom-[2%] left-1/2 h-[100%] w-auto max-w-none -translate-x-1/2 drop-shadow-[0_22px_24px_rgba(0,0,0,0.38)] transition duration-500 group-hover:-translate-y-[calc(0.5rem)] group-hover:scale-[1.03]" />
      </div>
      <div className="flex gap-1.5 px-5"><span className="size-1.5 rounded-full" style={{ background: v.ink }} /><span className="size-1.5 rounded-full opacity-30" style={{ background: v.ink }} /></div>
      <div className="px-5 pt-4">
        <div className="text-[13px] font-semibold" style={{ color: dark ? v.accent : 'color-mix(in srgb, ' + v.ink + ' 70%, ' + v.color + ')' }}>{level ? `Level ${level}` : v.traits.join(' · ')}</div>
        <h3 className="mt-1 font-display text-[2rem] font-bold leading-[1.02] tracking-[-0.03em]">{v.name}</h3>
        <div className="font-display text-[1.45rem] font-light leading-tight opacity-90">{v.role}</div>
        <div className="mt-3 flex items-center gap-3 text-[12px] font-medium">
          <span>{v.tagline}</span>
        </div>
        <div className="mt-2 h-px w-24" style={{ background: v.ink, opacity: 0.6 }} />
        <div className="mt-4 flex items-end justify-between">
          <div className="leading-tight">
            <div className="text-[11px] opacity-70">Squad</div>
            <div className="text-sm font-bold">Chog Arena</div>
          </div>
          <div className="flex gap-1.5">
            {squad.map((s) => <Img key={s.id} src={faceOf(s)} className="size-11 rounded-xl object-cover ring-2 ring-white/40" style={{ background: s.color }} />)}
          </div>
        </div>
      </div>
      <div className="m-3 mt-5 flex items-center justify-between gap-2 rounded-[20px] bg-[#14051f] p-2 pl-4 text-mist">
        <button onClick={onStory} className="text-left text-[12px] font-medium leading-tight">
          <span className="block">Storyboard</span>
          <span className="mt-1 block h-0.5 w-8 rounded-full bg-gold" />
        </button>
        <div className="flex gap-1.5">
          {onTry && <button onClick={onTry} className="min-h-9 rounded-full bg-white/10 px-3 text-[12px] font-semibold hover:bg-white/15">Try in 3D</button>}
          <button onClick={() => equip(v)} className={`flex min-h-9 items-center gap-1 rounded-full px-3.5 text-[12px] font-semibold ${on ? 'bg-lime text-[#05271a]' : own ? 'bg-gold text-[#3a2400]' : 'bg-white/10 text-white/70'}`}>
            {on ? <><Check size={13} /> Equipped</> : own ? 'Equip' : <><Lock size={12} /> {v.unlock?.track === 'holder' ? 'Holder' : 'Free'} T{v.unlock?.tier}</>}
          </button>
        </div>
      </div>
    </motion.article>
  );
}

function isDark(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140;
}

/* ------------------------------------------------------------------ browse grid */

type Filter = 'all' | 'owned' | 'free' | 'holder';

/** "Browse all" grid on a cream page, after the publisher reference: thick-bordered tiles and tag pills. */
export function StoryBrowse() {
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Variant | null>(null);
  const { owns } = useVariantState();
  const list = useMemo(() => VARIANTS.filter((v) => {
    if (q && !`${v.name} ${v.story.title} ${v.traits.join(' ')}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === 'owned') return owns(v);
    if (filter === 'free') return v.unlock?.track === 'free' || !v.unlock;
    if (filter === 'holder') return v.unlock?.track === 'holder';
    return true;
  }), [filter, q, owns]);
  const chips: [Filter, string][] = [['all', 'All stories'], ['owned', 'Owned'], ['free', 'Free pass'], ['holder', 'Holder pass']];
  return (
    <section className="paper rounded-[36px] px-5 py-8 sm:px-10 sm:py-12">
      <div className="flex flex-col gap-4 border-b-2 border-[#14051f] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="font-display text-[2.1rem] font-bold leading-none tracking-[-0.04em] sm:text-[2.8rem]">Browse all stories</h2>
        <label className="flex h-11 w-full items-center gap-2 rounded-full bg-[#14051f] px-4 text-mist sm:w-72">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search stories" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/45" />
          <Search size={16} />
        </label>
      </div>
      <div className="scroll-x mt-5 flex gap-2">
        {chips.map(([id, l]) => (
          <button key={id} onClick={() => setFilter(id)} className={`h-10 shrink-0 rounded-xl px-5 text-[13px] font-semibold transition ${filter === id ? 'bg-[#14051f] text-mist' : 'border-[1.5px] border-dashed border-[#14051f] text-[#14051f] hover:bg-[#14051f]/5'}`}>{l}</button>
        ))}
      </div>
      <div className="mt-7 grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((v) => (
          <button key={v.id} onClick={() => { sfx.click(); setOpen(v); }} className="group text-left">
            <div className="overflow-hidden rounded-[22px] border-[3px] border-[#14051f] bg-[#14051f]">
              <Img src={art.tile(v.id)} className="aspect-[4/3.4] w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
            </div>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="font-display text-[1.45rem] font-medium leading-tight tracking-[-0.02em]">{v.name}</div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1 pt-1">
                {[owns(v) ? 'Owned' : v.unlock ? `${v.unlock.track === 'holder' ? 'Holder' : 'Free'} T${v.unlock.tier}` : 'Starter', v.traits[0]].map((t) => (
                  <span key={t} className="rounded-md bg-[#14051f] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-mist">{t}</span>
                ))}
              </div>
            </div>
            <div className="mt-0.5 text-[12px] font-medium uppercase tracking-[0.08em] text-[#14051f]/55">{v.story.title} · 5 scenes</div>
          </button>
        ))}
        {list.length === 0 && <p className="col-span-full py-10 text-center text-[#14051f]/60">Nothing matches that yet.</p>}
      </div>
      <StoryModal v={open} onClose={() => setOpen(null)} />
    </section>
  );
}

/* ------------------------------------------------------------------ story viewer */

export function StoryModal({ v, onClose }: { v: Variant | null; onClose: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [v]);
  useEffect(() => {
    if (!v) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((x) => Math.min(4, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [v, onClose]);
  return (
    <AnimatePresence>
      {v && (
        <motion.div className="fixed inset-0 z-[55] flex items-end justify-center bg-night/80 p-3 backdrop-blur-md sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div role="dialog" aria-modal="true" aria-label={`${v.name}: ${v.story.title}`} className="relative w-full max-w-3xl overflow-hidden rounded-[32px] bg-[#0d0618] text-mist ring-1 ring-white/10" initial={{ y: 40, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 40, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-black sm:aspect-[16/10]">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div key={i} className="absolute inset-0" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                  <Img src={art.story(v.id, i + 1)} eager className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-2xl" />
                  <Img src={art.story(v.id, i + 1)} eager className="relative mx-auto h-full w-auto max-w-full object-contain" />
                </motion.div>
              </AnimatePresence>
              <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-black/45 backdrop-blur"><X size={18} /></button>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-5 pt-16">
                <div className="eyebrow !text-white/60">{v.name} · {String(i + 1).padStart(2, '0')} / 05</div>
                <div className="mt-1 font-display text-2xl font-semibold">{v.story.frames[i][0]}</div>
                <div className="text-sm text-white/70">{v.story.frames[i][1]}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3">
              <button onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0} className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 disabled:opacity-30" aria-label="Previous scene"><ArrowLeft size={18} /></button>
              <div className="scroll-x flex flex-1 gap-2">
                {v.story.frames.map((f, k) => (
                  <button key={k} onClick={() => setI(k)} className={`h-14 w-20 shrink-0 overflow-hidden rounded-xl ring-2 transition ${k === i ? 'ring-chog-3' : 'opacity-55 ring-transparent hover:opacity-90'}`} aria-label={f[0]}>
                    <Img src={art.story(v.id, k + 1)} className="size-full object-cover" />
                  </button>
                ))}
              </div>
              <button onClick={() => setI((x) => Math.min(4, x + 1))} disabled={i === 4} className="grid size-11 shrink-0 place-items-center rounded-full bg-mist text-royal disabled:opacity-30" aria-label="Next scene"><ArrowRight size={18} /></button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ donut */

export function Donut({ parts, size = 168, stroke = 18, children }: { parts: { value: number; color: string; label: string }[]; size?: number; stroke?: number; children?: React.ReactNode }) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = parts.filter((p) => p.value > 0).length > 1 ? 6 : 0;
  let acc = 0;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={parts.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(', ')}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(209,196,233,0.08)" strokeWidth={stroke} />
        {parts.map((p) => {
          const len = (Math.max(0, p.value) / total) * c;
          const el = len > 0 && (
            <circle key={p.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${Math.max(0.01, len - gap)} ${c}`} strokeDashoffset={-acc} style={{ transition: 'stroke-dasharray 600ms ease' }} />
          );
          acc += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
