'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { WagmiProvider, useAccount } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/lib/wagmi';
import { activeTokenId, useGame } from '@/lib/store';
import { api } from '@/lib/api';
import { setSoundEnabled } from '@/lib/sound';
import { useAuth } from '@/lib/auth';
import type { Progress } from '@/game/progress';
import { toast } from './ui';

function WalletSync() {
  const { address, status } = useAccount();
  const setWallet = useGame((s) => s.setWallet);
  useEffect(() => {
    if (status === 'connecting' || status === 'reconnecting') return;
    if (!address) {
      setWallet(null, []);
      return;
    }
    let cancelled = false;
    api<{ tokens: number[] }>(`/api/holdings?address=${address}`)
      .then((r) => {
        if (cancelled) return;
        setWallet(address, r.tokens);
        if (!r.tokens.length) toast.info('No Chog in this wallet yet: you can keep playing the demo.');
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setWallet(address, []);
          toast.bad(e.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [address, status, setWallet]);
  return null;
}

/** Pulls a Chog's saved progress when it becomes active, and pushes local changes when signed in. */
function ProgressSync() {
  const activeKey = useGame((s) => s.activeKey);
  const progress = useGame((s) => s.progress[s.activeKey]);
  const replace = useGame((s) => s.replaceProgress);
  const { signedIn } = useAuth();
  const tokenId = activeTokenId(activeKey);
  const lastPushed = useRef(0);

  useEffect(() => {
    if (tokenId === null) return;
    api<{ progress: Progress | null }>(`/api/progress/${tokenId}`)
      .then(({ progress: remote }) => {
        const local = useGame.getState().progress[activeKey];
        if (remote && (!local || remote.updatedAt > local.updatedAt)) {
          replace(activeKey, remote);
          if (local && local.games === 0 && remote.games > 0) toast.info('This Chog came with its saved progress.');
        }
      })
      .catch(() => undefined);
  }, [tokenId, activeKey, replace]);

  useEffect(() => {
    if (tokenId === null || !signedIn || !progress) return;
    if (progress.updatedAt <= lastPushed.current) return;
    const t = setTimeout(() => {
      lastPushed.current = progress.updatedAt;
      api(`/api/progress/${tokenId}`, { method: 'PUT', json: { progress } }).catch(() => undefined);
    }, 4000);
    return () => clearTimeout(t);
  }, [tokenId, signedIn, progress]);
  return null;
}

function Prefs() {
  const settings = useGame((s) => s.settings);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.classList.toggle('reduce-motion', settings.reducedMotion);
    setSoundEnabled(settings.sound);
  }, [settings.theme, settings.reducedMotion, settings.sound]);
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }));
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        <WalletSync />
        <ProgressSync />
        <Prefs />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
