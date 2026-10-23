'use client';

import { useQuery } from '@tanstack/react-query';
import { Megaphone, PauseCircle, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Ops { announcement: { text: string; tone: 'info' | 'event' | 'warn'; at: number } | null; rankedPaused: boolean }

const TONE = {
  info: { icon: Megaphone, cls: 'border-chog-2/40 bg-chog/15' },
  event: { icon: Sparkles, cls: 'border-gold/40 bg-gold/10' },
  warn: { icon: PauseCircle, cls: 'border-danger/40 bg-danger/10' },
} as const;

/** Live-ops banner set from /admin. Dismissing hides that one announcement on this device. */
export function Announcement() {
  const q = useQuery({ queryKey: ['ops'], queryFn: () => fetch('/api/ops').then((r) => r.json() as Promise<Ops>), refetchInterval: 120_000, staleTime: 60_000 });
  const [hidden, setHidden] = useState<number | null>(null);
  useEffect(() => { try { setHidden(Number(localStorage.getItem('ca_ann_hidden')) || null); } catch { /* ignore */ } }, []);
  const a = q.data?.announcement;
  const msg = a && a.at !== hidden ? a : q.data?.rankedPaused ? { text: 'Ranked is paused for maintenance. Practice and campaign are open.', tone: 'warn' as const, at: -1 } : null;
  if (!msg) return null;
  const { icon: Icon, cls } = TONE[msg.tone];
  return (
    <div role="status" className={`mx-4 mb-2 flex items-center gap-3 rounded-2xl border px-4 py-2.5 text-sm sm:mx-6 lg:ml-3 lg:mr-8 ${cls}`}>
      <Icon size={18} className="shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">{msg.text}</p>
      {msg.at > 0 && (
        <button aria-label="Dismiss announcement" className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/10" onClick={() => { setHidden(msg.at); try { localStorage.setItem('ca_ann_hidden', String(msg.at)); } catch { /* ignore */ } }}>
          <X size={16} />
        </button>
      )}
    </div>
  );
}
