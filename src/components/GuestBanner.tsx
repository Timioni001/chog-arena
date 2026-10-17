'use client';

import { Lock } from 'lucide-react';
import { useGame } from '@/lib/store';
import { Button } from './ui';

export function GuestBanner({ compact }: { compact?: boolean }) {
  const setScreen = useGame((s) => s.setScreen);
  const address = useGame((s) => s.address);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm">
      <Lock size={18} className="shrink-0 text-gold" />
      <div className="min-w-0 flex-1">
        <b>{address ? 'No Chog in this wallet' : 'You are playing a demo Chog.'}</b>{' '}
        {!compact && <span className="hidden text-dim sm:inline">Holding a Chog unlocks ranked, $CHOG season prizes, 2–3 bot slots, +50–80% energy, the holder pass and your real traits.</span>}
        {!compact && <span className="text-dim sm:hidden">A Chog unlocks ranked, prizes and your real traits.</span>}
      </div>
      {address ? (
        <a href="https://opensea.io/collection/chog-genesis" target="_blank" rel="noreferrer" className="btn-3d inline-flex min-h-9 items-center rounded-xl bg-gold px-3 text-sm font-bold text-[#2a1a00]">Find a Chog</a>
      ) : (
        <Button size="sm" tone="gold" onClick={() => setScreen('profile')}>Connect wallet</Button>
      )}
    </div>
  );
}
