'use client';

import { useGame } from '@/lib/store';
import { Button } from './ui';

export function GuestBanner({ compact }: { compact?: boolean }) {
  const setScreen = useGame((s) => s.setScreen);
  const address = useGame((s) => s.address);
  return (
    <div className="glass flex flex-wrap items-center gap-3 rounded-[24px] px-4 py-3 text-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/art/emote-default.webp" alt="" width={40} height={40} className="size-10 shrink-0 rounded-full object-cover" />
      <div className="min-w-0 flex-1">
        <b className="font-semibold">{address ? 'No Chog in this wallet.' : 'Playing with a demo Chog.'}</b>{' '}
        {!compact && <span className="hidden text-dim sm:inline">Holding a Chog unlocks ranked, $CHOG season prizes, 2–3 bot slots, +50–80% energy, the holder pass and your real traits.</span>}
        {!compact && <span className="text-dim sm:hidden">A Chog unlocks ranked, prizes and your real traits.</span>}
      </div>
      {address ? (
        <a href="https://opensea.io/collection/chog-genesis" target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center rounded-full bg-ink px-4 text-sm font-semibold text-bg">Find a Chog</a>
      ) : (
        <Button size="sm" tone="chog" onClick={() => setScreen('profile')}>Connect wallet</Button>
      )}
    </div>
  );
}
