'use client';

import dynamic from 'next/dynamic';

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg">
      <div className="flex flex-col items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" width={88} height={88} className="animate-bounce" />
        <div className="font-pixel text-2xl text-ink">Chog Arena</div>
        <div className="text-sm text-dim">Sharpening quills…</div>
      </div>
    </div>
  );
}

export const ClientApp = dynamic(() => import('./App').then((m) => m.App), { ssr: false, loading: Splash });
