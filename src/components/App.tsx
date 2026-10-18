'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Bot, FlaskConical, Home as HomeIcon, Menu, PanelLeftClose, PanelLeftOpen, PawPrint, ScrollText, Swords, Trophy, User, Wallet, X, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { PLAY_SCREENS, useGame, type Screen } from '@/lib/store';
import { fmt, useLoadout, useNow, useProgress } from '@/lib/hooks';
import { ChogSprite } from './ChogSprite';
import { Img, Spark, Toaster } from './ui';
import { HomeScreen } from './screens/Home';
import { BattleScreen } from './screens/Battle';
import { BotsScreen } from './screens/Bots';
import { QuestsScreen } from './screens/Quests';
import { RanksScreen } from './screens/Ranks';
import { LabScreen } from './screens/Lab';
import { ProfileScreen } from './screens/Profile';
import { CampaignScreen } from './screens/Campaign';
import { ChogsScreen } from './screens/Chogs';
import { MatchView } from './match/MatchView';
import { useMatch } from './match/useMatch';
import { useMatchCtx } from './match/useMatchCtx';
import { Tutorial } from './Tutorial';
import { sfx } from '@/lib/sound';
import { track } from '@/lib/analytics';
import { captureReferral } from '@/lib/referral';
import { INVITEE_ENERGY, currentEnergy } from '@/game/progress';
import { passTier, PASS_TIERS } from '@/game/season';
import { art } from '@/lib/art';
import { toast } from './ui';

type NavItem = { id: Screen; label: string; icon: typeof HomeIcon; mobile?: boolean; group: 'play' | 'you' };
const NAV: NavItem[] = [
  { id: 'home', label: 'Home', icon: HomeIcon, mobile: true, group: 'play' },
  { id: 'battle', label: 'Battle', icon: Swords, mobile: true, group: 'play' },
  { id: 'chogs', label: 'Chogs', icon: PawPrint, mobile: true, group: 'play' },
  { id: 'bots', label: 'Bots', icon: Bot, group: 'play' },
  { id: 'quests', label: 'Quests', icon: ScrollText, mobile: true, group: 'play' },
  { id: 'ranks', label: 'Ranks', icon: Trophy, mobile: true, group: 'play' },
  { id: 'lab', label: 'Chog Lab', icon: FlaskConical, group: 'you' },
  { id: 'profile', label: 'Profile', icon: User, group: 'you' },
];
const TITLES: Partial<Record<Screen, [string, string]>> = {
  battle: ['Battle', 'Win two of three lanes'],
  campaign: ['Campaign', 'Five zones, one curious creature'],
  chogs: ['Chogs', 'Ten looks, one fighter'],
  bots: ['Bots', 'They work while you sleep'],
  quests: ['Quests', 'Daily, weekly and the season pass'],
  ranks: ['Ranks', 'Leagues, clans and season prizes'],
  lab: ['Chog Lab', 'Traits, stats, skills'],
  profile: ['Profile', 'Wallet and settings'],
};

