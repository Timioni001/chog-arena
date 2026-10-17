'use client';

import { Check, Copy, Gift, Lock, Users } from 'lucide-react';
import { useState } from 'react';
import { COMBO_SYMBOLS, COMBO_TRIES, STREAK_REWARDS, dailyQuests, dayKey, type ComboSymbol } from '@/game/daily';
import { checkIn, claimPass, claimQuest, guessCombo } from '@/game/progress';
import { PASS, PASS_XP_PER_TIER, passTier, SEASON } from '@/game/season';
import { BOT_SPECIES } from '@/game/bots';
import { Bar, Button, Panel, Pill, Spark, Title, toast } from '../ui';
import { fmt, useLoadout, useNow, useProgress } from '@/lib/hooks';
import { useGame } from '@/lib/store';
import { sfx, haptic } from '@/lib/sound';

const SYMBOL_ICON: Record<ComboSymbol, string> = { quill: '🦔', coin: '🪙', bolt: '⚡', leaf: '🍃', drop: '💧', flame: '🔥', star: '⭐', moon: '🌙', gem: '💎' };

export function QuestsScreen() {
  return (
    <div className="space-y-4">
      <Title sub="Fresh every day at 00:00 UTC.">Quests</Title>
      <div className="grid gap-4 lg:grid-cols-2">
        <CheckIn />
        <DailyCombo />
      </div>
      <DailyQuests />
      <SeasonPass />
      <Referral />
    </div>
  );
}

function CheckIn() {
  const p = useProgress();
  const update = useGame((s) => s.update);
  const today = dayKey();
  const done = p.checkin.last === today;
  const streak = p.checkin.streak;
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const continuing = p.checkin.last === yesterday || done;
  const effective = continuing ? streak : 0;
  // Day 7 repeats once you reach it: a 7+ streak keeps paying the top reward.
  const filled = done ? Math.min(effective, 7) : Math.min(effective, 6);
  const todayDay = done ? null : filled + 1;
  return (
    <Panel>
      <Title sub={effective ? `${effective}-day streak` : 'Start a streak today'}>Daily check-in</Title>
      <div className="grid grid-cols-7 gap-1.5">
        {STREAK_REWARDS.map((r, i) => {
          const day = i + 1;
          const got = day <= filled;
          const isToday = day === todayDay;
          return (
            <div key={i} className={`rounded-xl border p-1.5 text-center ${got ? 'border-lime/50 bg-lime/10' : isToday ? 'border-gold bg-gold/10' : 'border-line bg-panel-2'}`}>
              <div className="text-[10px] font-bold text-dim">D{day}{day === 7 ? '+' : ''}</div>
              <div className="text-sm">{got ? <Check size={16} className="mx-auto text-lime" /> : <Spark />}</div>
              <div className="text-[10px] font-bold">{fmt(r)}</div>
            </div>
          );
        })}
      </div>
      <Button className="mt-3 w-full" tone={done ? 'panel' : 'gold'} disabled={done} onClick={() => {
        let reward = 0;
        update((cur) => { const r = checkIn(cur, Date.now()); reward = r?.reward ?? 0; return r?.p; });
        if (reward) { sfx.coin(); toast.good(`+${fmt(reward)} Sparks. See you tomorrow!`); }
      }}>
        <Gift size={18} /> {done ? 'Come back tomorrow' : 'Claim today'}
      </Button>
    </Panel>
  );
}

function DailyCombo() {
  const p = useProgress();
  const update = useGame((s) => s.update);
  const [pick, setPick] = useState<ComboSymbol[]>([]);
  const left = COMBO_TRIES - p.combo.guesses.length;
  const over = p.combo.solved || left <= 0;
  const submit = () => {
    let res: ReturnType<typeof guessCombo> = null;
    update((cur) => { res = guessCombo(cur, pick, Date.now()); return res?.p; });
    setPick([]);
    if (!res) return;
    const r = res as NonNullable<ReturnType<typeof guessCombo>>;
    if (r.solved) { sfx.win(); haptic([20, 40, 60]); toast.good('Combo cracked! Sparks added.'); }
    else sfx.hex();
  };
  return (
    <Panel>
      <Title sub="Find today’s 3 symbols in order. 🟩 right spot · 🟨 wrong spot.">Daily combo</Title>
      <div className="space-y-1.5">
        {p.combo.guesses.map((g, i) => (
          <div key={i} className="flex gap-1.5">
            {g.guess.map((s, j) => (
              <div key={j} className={`grid size-11 place-items-center rounded-xl text-xl ${g.marks[j] === 'hit' ? 'bg-lime/80' : g.marks[j] === 'near' ? 'bg-gold/80' : 'bg-panel-2'}`} aria-label={`${s} ${g.marks[j]}`}>{SYMBOL_ICON[s]}</div>
            ))}
          </div>
        ))}
        {!over && (
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <button key={i} onClick={() => setPick(pick.filter((_, j) => j !== i))} className="grid size-11 place-items-center rounded-xl border-2 border-dashed border-line text-xl" aria-label={pick[i] ? `Remove ${pick[i]}` : 'Empty slot'}>
                {pick[i] ? SYMBOL_ICON[pick[i]] : ''}
              </button>
            ))}
          </div>
        )}
      </div>
      {over ? (
        <p className="mt-3 text-sm font-bold">{p.combo.solved ? '✅ Solved for today. New combo at 00:00 UTC.' : 'Out of tries. New combo tomorrow!'}</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-9 gap-1">
            {COMBO_SYMBOLS.map((s) => (
              <button key={s} disabled={pick.includes(s) || pick.length >= 3} onClick={() => setPick([...pick, s])} className="grid aspect-square place-items-center rounded-lg bg-panel-2 text-lg disabled:opacity-30" aria-label={s}>{SYMBOL_ICON[s]}</button>
            ))}
          </div>
          <Button className="mt-3 w-full" disabled={pick.length !== 3} onClick={submit}>Try combo · {left} left</Button>
        </>
      )}
    </Panel>
  );
}

