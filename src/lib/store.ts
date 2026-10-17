'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { newProgress, type Progress } from '@/game/progress';
import type { Quality } from '@/components/three/Scene';

export type Screen = 'home' | 'battle' | 'bots' | 'quests' | 'ranks' | 'lab' | 'profile' | 'campaign';

export interface Settings {
  quality: Quality | 'auto';
  sound: boolean;
  music: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  theme: 'dark' | 'light';
  hideWallet: boolean;
  displayName: string;
}

interface GameState {
  screen: Screen;
  settings: Settings;
  /** Progress per Chog ("chog:123") plus one for the guest demo. */
  progress: Record<string, Progress>;
  activeKey: string;
  /** Last Chog used on this device, restored once the wallet proves ownership again. */
  lastKey: string;
  address: string | null;
  ownedTokens: number[];
  tutorialDone: boolean;
  clan: { id: string; name: string; tag: string; role: 'leader' | 'member' } | null;
  setScreen: (s: Screen) => void;
  setSettings: (s: Partial<Settings>) => void;
  setWallet: (address: string | null, tokens: number[]) => void;
  selectChog: (tokenId: number | null) => void;
  update: (fn: (p: Progress) => Progress | null | undefined) => boolean;
  replaceProgress: (key: string, p: Progress) => void;
  finishTutorial: () => void;
  setClan: (c: GameState['clan']) => void;
}

export const keyFor = (tokenId: number | null) => (tokenId === null ? 'guest' : `chog:${tokenId}`);

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      screen: 'home',
      settings: { quality: 'auto', sound: true, music: false, haptics: true, reducedMotion: false, theme: 'dark', hideWallet: false, displayName: '' },
      progress: { guest: newProgress() },
      activeKey: 'guest',
      lastKey: 'guest',
      address: null,
      ownedTokens: [],
      tutorialDone: false,
      clan: null,
      setScreen: (screen) => set({ screen }),
      setSettings: (s) => set({ settings: { ...get().settings, ...s } }),
      setWallet: (address, tokens) => {
        const st = get();
        const activeToken = st.activeKey.startsWith('chog:') ? Number(st.activeKey.slice(5)) : null;
        const last = activeTokenId(st.lastKey);
        let activeKey = st.activeKey;
        if (!address || (activeToken !== null && !tokens.includes(activeToken))) activeKey = 'guest';
        if (address && activeKey === 'guest' && tokens.length) activeKey = keyFor(last !== null && tokens.includes(last) ? last : tokens[0]);
        const progress = { ...st.progress };
        if (!progress[activeKey]) progress[activeKey] = newProgress();
        set({ address, ownedTokens: tokens, activeKey, lastKey: activeKey === 'guest' ? st.lastKey : activeKey, progress });
      },
      selectChog: (tokenId) => {
        const key = keyFor(tokenId);
        const progress = { ...get().progress };
        if (!progress[key]) progress[key] = newProgress();
        set({ activeKey: key, lastKey: key, progress });
      },
      update: (fn) => {
        const st = get();
        const cur = st.progress[st.activeKey] ?? newProgress();
        const next = fn(cur);
        if (!next) return false;
        set({ progress: { ...st.progress, [st.activeKey]: next } });
        return true;
      },
      replaceProgress: (key, p) => set({ progress: { ...get().progress, [key]: p } }),
      finishTutorial: () => set({ tutorialDone: true }),
      setClan: (clan) => set({ clan }),
    }),
    {
      name: 'chog-arena-v1',
      storage: createJSONStorage(() => {
        try {
          return localStorage;
        } catch {
          const mem = new Map<string, string>();
          return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) };
        }
      }),
      partialize: (s) => ({ settings: s.settings, progress: s.progress, lastKey: s.lastKey, tutorialDone: s.tutorialDone, clan: s.clan }),
      // Wallet state is never trusted from storage: it is re-read from the chain each visit.
      merge: (persisted, current) => {
        const p = persisted as Partial<GameState>;
        return { ...current, ...p, settings: { ...current.settings, ...p.settings }, activeKey: 'guest', address: null, ownedTokens: [] };
      },
    },
  ),
);

export function activeTokenId(key: string): number | null {
  return key.startsWith('chog:') ? Number(key.slice(5)) : null;
}
