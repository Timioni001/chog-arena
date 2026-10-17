'use client';

import dynamic from 'next/dynamic';

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/art/avatar-wild.webp" alt="" width={112} height={112} className="animate-pulse rounded-[32px] shadow-2xl" />
        <div className="font-display text-3xl font-semibold text-ink">Chog Arena</div>
        <div className="eyebrow">Sharpening quills</div>
      </div>
    </div>
  );
}

export const ClientApp = dynamic(() => import('./App').then((m) => m.App), { ssr: false, loading: Splash });
