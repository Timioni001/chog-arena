'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { create } from 'zustand';
import { ELEMENT_META } from '@/game/elements';
import type { Element } from '@/game/types';
import { sfx } from '@/lib/sound';

type Tone = 'chog' | 'gold' | 'lime' | 'ghost' | 'danger' | 'cheek' | 'panel';

const TONES: Record<Tone, string> = {
  chog: 'bg-chog text-white hover:brightness-110',
  gold: 'bg-gold text-[#2a1a00] hover:brightness-105',
  lime: 'bg-lime text-[#05210c] hover:brightness-105',
  cheek: 'bg-cheek text-[#3a0a22] hover:brightness-105',
  danger: 'bg-danger text-white hover:brightness-110',
  ghost: 'bg-transparent text-ink border border-line hover:bg-panel-2 shadow-none',
  panel: 'bg-panel-2 text-ink border border-line hover:brightness-110',
};

export function Button({ tone = 'chog', size = 'md', className = '', children, onClick, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 'min-h-14 px-6 text-lg rounded-2xl' : size === 'sm' ? 'min-h-9 px-3 text-sm rounded-xl' : 'min-h-11 px-4 rounded-xl';
  return (
    <button
      {...rest}
      onClick={(e) => {
        sfx.click();
        onClick?.(e);
      }}
      className={`btn-3d inline-flex items-center justify-center gap-2 font-bold disabled:opacity-45 disabled:cursor-not-allowed ${sz} ${TONES[tone]} ${tone === 'ghost' ? '!shadow-none' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

export function Panel({ children, className = '', ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={`rounded-3xl border border-line bg-panel p-4 ${className}`}>
      {children}
    </div>
  );
}

export function Title({ children, sub, right }: { children: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="font-pixel text-xl leading-none sm:text-2xl">{children}</h2>
        {sub && <p className="mt-1 text-sm text-dim">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Pill({ children, className = '', color }: { children: ReactNode; className?: string; color?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-line bg-panel-2 px-2 py-0.5 text-xs font-bold ${className}`} style={color ? { color, borderColor: `${color}55`, background: `${color}18` } : undefined}>
      {children}
    </span>
  );
}

export function Bar({ value, max, color = '#7c4dff', className = '', height = 10, label }: { value: number; max: number; color?: string; className?: string; height?: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className={`overflow-hidden rounded-full bg-panel-2 ${className}`} style={{ height }} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemax={max} aria-label={label}>
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 60%, white))` }} />
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
            className={`relative max-h-[88dvh] w-full overflow-y-auto rounded-3xl border border-line bg-panel p-5 shadow-2xl ${wide ? 'max-w-2xl' : 'max-w-md'}`}
            initial={{ y: 40, scale: 0.96 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 40, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button aria-label="Close" onClick={onClose} className="absolute right-3 top-3 grid size-10 place-items-center rounded-full text-dim hover:bg-panel-2">
              <X size={20} />
            </button>
            {title && <h3 className="mb-3 pr-10 font-pixel text-xl">{title}</h3>}
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
    <div role="tablist" className={`scroll-x flex gap-1 rounded-2xl border border-line bg-panel p-1 ${className}`}>
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          aria-selected={value === it.id}
          onClick={() => onChange(it.id)}
          className={`min-h-10 shrink-0 rounded-xl px-3 text-sm font-bold transition ${value === it.id ? 'bg-chog text-white' : 'text-dim hover:text-ink'}`}
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
      <path d="M12 1.5l2.6 6.7 7 .9-5.3 4.7 1.6 7-5.9-3.7-5.9 3.7 1.6-7L2.4 9.1l7-.9z" fill="#ffd166" stroke="#7a4b00" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
