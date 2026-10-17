'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Bot, FlaskConical, Home as HomeIcon, ScrollText, Swords, Trophy, User, Wallet } from 'lucide-react';
import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useGame, type Screen } from '@/lib/store';
import { fmt, useLoadout, useProgress } from '@/lib/hooks';
import { ChogSprite } from './ChogSprite';
import { Spark, Toaster } from './ui';
import { HomeScreen } from './screens/Home';
import { BattleScreen } from './screens/Battle';
import { BotsScreen } from './screens/Bots';
import { QuestsScreen } from './screens/Quests';
import { RanksScreen } from './screens/Ranks';
import { LabScreen } from './screens/Lab';
import { ProfileScreen } from './screens/Profile';
import { CampaignScreen } from './screens/Campaign';
import { MatchView } from './match/MatchView';
import { useMatch } from './match/useMatch';
import { useMatchCtx } from './match/useMatchCtx';
import { Tutorial } from './Tutorial';
import { sfx } from '@/lib/sound';

const NAV: { id: Screen; label: string; icon: typeof HomeIcon; desktopOnly?: boolean }[] = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'battle', label: 'Battle', icon: Swords },
  { id: 'bots', label: 'Bots', icon: Bot },
  { id: 'quests', label: 'Quests', icon: ScrollText },
  { id: 'ranks', label: 'Ranks', icon: Trophy },
  { id: 'lab', label: 'Chog Lab', icon: FlaskConical, desktopOnly: true },
  { id: 'profile', label: 'Profile', icon: User, desktopOnly: true },
];

function useClaimableCount(): number {
  const p = useProgress();
  const today = new Date().toISOString().slice(0, 10);
  return (p.checkin.last !== today ? 1 : 0) + (!p.combo.solved && p.combo.guesses.length < 4 ? 1 : 0);
}