function useClaimableCount(): number {
  const p = useProgress();
  const today = new Date().toISOString().slice(0, 10);
  return (p.checkin.last !== today ? 1 : 0) + (!p.combo.solved && p.combo.guesses.length < 4 ? 1 : 0);
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function App() {
  const screen = useGame((s) => s.screen);
  const setScreen = useGame((s) => s.setScreen);
  const tutorialDone = useGame((s) => s.tutorialDone);
  const collapsedPref = useGame((s) => s.settings.navCollapsed);
  const setSettings = useGame((s) => s.setSettings);
  const matchActive = useMatch((s) => !!s.session);
  const startChallenge = useMatch((s) => s.startChallenge);
  const pendingChallenge = useMatch((s) => s.pendingChallenge);
  const ctx = useMatchCtx();
  const [peek, setPeek] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    track('session_start');
    if (captureReferral()) {
      useGame.getState().update((cur) => ({ ...cur, energy: cur.energy + INVITEE_ENERGY }));
      toast.good(`A friend invited you: +${INVITEE_ENERGY} energy to start.`);
    }
  }, []);

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

  // A match takes the whole screen: close anything that was open over it.
  useEffect(() => {
    if (matchActive) { setPeek(false); setDrawer(false); }
  }, [matchActive]);

  const go = (s: Screen) => {
    sfx.click();
    setScreen(s);
    setPeek(false);
    setDrawer(false);
    window.scrollTo({ top: 0 });
  };

  const playing = PLAY_SCREENS.includes(screen);
  // On play screens the rail stays folded; opening it floats over the game instead of pushing it.
  const railOnly = playing ? !peek : collapsedPref;
  const toggle = () => (playing ? setPeek((v) => !v) : setSettings({ navCollapsed: !collapsedPref }));

  return (
    <div className="min-h-dvh text-ink lg:flex">
      <Toaster />

      {/* desktop sidebar: a fixed-width slot, with the panel itself free to float wider over play screens */}
      <div className={`relative z-40 hidden shrink-0 transition-[width] duration-300 ease-out lg:block ${playing || collapsedPref ? 'w-[96px]' : 'w-[272px]'}`}>
        <div className="sticky top-0 h-dvh p-3">
          <motion.aside
            layout
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className={`surface noise relative z-40 flex h-full flex-col overflow-hidden rounded-[30px] ${railOnly ? 'w-[72px]' : 'w-[248px]'} ${playing && peek ? 'shadow-[0_30px_90px_-20px_rgba(0,0,0,0.85)]' : ''}`}
          >
            <SidebarBody screen={screen} go={go} compact={railOnly} onToggle={toggle} />
          </motion.aside>
        </div>
      </div>
      <AnimatePresence>
        {playing && peek && (
          <motion.button aria-label="Close menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPeek(false)} className="fixed inset-0 z-30 hidden bg-night/50 backdrop-blur-[2px] lg:block" />
        )}
      </AnimatePresence>

      {/* mobile drawer */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.button aria-label="Close menu" className="fixed inset-0 z-50 bg-night/60 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
            <motion.aside className="surface safe-top fixed inset-y-2 left-2 z-50 flex w-[min(84vw,300px)] flex-col overflow-hidden rounded-[28px] lg:hidden" initial={{ x: '-110%' }} animate={{ x: 0 }} exit={{ x: '-110%' }} transition={{ type: 'spring', stiffness: 380, damping: 38 }}>
              <SidebarBody screen={screen} go={go} compact={false} onToggle={() => setDrawer(false)} mobile />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header screen={screen} go={go} openDrawer={() => setDrawer(true)} />
        <main className="mx-auto w-full max-w-[1380px] flex-1 px-4 pb-10 pt-2 sm:px-6 lg:pl-3 lg:pr-8">
          <AnimatePresence mode="wait">
            <motion.div key={screen} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
              {screen === 'home' && <HomeScreen />}
              {screen === 'battle' && <BattleScreen />}
              {screen === 'campaign' && <CampaignScreen />}
              {screen === 'chogs' && <ChogsScreen />}
              {screen === 'bots' && <BotsScreen />}
              {screen === 'quests' && <QuestsScreen />}
              {screen === 'ranks' && <RanksScreen />}
              {screen === 'lab' && <LabScreen />}
              {screen === 'profile' && <ProfileScreen />}
            </motion.div>
          </AnimatePresence>
        </main>
        <Footer go={go} />
        <MobileNav screen={screen} go={go} />
      </div>

      <AnimatePresence>{matchActive && <MatchView />}</AnimatePresence>
      {!tutorialDone && <Tutorial />}
    </div>
  );
}