function DailyQuests() {
  const p = useProgress();
  const update = useGame((s) => s.update);
  const quests = dailyQuests(p.quests.day === dayKey() ? p.quests.day : dayKey());
  const now = useNow(30_000);
  const reset = new Date(now);
  reset.setUTCHours(24, 0, 0, 0);
  const hrs = Math.ceil((reset.getTime() - now) / 3_600_000);
  return (
    <Panel>
      <Title sub={`Resets in ${hrs}h`}>Today’s quests</Title>
      <div className="space-y-2">
        {quests.map((q) => {
          const have = p.quests.day === dayKey() ? p.quests.progress[q.kind] ?? 0 : 0;
          const claimed = p.quests.claimed.includes(q.id);
          const ready = have >= q.goal && !claimed;
          return (
            <div key={q.id} className="flex items-center gap-3 rounded-2xl border border-line bg-panel-2 p-3">
              <div className="min-w-0 flex-1">
                <div className="font-extrabold">{q.title}</div>
                <Bar value={Math.min(have, q.goal)} max={q.goal} className="mt-1.5" height={8} color={ready || claimed ? '#39ff6a' : '#7c4dff'} />
                <div className="mt-1 flex items-center gap-2 text-xs text-dim">
                  <span>{fmt(Math.min(have, q.goal))}/{fmt(q.goal)}</span>
                  <span className="flex items-center gap-0.5"><Spark />{fmt(q.reward.sparks)}</span>
                  <span>+{q.reward.xp} XP</span>
                </div>
              </div>
              <Button size="sm" tone={ready ? 'lime' : 'panel'} disabled={!ready} onClick={() => { if (update((cur) => claimQuest(cur, q.id, Date.now()))) { sfx.coin(); toast.good('Quest complete!'); } }}>
                {claimed ? <Check size={16} /> : 'Claim'}
              </Button>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function SeasonPass() {
  const p = useProgress();
  const lo = useLoadout();
  const update = useGame((s) => s.update);
  const { tier, into } = passTier(p.pass.xp);
  const rewardText = (r: (typeof PASS)[number]['free']) =>
    r.kind === 'sparks' ? <span className="flex items-center justify-center gap-0.5"><Spark />{fmt(r.amount)}</span> : r.kind === 'energy' ? `⚡${r.amount}` : r.kind === 'bot' ? `🤖 ${BOT_SPECIES.find((b) => b.id === r.species)?.name}` : `✨ ${r.name}`;
  return (
    <Panel>
      <Title sub={`${SEASON.name} · tier ${tier}/${PASS.length}`} right={<Pill>{into}/{PASS_XP_PER_TIER} XP</Pill>}>Season pass</Title>
      <Bar value={into} max={PASS_XP_PER_TIER} className="mb-3" />
      <div className="scroll-x -mx-1 flex gap-2 px-1 pb-2">
        {PASS.map((t) => {
          const reached = t.tier <= tier;
          return (
            <div key={t.tier} className={`w-28 shrink-0 rounded-2xl border p-2 text-center ${reached ? 'border-chog bg-chog/10' : 'border-line bg-panel-2'}`}>
              <div className="font-pixel text-sm">Tier {t.tier}</div>
              {(['free', 'holder'] as const).map((track) => {
                const claimed = p.pass[track].includes(t.tier);
                const locked = track === 'holder' && !lo.isHolder;
                return (
                  <button
                    key={track}
                    disabled={!reached || claimed || locked}
                    onClick={() => { if (update((cur) => claimPass(cur, t.tier, track, lo.isHolder))) { sfx.coin(); toast.good('Reward claimed!'); } }}
                    className={`mt-1.5 flex min-h-12 w-full flex-col items-center justify-center rounded-xl px-1 text-[11px] font-bold ${track === 'holder' ? 'bg-gold/15' : 'bg-panel'} ${reached && !claimed && !locked ? 'ring-2 ring-lime' : ''} disabled:opacity-60`}
                  >
                    <span className="text-[9px] uppercase text-dim">{track === 'holder' ? 'Holder' : 'Free'}</span>
                    {locked ? <Lock size={14} /> : claimed ? <Check size={14} className="text-lime" /> : rewardText(t[track])}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      {!lo.isHolder && <p className="mt-2 text-xs text-dim">The holder track (bots, trails, the Season Crown frame) unlocks with a Chog.</p>}
    </Panel>
  );
}

function Referral() {
  const lo = useLoadout();
  const link = typeof window !== 'undefined' ? `${window.location.origin}/?ref=${lo.tokenId ?? 'guest'}` : '';
  return (
    <Panel>
      <div className="flex flex-wrap items-center gap-3">
        <Users className="text-chog-2" />
        <div className="min-w-0 flex-1">
          <div className="font-extrabold">Invite friends</div>
          <p className="text-sm text-dim">Referrals pay in energy and cosmetics only. No $CHOG, no pyramids.</p>
        </div>
        <Button size="sm" tone="panel" onClick={async () => { try { await navigator.clipboard.writeText(link); toast.good('Invite link copied.'); } catch { toast.info(link); } }}><Copy size={16} /> Copy link</Button>
      </div>
    </Panel>
  );
}