export function App() {
  const screen = useGame((s) => s.screen);
  const setScreen = useGame((s) => s.setScreen);
  const tutorialDone = useGame((s) => s.tutorialDone);
  const p = useProgress();
  const lo = useLoadout();
  const { address } = useAccount();
  const matchActive = useMatch((s) => !!s.session);
  const startChallenge = useMatch((s) => s.startChallenge);
  const pendingChallenge = useMatch((s) => s.pendingChallenge);
  const ctx = useMatchCtx();
  const badge = useClaimableCount();

  // Friend challenge links: /?c=<ticket>. Wait a beat so a connected wallet can load its Chog first.
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('c');
    if (!c) return;
    window.history.replaceState(null, '', '/');
    const t = setTimeout(() => void startChallenge(c), 1200);
    return () => clearTimeout(t);
  }, [startChallenge]);
  useEffect(() => {
    if (pendingChallenge) void startChallenge(pendingChallenge, ctx);
  }, [pendingChallenge, ctx, startChallenge]);

  const go = (s: Screen) => {
    sfx.click();
    setScreen(s);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-dvh text-ink lg:flex">
      <Toaster />
      {/* desktop sidebar */}
      <aside className="glass sticky top-0 hidden h-dvh w-[17rem] shrink-0 flex-col !border-y-0 !border-l-0 p-5 lg:flex">
        <button onClick={() => go('home')} className="mb-8 flex items-center gap-3 text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/art/avatar-wild.webp" alt="" width={44} height={44} className="rounded-2xl" />
          <div>
            <div className="font-display text-[1.6rem] font-semibold leading-none">Chog Arena</div>
            <div className="eyebrow mt-1 !text-[0.6rem]">Monad · Season 1</div>
          </div>
        </button>
        <nav className="flex flex-col gap-1" aria-label="Main">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => go(n.id)} aria-current={screen === n.id ? 'page' : undefined} className={`group flex min-h-11 items-center gap-3 rounded-2xl px-3.5 text-[0.92rem] font-semibold transition ${screen === n.id ? 'bg-ink text-bg' : 'text-dim hover:bg-panel-2 hover:text-ink'}`}>
              <n.icon size={19} strokeWidth={1.8} />
              {n.label}
              {n.id === 'quests' && badge > 0 && <span className="ml-auto grid size-5 place-items-center rounded-full bg-cheek text-[11px] text-white">{badge}</span>}
            </button>
          ))}
        </nav>
        <button onClick={() => go('lab')} className="mt-auto flex w-full items-center gap-3 rounded-2xl border border-line bg-panel-2 p-3 text-left">
          <ChogSprite look={lo.look} size={46} />
          <div className="min-w-0">
            <div className="truncate font-semibold">{lo.profile.name}</div>
            <div className="text-xs text-dim">Level {p.level} · {lo.isHolder ? lo.profile.tier : 'Demo'}</div>
          </div>
        </button>
      </aside>

      <div className="min-w-0 flex-1">
        {/* top bar */}
        <header className="safe-top sticky top-0 z-30 border-b border-line bg-bg/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-5xl items-center gap-2 px-4 sm:px-6">
            <button onClick={() => go('lab')} className="flex min-w-0 items-center gap-2.5 rounded-2xl py-1 pr-2 lg:hidden" aria-label="Open Chog Lab">
              <ChogSprite look={lo.look} size={40} />
              <div className="min-w-0 text-left leading-tight">
                <div className="truncate font-display text-[1.05rem] font-semibold">{lo.profile.name}</div>
                <div className="text-[11px] text-dim">Level {p.level}{lo.isHolder ? '' : ' · Demo'}</div>
              </div>
            </button>
            <div className="hidden font-display text-2xl font-semibold lg:block">{NAV.find((n) => n.id === screen)?.label ?? (screen === 'campaign' ? 'Campaign' : '')}</div>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full border border-line bg-panel-2 px-3.5 py-1.5 text-sm font-semibold tabular-nums" aria-label={`${p.sparks} Sparks`}>
                <Spark className="text-base" />
                {fmt(p.sparks)}
              </div>
              <button onClick={() => go('profile')} className={`flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ${address ? 'border border-line bg-panel-2' : 'bg-ink text-bg'}`}>
                <Wallet size={16} strokeWidth={1.8} />
                <span className="hidden sm:inline">{address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Connect'}</span>
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 pb-32 pt-5 sm:px-6 lg:pb-12">
          <AnimatePresence mode="wait">
            <motion.div key={screen} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
              {screen === 'home' && <HomeScreen />}
              {screen === 'battle' && <BattleScreen />}
              {screen === 'campaign' && <CampaignScreen />}
              {screen === 'bots' && <BotsScreen />}
              {screen === 'quests' && <QuestsScreen />}
              {screen === 'ranks' && <RanksScreen />}
              {screen === 'lab' && <LabScreen />}
              {screen === 'profile' && <ProfileScreen />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* mobile bottom nav */}
        <nav className="safe-bottom fixed inset-x-3 bottom-3 z-30 lg:hidden" aria-label="Main">
          <div className="glass mx-auto grid max-w-md grid-cols-5 rounded-[26px] px-1 py-1 shadow-[0_18px_50px_-20px_rgba(10,4,30,0.9)]">
            {NAV.filter((n) => !n.desktopOnly).map((n) => {
              const on = screen === n.id || (n.id === 'battle' && screen === 'campaign');
              return (
                <button key={n.id} onClick={() => go(n.id)} aria-current={on ? 'page' : undefined} className={`relative flex min-h-[3.4rem] flex-col items-center justify-center gap-0.5 rounded-[22px] text-[10.5px] font-semibold transition ${on ? 'bg-ink text-bg' : 'text-dim'}`}>
                  <n.icon size={20} strokeWidth={1.8} />
                  <span>{n.label}</span>
                  {n.id === 'quests' && badge > 0 && <span className="absolute right-[20%] top-1.5 size-2 rounded-full bg-cheek" />}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      <AnimatePresence>{matchActive && <MatchView />}</AnimatePresence>
      {!tutorialDone && <Tutorial />}
    </div>
  );
}
