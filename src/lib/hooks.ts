'use client';

import { useEffect, useMemo, useState } from 'react';
import { applyHoldings, buildDeck, guestProfile, profileForToken, type ChogProfile } from '@/game/chog';
import { botSlots } from '@/game/bots';
import { skillTotals } from '@/game/progression';
import { ascensionFor } from '@/game/progression';
import { energyConfig } from '@/game/tap';
import { newProgress, type Progress } from '@/game/progress';
import { appearanceOf, type Appearance } from './appearance';
import { activeTokenId, useGame } from './store';
import type { Fighter } from '@/game/battle';
import { detectQuality, type Quality } from '@/components/three/Scene';

export function useProgress(): Progress {
  return useGame((s) => s.progress[s.activeKey]) ?? newProgress();
}

export interface Loadout {
  tokenId: number | null;
  isHolder: boolean;
  profile: ChogProfile;
  look: Appearance;
  stats: ChogProfile['stats'];
  energy: ReturnType<typeof energyConfig>;
  slots: number;
  yieldBonus: number;
  offlineHours: number;
  ascension: ReturnType<typeof ascensionFor>;
  fighter: Fighter;
  owned: number;
  /** The name the player gave this Chog, or null. */
  nickname: string | null;
  /** What to call the Chog in the UI: the nickname, else the collection name. */
  name: string;
}

export function useLoadout(): Loadout {
  const activeKey = useGame((s) => s.activeKey);
  const owned = useGame((s) => s.ownedTokens.length);
  const nickname = useGame((s) => (s.activeKey.startsWith('chog:') ? s.chogNames[s.activeKey.slice(5)] ?? null : null));
  const p = useProgress();
  const tokenId = activeTokenId(activeKey);
  const profile = useMemo(() => (tokenId === null ? guestProfile() : profileForToken(tokenId)), [tokenId]);
  const look = useMemo(() => appearanceOf(profile), [profile]);
  return useMemo(() => {
    const isHolder = tokenId !== null;
    const sk = skillTotals(p.skills);
    const stats = applyHoldings(profile, owned, sk.stats);
    const slots = botSlots(isHolder, profile.tier);
    const holderBoost = !isHolder ? 0 : profile.tier && ['Rare', 'Epic', 'Legendary'].includes(profile.tier) ? 0.8 : 0.5;
    const energy = energyConfig({ focus: stats.focus, holderBoost, skillCap: sk.energyCap, skillRegen: sk.regen, skillTap: sk.tapPower, skillCrit: sk.critTap, luck: stats.luck, level: p.level });
    const equipped = p.bots.filter((b) => p.equipped.includes(b.uid)).slice(0, slots);
    const fighter: Fighter = { id: tokenId === null ? 'guest' : String(tokenId), name: nickname ?? (profile.title ? `${profile.name} “${profile.title}”` : profile.name), stats, deck: buildDeck(profile, equipped), element: profile.element };
    return { tokenId, isHolder, profile, look, stats, energy, slots, yieldBonus: sk.botYield, offlineHours: 3 + sk.offlineHours, ascension: ascensionFor(p.level), fighter, owned, nickname, name: nickname ?? profile.name };
  }, [tokenId, profile, look, p.skills, p.bots, p.equipped, p.level, owned, nickname]);
}

export function useQuality(): Quality {
  const q = useGame((s) => s.settings.quality);
  const [auto, setAuto] = useState<Quality>('medium');
  useEffect(() => setAuto(detectQuality()), []);
  return q === 'auto' ? auto : q;
}

export function useReducedMotion(): boolean {
  const pref = useGame((s) => s.settings.reducedMotion);
  const [sys, setSys] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setSys(m.matches);
    const on = () => setSys(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return pref || sys;
}

export function useNow(interval = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}

export function fmt(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}K`;
  return Math.floor(n).toLocaleString('en-US');
}

export function shortAddr(a: string | null | undefined): string {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '';
}
