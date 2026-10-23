'use client';

import { useMemo } from 'react';
import { skillTotals } from '@/game/progression';
import { useLoadout, useProgress } from '@/lib/hooks';
import { useGame } from '@/lib/store';
import type { MatchCtx } from './useMatch';

export function useMatchCtx(): MatchCtx {
  const lo = useLoadout();
  const p = useProgress();
  const settings = useGame((s) => s.settings);
  return useMemo(
    () => ({
      fighter: lo.fighter,
      tokenId: lo.tokenId,
      bots: p.bots.filter((b) => p.equipped.includes(b.uid)).slice(0, lo.slots),
      owned: Math.max(1, lo.owned),
      skills: skillTotals(p.skills).stats,
      // The Chog's own name wins; the older per-device display name is the fallback.
      displayName: lo.nickname ?? settings.displayName,
      hideWallet: settings.hideWallet,
    }),
    [lo.fighter, lo.tokenId, lo.slots, lo.owned, lo.nickname, p.bots, p.equipped, p.skills, settings.displayName, settings.hideWallet],
  );
}
