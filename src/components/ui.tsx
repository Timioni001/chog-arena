'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { create } from 'zustand';
import { ELEMENT_META } from '@/game/elements';
import type { Element } from '@/game/types';
import { sfx } from '@/lib/sound';

type Tone = 'chog' | 'gold' | 'lime' | 'ghost' | 'danger' | 'cheek' | 'panel' | 'light' | 'dark';

const TONES: Record<Tone, string> = {
  chog: 'bg-gradient-to-b from-chog to-grape text-white shadow-[0_12px_30px_-12px_rgba(90,15,175,0.95),inset_0_1px_0_rgba(255,255,255,0.28)] hover:brightness-110',
  light: 'bg-mist text-royal shadow-[0_12px_30px_-14px_rgba(245,235,250,0.55)] hover:bg-white',
  dark: 'bg-night text-mist border border-white/10 hover:bg-black',
  gold: 'bg-gradient-to-b from-[#ffd88a] to-gold text-[#3a2400] shadow-[0_10px_28px_-12px_rgba(255,200,97,0.8),inset_0_1px_0_rgba(255,255,255,0.5)] hover:brightness-105',
  lime: 'bg-gradient-to-b from-[#7cf0c2] to-lime text-[#05271a] shadow-[0_10px_28px_-12px_rgba(75,227,166,0.8),inset_0_1px_0_rgba(255,255,255,0.4)] hover:brightness-105',
  cheek: 'bg-gradient-to-b from-[#ff86b9] to-cheek text-white shadow-[0_10px_28px_-12px_rgba(255,95,162,0.9),inset_0_1px_0_rgba(255,255,255,0.3)] hover:brightness-105',
  danger: 'bg-danger text-white hover:brightness-110',
  ghost: 'bg-transparent text-ink border border-line hover:bg-panel-2',
  panel: 'bg-[color-mix(in_srgb,var(--ink)_11%,transparent)] text-ink border border-line hover:bg-[color-mix(in_srgb,var(--ink)_16%,transparent)]',
};

export function Button({ tone = 'chog', size = 'md', className = '', children, onClick, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 'min-h-14 px-7 text-[1.05rem] rounded-full' : size === 'sm' ? 'min-h-9 px-3.5 text-[0.8rem] rounded-full' : 'min-h-11 px-5 text-[0.92rem] rounded-full';
  return (
    <button
      {...rest}
      onClick={(e) => {
        sfx.click();
        onClick?.(e);
      }}
      className={`btn-soft inline-flex items-center justify-center gap-2 font-semibold tracking-[0.01em] disabled:cursor-not-allowed disabled:opacity-40 disabled:saturate-50 ${sz} ${TONES[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Panel({ children, className = '', ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={`surface rounded-[28px] p-5 ${className}`}>
      {children}
    </div>
  );
}

export function Title({ children, sub, right, eyebrow }: { children: ReactNode; sub?: ReactNode; right?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h2 className="font-display text-[1.5rem] font-semibold leading-tight sm:text-[1.8rem]">{children}</h2>
        {sub && <p className="mt-1 text-sm text-dim">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`eyebrow ${className}`}>{children}</div>;
}

export function Pill({ children, className = '', color }: { children: ReactNode; className?: string; color?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-line bg-panel-2 px-2.5 py-0.5 text-[0.72rem] font-semibold ${className}`} style={color ? { color, borderColor: `${color}55`, background: `${color}18` } : undefined}>
      {children}
    </span>
  );
}

export function Bar({ value, max, color = '#7c4dff', className = '', height = 10, label }: { value: number; max: number; color?: string; className?: string; height?: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className={`overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] ${className}`} style={{ height }} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemax={max} aria-label={label}>
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 55%, white))`, boxShadow: `0 0 12px ${color}66` }} />
    </div>
  );
}

export function ElementBadge({ element, size = 'sm' }: { element: Element; size?: 'sm' | 'md' }) {
  const m = ELEMENT_META[element];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-bold ${size === 'md' ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs'}`} style={{ color: m.color, background: `${m.color}1f`, border: `1px solid ${m.color}55` }} title={`${m.label}: ${m.blurb}`}>
      <span aria-hidden>{m.icon}</span>
      {m.label}
    </span>
  );
}

