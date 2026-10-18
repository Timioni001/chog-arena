'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAccount, useSignMessage, useSwitchChain } from 'wagmi';
import { createSiweMessage } from 'viem/siwe';
import { monad } from 'viem/chains';
import { api } from './api';
import { track } from './analytics';

export function useAuth() {
  const { address, chainId } = useAccount();
  const qc = useQueryClient();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<{ address: string | null }>('/api/auth/me'), staleTime: 60_000 });
  const session = me.data?.address ?? null;
  const signedIn = !!session && !!address && session.toLowerCase() === address.toLowerCase();

  const signIn = useCallback(async () => {
    if (!address) throw new Error('Connect a wallet first.');
    if (chainId !== monad.id) await switchChainAsync({ chainId: monad.id }).catch(() => undefined);
    const { nonce } = await api<{ nonce: string }>('/api/auth/nonce');
    const message = createSiweMessage({
      address,
      chainId: monad.id,
      domain: window.location.host,
      nonce,
      uri: window.location.origin,
      version: '1',
      statement: 'Sign in to Chog Arena. This proves you hold your Chog. It costs no gas.',
    });
    const signature = await signMessageAsync({ message });
    await api('/api/auth/verify', { json: { message, signature } });
    track('sign_in');
    await qc.invalidateQueries({ queryKey: ['me'] });
  }, [address, chainId, switchChainAsync, signMessageAsync, qc]);

  const signOut = useCallback(async () => {
    await api('/api/auth/logout', { json: {} });
    await qc.invalidateQueries({ queryKey: ['me'] });
  }, [qc]);

  return { session, signedIn, signIn, signOut };
}
