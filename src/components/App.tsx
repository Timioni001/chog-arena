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
    <div className="min-h-dvh bg-bg text-ink lg:flex">
      <Toaster />
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-panel/60 p-4 lg:flex">
        <button onClick={() => go('home')} className="mb-6 flex items-center gap-2 text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" width={40} height={40} />
          <span className="font-pixel text-2xl">Chog Arena</span>
        </button>
        <nav className="flex flex-col gap-1" aria-label="Main">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => go(n.id)} aria-current={screen === n.id ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 font-bold transition ${screen === n.id ? 'bg-chog text-white' : 'text-dim hover:bg-panel-2 hover:text-ink'}`}>
              <n.icon size={20} />
              {n.label}
              {n.id === 'quests' && badge > 0 && <span className="ml-auto grid size-5 place-items-center rounded-full bg-cheek text-[11px] text-[#3a0a22]">{badge}</span>}
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl border border-line bg-panel-2 p-3">
          <button onClick={() => go('lab')} className="flex w-full items-center gap-3 text-left">
            <ChogSprite look={lo.look} size={44} />
            <div className="min-w-0">
              <div className="truncate font-extrabold">{lo.profile.name}</div>
              <div className="text-xs text-dim">Lv {p.level} · {lo.isHolder ? lo.profile.tier : 'Demo'}</div>
            </div>
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* top bar */}
        <header className="safe-top sticky top-0 z-30 border-b border-line/60 bg-bg/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-3 sm:px-5">
            <button onClick={() => go('lab')} className="flex min-w-0 items-center gap-2 rounded-2xl py-1 pr-2 lg:hidden" aria-label="Open Chog Lab">
              <ChogSprite look={lo.look} size={38} />
              <div className="min-w-0 text-left leading-tight">
                <div className="truncate text-sm font-extrabold">{lo.profile.name}</div>
                <div className="text-[11px] text-dim">Lv {p.level}{lo.isHolder ? '' : ' · Demo'}</div>
              </div>
            </button>
            <div className="hidden font-pixel text-lg text-dim lg:block">{NAV.find((n) => n.id === screen)?.label ?? (screen === 'campaign' ? 'Campaign' : '')}</div>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1.5 font-pixel text-sm" aria-label={`${p.sparks} Sparks`}>
                <Spark />
                {fmt(p.sparks)}
              </div>
              <button onClick={() => go('profile')} className={`flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold ${address ? 'border border-line bg-panel' : 'bg-chog text-white'}`}>
                <Wallet size={16} />
                <span className="hidden sm:inline">{address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Connect'}</span>
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-3 pb-28 pt-3 sm:px-5 lg:pb-10">
          <AnimatePresence mode="wait">
            <motion.div key={screen} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.16 }}>
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
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/95 backdrop-blur lg:hidden" aria-label="Main">
          <div className="mx-auto grid max-w-lg grid-cols-5">
            {NAV.filter((n) => !n.desktopOnly).map((n) => {
              const on = screen === n.id || (n.id === 'battle' && screen === 'campaign');
              return (
                <button key={n.id} onClick={() => go(n.id)} aria-current={on ? 'page' : undefined} className="relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-bold">
                  <span className={`grid h-8 w-12 place-items-center rounded-full transition ${on ? 'bg-chog text-white' : 'text-dim'}`}>
                    <n.icon size={20} />
                  </span>
                  <span className={on ? 'text-ink' : 'text-dim'}>{n.label}</span>
                  {n.id === 'quests' && badge > 0 && <span className="absolute right-[22%] top-1 grid size-4 place-items-center rounded-full bg-cheek text-[10px] text-[#3a0a22]">{badge}</span>}
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
