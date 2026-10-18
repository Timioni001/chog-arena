'use client';

import { Bot, Link2, Lock, Map as MapIcon, ShieldCheck, Swords, Trophy } from 'lucide-react';
import { useMatch } from '../match/useMatch';
import { useMatchCtx } from '../match/useMatchCtx';
import { Bar, Button, ElementBadge, Panel, Pill, Title, toast } from '../ui';
import { GuestBanner } from '../GuestBanner';
import { CardView } from '../CardView';
import { useLoadout, useProgress } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { useGame } from '@/lib/store';
import { leagueFor, LEAGUES } from '@/game/mmr';
import { SEASON } from '@/game/season';
import { useAccount } from 'wagmi';
import { art } from '@/lib/art';

export function BattleScreen() {
  const lo = useLoadout();
  const p = useProgress();
  const ctx = useMatchCtx();
  const start = useMatch((s) => s.start);
  const busy = useMatch((s) => s.busy);
  const setScreen = useGame((s) => s.setScreen);
  const { signedIn, signIn } = useAuth();
  const { address } = useAccount();
  const league = leagueFor(p.mmr);
  const daysLeft = Math.max(0, Math.ceil((SEASON.end - Date.now()) / 86_400_000));

  const ranked = async () => {
    if (!lo.isHolder) return;
    if (!signedIn) {
      try {
        await signIn();
      } catch (e) {
        toast.bad((e as Error).message.split('\n')[0]);
        return;
      }
    }
    await start('ranked', ctx);
  };

  return (
    <div className="space-y-4">
      <div className="eyebrow">{SEASON.name} · {daysLeft} days left</div>
      {!lo.isHolder && <GuestBanner compact />}

      <div className="grid gap-3 md:grid-cols-2">
        {/* ranked */}
        <Panel className="relative overflow-hidden !p-0">
          <div className="relative h-44">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={art.hero('cyber')} alt="" className="absolute inset-0 size-full object-cover object-[50%_28%]" />
            <div className="absolute inset-0 bg-gradient-to-t from-night via-night/30 to-transparent" />
            <div className="absolute inset-x-5 bottom-4 flex items-end justify-between text-white">
              <div>
                <div className="eyebrow flex items-center gap-1.5 !text-white/75"><Trophy size={13} /> Ranked</div>
                <div className="mt-1 font-display text-[2.2rem] font-semibold leading-none" style={{ color: league.color }}>{league.name}</div>
              </div>
              <ElementBadge element={lo.profile.element} size="md" />
            </div>
          </div>
          <div className="p-5">
            <div className="text-sm text-dim tabular-nums">{p.mmr} MMR · {p.wins}W / {p.games - p.wins}L · best streak {p.bestStreak}</div>
            {league.next && (
              <div className="mt-3">
                <Bar value={league.progress} max={1} color={league.color} />
                <div className="mt-1 text-xs text-dim">{league.nextAt! - p.mmr} MMR to {league.next}</div>
              </div>
            )}
            <p className="mt-3 text-sm text-dim">Six turns, three lanes. Opponents are real Chogs from the collection, piloted by the arena AI at your MMR. The server replays every match before it counts.</p>
            {lo.isHolder ? (
              <Button tone="gold" size="lg" className="mt-4 w-full" onClick={ranked} disabled={busy || !address}>
                <Swords /> {busy ? 'Finding opponent…' : signedIn ? 'Find ranked match' : 'Sign in & play ranked'}
              </Button>
            ) : (
              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-line bg-panel-2 p-3 text-sm text-dim">
                <Lock size={18} className="shrink-0 text-gold" /> Ranked, season prizes and leaderboards need a Chog in your wallet.
              </div>
            )}
            {lo.isHolder && <div className="mt-2 flex items-center gap-1 text-xs text-dim"><ShieldCheck size={13} /> Ownership is re-checked onchain every ranked match.</div>}
          </div>
        </Panel>

        <div className="grid gap-3">
          <Panel>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 font-semibold"><MapIcon size={18} /> Campaign</div>
                <p className="mt-1 text-sm text-dim">Five zones, bosses, first-clear bonuses.</p>
              </div>
              <Button tone="chog" onClick={() => setScreen('campaign')}>Open map</Button>
            </div>
          </Panel>
          <Panel>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 font-semibold"><Bot size={18} /> Practice</div>
                <p className="mt-1 text-sm text-dim">A relaxed match vs a rookie ghost. Quarter rewards.</p>
              </div>
              <Button tone="panel" onClick={() => void start('practice', ctx)} disabled={busy}>Play</Button>
            </div>
          </Panel>
          <Panel>
            <div className="flex items-center gap-2 font-semibold"><Link2 size={18} /> Challenge a friend</div>
            <p className="mt-1 text-sm text-dim">Finish any match and tap <b>Challenge</b>: your friend gets the same seed and lanes against your Chog, and tries to top your score.</p>
          </Panel>
        </div>
      </div>

      <Panel>
        <Title sub={`${lo.fighter.deck.length} cards: traits, equipped bots, then starters`}>Your deck</Title>
        <div className="scroll-x -mx-1 flex gap-2 px-1 pb-2 pt-3">
          {lo.fighter.deck.map((c) => <CardView key={c.id} def={c} size="md" />)}
        </div>
      </Panel>

      <Panel>
        <Title>Recent matches</Title>
        {p.history.length === 0 ? (
          <p className="text-sm text-dim">No matches yet. Your first win is waiting.</p>
        ) : (
          <ul className="divide-y divide-line">
            {p.history.slice(0, 8).map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2 text-sm">
                <span className={`w-14 shrink-0 rounded-lg px-2 py-0.5 text-center text-xs font-bold ${m.won ? 'bg-lime/20 text-lime' : m.won === null ? 'bg-panel-2' : 'bg-danger/20 text-[#ffb3bf]'}`}>{m.won ? 'WIN' : m.won === null ? 'DRAW' : 'LOSS'}</span>
                <span className="min-w-0 flex-1 truncate">{m.opponent}</span>
                <Pill>{m.mode}</Pill>
                <span className="w-16 text-right font-bold">{m.score} pts</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <Title>Leagues</Title>
        <div className="flex flex-wrap gap-2">
          {LEAGUES.map((l) => <Pill key={l.name} color={l.color}>{l.name} {l.min}+</Pill>)}
        </div>
      </Panel>
    </div>
  );
}