function SidebarBody({ screen, go, compact, onToggle, mobile }: { screen: Screen; go: (s: Screen) => void; compact: boolean; onToggle: () => void; mobile?: boolean }) {
  const p = useProgress();
  const lo = useLoadout();
  const badge = useClaimableCount();
  const { tier } = passTier(p.pass.xp);
  const item = (n: NavItem) => {
    const on = screen === n.id || (n.id === 'battle' && screen === 'campaign');
    return (
      <button
        key={n.id}
        onClick={() => go(n.id)}
        aria-current={on ? 'page' : undefined}
        title={compact ? n.label : undefined}
        className={`group relative flex min-h-12 w-full items-center gap-3 rounded-2xl text-[0.94rem] font-medium transition-colors ${compact ? 'justify-center px-0' : 'px-3.5'} ${on ? 'text-ink' : 'text-dim hover:bg-panel-2 hover:text-ink'}`}
      >
        {on && <motion.span layoutId={mobile ? 'nav-on-m' : 'nav-on'} className="absolute inset-0 rounded-2xl bg-gradient-to-r from-grape/70 to-chog/30 ring-1 ring-chog-2/30" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
        {on && !compact && <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-chog-3" />}
        <n.icon size={20} strokeWidth={on ? 2.2 : 1.8} className={`relative shrink-0 ${on ? 'text-mist drop-shadow-[0_0_10px_rgba(209,196,233,0.7)]' : ''}`} />
        {!compact && <span className="relative truncate">{n.label}</span>}
        {n.id === 'quests' && badge > 0 && (compact
          ? <span className="absolute right-3 top-2.5 size-2 rounded-full bg-cheek ring-2 ring-[var(--panel-solid)]" />
          : <span className="relative ml-auto grid size-5 place-items-center rounded-full bg-cheek text-[11px] font-semibold text-white">{badge}</span>)}
      </button>
    );
  };
  return (
    <div className={`thin-scroll flex h-full flex-col overflow-y-auto overflow-x-hidden ${compact ? 'items-center px-2 py-4' : 'p-4'}`}>
      <div className={`mb-6 flex items-center ${compact ? 'flex-col gap-3' : 'gap-3'}`}>
        <button onClick={() => go('home')} className="flex min-w-0 items-center gap-3 text-left" aria-label="Chog Arena home">
          <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-chog to-royal ring-1 ring-white/15">
            <Img src={art.emote('wild', 'happy')} eager className="size-full object-cover" w={44} h={44} />
          </span>
          {!compact && <span className="font-brand text-[1.45rem] leading-none text-mist">Chog<br /><span className="text-chog-2">Arena</span></span>}
        </button>
        <button onClick={onToggle} className={`grid size-9 shrink-0 place-items-center rounded-xl text-dim hover:bg-panel-2 hover:text-ink ${compact ? '' : 'ml-auto'}`} aria-label={mobile ? 'Close menu' : compact ? 'Expand sidebar' : 'Collapse sidebar'}>
          {mobile ? <X size={18} /> : compact ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {!compact && <div className="eyebrow mb-2 px-3.5 !text-[0.6rem]">Play</div>}
      <nav className={`flex w-full flex-col gap-1 ${compact ? 'items-center' : ''}`} aria-label="Main">{NAV.filter((n) => n.group === 'play').map(item)}</nav>
      {compact ? <div className="my-3 h-px w-8 bg-line" /> : <div className="eyebrow mb-2 mt-6 px-3.5 !text-[0.6rem]">You</div>}
      <nav className="flex w-full flex-col gap-1" aria-label="Account">{NAV.filter((n) => n.group === 'you').map(item)}</nav>

      {!compact && (
        <button onClick={() => go('quests')} className="lift relative mt-6 overflow-hidden rounded-[22px] bg-gradient-to-br from-mauve via-plum to-royal p-4 pr-24 text-left ring-1 ring-white/10">
          <div className="eyebrow !text-[0.58rem] !text-lilac/80">Season pass</div>
          <div className="mt-1 font-display text-lg font-semibold leading-tight text-mist">Tier {tier}<span className="text-lilac/60">/{PASS_TIERS}</span></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-chog-3 to-cheek" style={{ width: `${(tier / PASS_TIERS) * 100}%` }} /></div>
          <Img src={art.cut('forest')} className="pointer-events-none absolute -bottom-3 -right-3 h-[118%] w-auto drop-shadow-[0_10px_20px_rgba(0,0,0,0.45)]" />
        </button>
      )}

      <div className={`mt-auto w-full pt-4 ${compact ? 'flex flex-col items-center gap-2' : ''}`}>
        {compact ? (
          <>
            <button onClick={() => go('battle')} className="grid size-12 place-items-center rounded-2xl border border-dashed border-chog-2/50 text-chog-3 hover:bg-panel-2" aria-label="Play a match" title="Play"><Swords size={19} /></button>
            <button onClick={() => go('lab')} aria-label="Your Chog" title={lo.profile.name} className="rounded-2xl ring-1 ring-line"><ChogSprite look={lo.look} size={44} /></button>
          </>
        ) : (
          <button onClick={() => go('lab')} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-panel-2 p-2.5 text-left hover:bg-[color-mix(in_srgb,var(--ink)_9%,transparent)]">
            <ChogSprite look={lo.look} size={42} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{lo.profile.name}</span>
              <span className="block text-xs text-dim">Level {p.level} · {lo.isHolder ? lo.profile.tier : 'Demo Chog'}</span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

function Header({ screen, go, openDrawer }: { screen: Screen; go: (s: Screen) => void; openDrawer: () => void }) {
  const p = useProgress();
  const lo = useLoadout();
  const now = useNow(1000);
  const { address } = useAccount();
  const energy = Math.floor(currentEnergy(p, lo.energy, now));
  const t = TITLES[screen];
  return (
    <header className="safe-top sticky top-0 z-20 bg-gradient-to-b from-bg via-bg/90 to-bg/0 backdrop-blur-[6px]">
      <div className="mx-auto flex h-[72px] w-full max-w-[1380px] items-center gap-3 px-4 sm:px-6 lg:pl-3 lg:pr-8">
        <button onClick={openDrawer} className="grid size-11 place-items-center rounded-2xl border border-line bg-panel-2 lg:hidden" aria-label="Open menu"><Menu size={20} /></button>
        <div className="min-w-0">
          {screen === 'home' ? (
            <div className="min-w-0 font-display leading-tight text-dim sm:text-2xl">
              <span className="block text-xs sm:inline sm:text-[length:inherit]">{greeting()}<span className="hidden sm:inline">, </span></span>
              <span className="block truncate text-[1.1rem] font-semibold text-ink sm:inline sm:text-[length:inherit]">{lo.profile.name}</span>
            </div>
          ) : (
            <>
              <div className="truncate font-display text-[1.35rem] font-semibold leading-tight sm:text-[1.7rem]">{t?.[0]}</div>
              <div className="hidden truncate text-xs text-dim sm:block">{t?.[1]}</div>
            </>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-full border border-line bg-panel-2 px-3 py-2 text-sm font-semibold tnum md:flex" title="Energy">
            <Zap size={15} className="text-gold" fill="currentColor" /> {fmt(energy)}
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-line bg-panel-2 px-3 py-2 text-sm font-semibold tnum" aria-label={`${p.sparks} Sparks`}>
            <Spark className="text-base" /> {fmt(p.sparks)}
          </div>
          <button onClick={() => go('profile')} className={`flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ${address ? 'border border-line bg-panel-2' : 'bg-mist text-royal'}`}>
            <Wallet size={16} strokeWidth={1.8} />
            <span className="hidden sm:inline">{address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Connect'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function MobileNav({ screen, go }: { screen: Screen; go: (s: Screen) => void }) {
  const badge = useClaimableCount();
  return (
    <nav className="safe-bottom fixed inset-x-3 bottom-3 z-30 lg:hidden" aria-label="Main">
      <div className="surface mx-auto grid max-w-md grid-cols-5 rounded-[26px] p-1.5">
        {NAV.filter((n) => n.mobile).map((n) => {
          const on = screen === n.id || (n.id === 'battle' && screen === 'campaign');
          return (
            <button key={n.id} onClick={() => go(n.id)} aria-current={on ? 'page' : undefined} className={`relative flex min-h-[3.3rem] flex-col items-center justify-center gap-0.5 rounded-[20px] text-[10.5px] font-semibold transition ${on ? 'text-mist' : 'text-dim'}`}>
              {on && <motion.span layoutId="mnav-on" className="absolute inset-0 rounded-[20px] bg-gradient-to-b from-chog to-grape" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <n.icon size={20} strokeWidth={1.9} className="relative" />
              <span className="relative">{n.label}</span>
              {n.id === 'quests' && badge > 0 && <span className="absolute right-[22%] top-1.5 size-2 rounded-full bg-cheek" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function Footer({ go }: { go: (s: Screen) => void }) {
  const col = (title: string, items: [string, () => void][]) => (
    <div>
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">{title}</div>
      <ul className="space-y-2">
        {items.map(([l, f]) => <li key={l}><button onClick={f} className="text-[0.95rem] font-medium text-white/85 hover:text-white">{l}</button></li>)}
      </ul>
    </div>
  );
  const link = (href: string) => () => { window.location.href = href; };
  return (
    <footer className="relative mt-10 overflow-hidden rounded-t-[44px] bg-[#0b0414] pb-28 text-white lg:mr-5 lg:rounded-t-[56px] lg:pb-10">
      <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-grape/30 blur-3xl" />
      <div className="relative mx-auto grid max-w-[1380px] gap-10 px-6 pt-12 sm:px-10 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div>
          <div className="font-brand text-[3.4rem] leading-[0.85] text-mist sm:text-[4.2rem]">chog<br /><span className="text-chog-2">arena</span></div>
          <p className="mt-4 max-w-xs text-sm text-white/60">A tap-and-battle arena where your Chog Genesis NFT is the fighter, the account and the progress. Built on Monad.</p>
        </div>
        {col('Play', [['Battle', () => go('battle')], ['Campaign', () => go('campaign')], ['Chogs', () => go('chogs')], ['Bots', () => go('bots')]])}
        {col('Compete', [['Ranks', () => go('ranks')], ['Quests & pass', () => go('quests')], ['Chog Lab', () => go('lab')]])}
        {col('About', [['Terms', link('/terms')], ['Privacy', link('/privacy')], ['Profile & settings', () => go('profile')]])}
      </div>
      <div className="relative mx-auto mt-10 flex max-w-[1380px] flex-wrap items-center justify-between gap-2 border-t border-white/10 px-6 pt-5 text-[11px] uppercase tracking-[0.16em] text-white/40 sm:px-10">
        <span>© {new Date().getFullYear()} Chog Arena</span>
        <span>Chog characters are original art · Monad mainnet</span>
      </div>
    </footer>
  );
}