export function Modal({ open, onClose, children, title, wide }: { open: boolean; onClose: () => void; children: ReactNode; title?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`relative max-h-[88dvh] w-full overflow-y-auto rounded-[28px] border border-line bg-[var(--panel-solid)] p-6 shadow-2xl ${wide ? 'max-w-2xl' : 'max-w-md'}`}
            initial={{ y: 40, scale: 0.96 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 40, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button aria-label="Close" onClick={onClose} className="absolute right-3 top-3 grid size-10 place-items-center rounded-full text-dim hover:bg-panel-2">
              <X size={20} />
            </button>
            {title && <h3 className="mb-3 pr-10 font-display text-2xl font-semibold">{title}</h3>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ------------------------------------------------------------------ toasts

interface Toast {
  id: number;
  text: ReactNode;
  tone: 'info' | 'good' | 'bad';
}
const useToasts = create<{ list: Toast[]; push: (t: Omit<Toast, 'id'>) => void; drop: (id: number) => void }>((set, get) => ({
  list: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set({ list: [...get().list.slice(-2), { ...t, id }] });
    setTimeout(() => get().drop(id), 3200);
  },
  drop: (id) => set({ list: get().list.filter((x) => x.id !== id) }),
}));

export const toast = {
  info: (text: ReactNode) => useToasts.getState().push({ text, tone: 'info' }),
  good: (text: ReactNode) => useToasts.getState().push({ text, tone: 'good' }),
  bad: (text: ReactNode) => {
    sfx.error();
    useToasts.getState().push({ text, tone: 'bad' });
  },
};

export function Toaster() {
  const list = useToasts((s) => s.list);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),0.75rem)] z-[60] flex flex-col items-center gap-2 px-3" aria-live="polite">
      <AnimatePresence>
        {list.map((t) => (
          <motion.div
            key={t.id}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className={`pointer-events-auto max-w-md rounded-2xl border px-4 py-2.5 text-sm font-bold shadow-xl backdrop-blur ${t.tone === 'good' ? 'border-lime/40 bg-[#0f2a18]/90 text-lime' : t.tone === 'bad' ? 'border-danger/40 bg-[#2a0f16]/90 text-[#ffb3bf]' : 'border-line bg-panel/95 text-ink'}`}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items, className = '' }: { value: T; onChange: (v: T) => void; items: { id: T; label: ReactNode }[]; className?: string }) {
  return (
    <div role="tablist" className={`scroll-x surface flex gap-1 rounded-full p-1 ${className}`}>
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          aria-selected={value === it.id}
          onClick={() => onChange(it.id)}
          className={`min-h-10 shrink-0 rounded-full px-4 text-[0.82rem] font-semibold transition ${value === it.id ? 'bg-mist text-royal shadow' : 'text-dim hover:text-ink'}`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Spark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`inline-block size-[1em] ${className}`} aria-hidden>
      <defs><linearGradient id="spk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe3a3" /><stop offset="1" stopColor="#ffb547" /></linearGradient></defs><path d="M12 2c.6 4.3 2.6 6.9 8 8-5.4 1.1-7.4 3.7-8 12-.6-8.3-2.6-10.9-8-12 5.4-1.1 7.4-3.7 8-8z" fill="url(#spk)" />
    </svg>
  );
}

/** Art image: fixed intrinsic size (no layout shift), async decode, lazy unless it is above the fold. */
export function Img({ src, alt = '', className = '', eager, w, h, style }: { src: string; alt?: string; className?: string; eager?: boolean; w?: number; h?: number; style?: React.CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} width={w} height={h} loading={eager ? 'eager' : 'lazy'} decoding="async" draggable={false} className={className} style={style} />;
}
