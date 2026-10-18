'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Flag, Smile, Zap } from 'lucide-react';
import { EMOTES, type Emote } from '@/lib/art';
import { useMemo, useRef, useState } from 'react';
import { useMatch } from './useMatch';
import { CardView } from '../CardView';
import { ChogSprite } from '../ChogSprite';
import { Button, ElementBadge, Modal } from '../ui';
import { cardPower, energyFor, laneCapacity, MAX_TURNS, type BattleState, type CardInstance } from '@/game/battle';
import { abilityText } from '@/game/cards';
import { appearanceOf } from '@/lib/appearance';
import { profileForToken } from '@/game/chog';
import { useLoadout } from '@/lib/hooks';
import { findStage } from '@/game/campaign';
import { ResultPanel } from './ResultPanel';
import { useGame } from '@/lib/store';

const ENEMY_ICON: Record<string, string> = { flame: '🐂', tide: '🌧️', moss: '🍄', void: '👾' };

function visiblePower(state: BattleState, side: 0 | 1, lane: number, hidden: Set<number>): number {
  return state.sides[side].lanes[lane].filter((c) => !hidden.has(c.uid)).reduce((s, c) => s + cardPower(state, c, lane), 0);
}

export function MatchView() {
  // Keep the last session while the exit animation plays after the match closes.
  const live = useMatch((x) => x.session);
  const last = useRef(live);
  if (live) last.current = live;
  const s = last.current!;
  const stage = useMatch((x) => x.stage);
  const unstage = useMatch((x) => x.unstage);
  const endTurn = useMatch((x) => x.endTurn);
  const forfeit = useMatch((x) => x.forfeit);
  const lo = useLoadout();
  const games = useGame((g) => g.progress[g.activeKey]?.games ?? 0);
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [laneInfo, setLaneInfo] = useState<number | null>(null);
  const [emoteOpen, setEmoteOpen] = useState(false);
  const [myEmote, setMyEmote] = useState<{ id: Emote; key: number } | null>(null);
  const [foeEmote, setFoeEmote] = useState<{ id: Emote; key: number } | null>(null);
  const sendEmote = (id: Emote) => {
    const key = Date.now();
    setMyEmote({ id, key });
    setEmoteOpen(false);
    setTimeout(() => setMyEmote((e) => (e?.key === key ? null : e)), 2400);
    // The arena AI is polite about half the time.
    if (Math.random() < 0.55) {
      const reply = EMOTES[Math.floor(Math.random() * EMOTES.length)].id;
      setTimeout(() => {
        const k2 = Date.now();
        setFoeEmote({ id: reply, key: k2 });
        setTimeout(() => setFoeEmote((e) => (e?.key === k2 ? null : e)), 2400);
      }, 900);
    }
  };

  const { state, staged, hidden, phase } = s;
  const me = state.sides[0];
  const foe = state.sides[1];
  const energy = energyFor(state, 0);
  const spent = staged.reduce((sum, p) => sum + (me.hand.find((c) => c.uid === p.uid)?.def.cost ?? 0), 0);
  const left = energy - spent;
  const stagedUids = new Set(staged.map((p) => p.uid));
  const hand = me.hand.filter((c) => !stagedUids.has(c.uid));
  const selectedCard = me.hand.find((c) => c.uid === selected) ?? null;

  const foeLook = useMemo(() => {
    const id = s.opponentDesc.tokenId;
    return id ? appearanceOf(profileForToken(id)) : null;
  }, [s.opponentDesc.tokenId]);
  const zone = s.stageId ? findStage(s.stageId)?.zone : null;
  const bg = zone ? `linear-gradient(180deg, ${zone.sky[1]} 0%, #120b24 70%)` : 'radial-gradient(120% 60% at 50% 0%, #4a2a9a 0%, #120b24 70%)';

  const onLane = (lane: number) => {
    if (phase !== 'plan') return;
    if (selected !== null) {
      stage(selected, lane);
      setSelected(null);
    } else setLaneInfo(lane);
  };

  return (
    <motion.div className="fixed inset-0 z-40 flex flex-col overflow-hidden text-white" style={{ background: bg }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* header */}
      <div className="safe-top mx-auto flex w-full max-w-3xl items-center gap-3 px-3 pt-2">
        <div className="relative">
          <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/20 bg-white/10 text-2xl">
            {foeLook ? <ChogSprite look={foeLook} size={48} /> : ENEMY_ICON[s.opponent.element]}
          </div>
          <EmoteBubble emote={foeEmote} side="top" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{s.opponent.name}</div>
          <div className="flex items-center gap-2 text-xs text-white/70">
            <ElementBadge element={s.opponent.element} />
            <span className="capitalize">{s.level}</span>
            {s.mode === 'ranked' && <span>· {s.opponentDesc.mmr} MMR</span>}
          </div>
        </div>
        <div className="text-center">
          <div className="font-display text-xl leading-none">{Math.min(state.turn, MAX_TURNS)}/{MAX_TURNS}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/60">Turn</div>
        </div>
        <div className="relative">
          <button aria-label="Send an emote" onClick={() => setEmoteOpen(!emoteOpen)} className="grid size-11 place-items-center rounded-full bg-white/10 text-white/85 backdrop-blur"><Smile size={18} /></button>
          <AnimatePresence>
            {emoteOpen && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 top-12 z-20 flex gap-1.5 rounded-2xl border border-white/15 bg-night/95 p-2 shadow-2xl backdrop-blur">
                {EMOTES.map((e) => (
                  <button key={e.id} onClick={() => sendEmote(e.id)} className="flex w-14 flex-col items-center gap-1 rounded-xl p-1 hover:bg-white/10" aria-label={e.label}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={e.src} alt="" className="size-12 rounded-full object-cover" />
                    <span className="text-[10px] text-white/75">{e.label}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button aria-label="Leave match" onClick={() => (phase === 'result' ? forfeit() : setConfirmQuit(true))} className="grid size-11 place-items-center rounded-full bg-white/10 text-white/80 backdrop-blur">
          <Flag size={18} />
        </button>
      </div>

      {/* lanes */}
      <div className="mx-auto mt-2 grid w-full max-w-3xl flex-1 grid-cols-3 gap-1.5 px-2 sm:gap-3">
        {state.lanes.map((lane, l) => {
          const mine = visiblePower(state, 0, l, hidden);
          const theirs = visiblePower(state, 1, l, hidden);
          const lead = mine > theirs ? 0 : theirs > mine ? 1 : null;
          const myStaged = staged.filter((p) => p.lane === l).map((p) => me.hand.find((c) => c.uid === p.uid)!).filter(Boolean);
          const full = me.lanes[l].length + myStaged.length >= laneCapacity(lane);
          const droppable = phase === 'plan' && selected !== null && !full;
          const floats = s.floaters.filter((f) => f.lane === l);
          return (
            <div key={l} className="flex min-h-0 flex-col">
              <LaneCards cards={foe.lanes[l]} state={state} lane={l} hidden={hidden} faceDownHidden top />
              <button
                onClick={() => onLane(l)}
                className={`relative my-1.5 rounded-[18px] border px-1.5 py-1.5 text-center backdrop-blur transition ${droppable ? 'animate-pulse border-gold bg-gold/20' : 'border-white/12 bg-white/[0.07]'}`}
                aria-label={`${lane.name}: ${lane.text}. You ${mine}, opponent ${theirs}.${droppable ? ' Tap to play the selected card here.' : ''}`}
              >
                <div className={`font-display text-xl font-semibold leading-none tabular-nums ${lead === 1 ? 'text-danger' : 'text-white/60'}`}>{theirs}</div>
                <div className="eyebrow my-1 truncate !text-[0.55rem] !tracking-[0.16em] !text-white/80">{lane.name}</div>
                <div className={`font-display text-xl font-semibold leading-none tabular-nums ${lead === 0 ? 'text-lime' : 'text-white/60'}`}>{mine}</div>
                {phase === 'result' && s.outcome && (
                  <div className={`absolute -right-1 -top-1 rounded-full px-1.5 text-[10px] font-bold ${s.outcome.result.laneWinners[l] === 0 ? 'bg-lime text-black' : s.outcome.result.laneWinners[l] === 1 ? 'bg-danger' : 'bg-white/40'}`}>
                    {s.outcome.result.laneWinners[l] === 0 ? 'WON' : s.outcome.result.laneWinners[l] === 1 ? 'LOST' : 'TIE'}
                  </div>
                )}
                <AnimatePresence>
                  {floats.map((f) => (
                    <motion.div key={f.key} initial={{ opacity: 0, y: 0 }} animate={{ opacity: 1, y: f.side === 0 ? 14 : -14 }} exit={{ opacity: 0 }} className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 font-display text-base ${f.amount > 0 ? 'text-lime' : 'text-danger'}`}>
                      {f.amount > 0 ? `+${f.amount}` : f.amount}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </button>
              <LaneCards cards={me.lanes[l]} state={state} lane={l} hidden={hidden} staged={myStaged} onUnstage={unstage} onTap={() => onLane(l)} />
            </div>
          );
        })}
      </div>

      {/* hand */}
      <div className="safe-bottom mx-auto w-full max-w-3xl px-2 pt-2">
        {games === 0 && state.turn === 1 && phase === 'plan' && (
          <div className="mb-2 rounded-2xl bg-white/10 px-3 py-2 text-center text-xs text-white/85 backdrop-blur">
            Win <b>2 of 3 lanes</b>. Tap a card, then tap a lane. Turn {state.turn} gives {energy}⚡. Then hit <b>Reveal</b>.
          </div>
        )}
        <div className="mb-1.5 min-h-[38px] rounded-2xl bg-white/[0.07] px-3 py-1.5 text-xs text-white/85">
          {selectedCard ? (
            <span>
              <b>{selectedCard.def.name}</b> ({selectedCard.def.cost}⚡ {selectedCard.def.power}✊) · {abilityText(selectedCard.def.ability) || selectedCard.def.text}
              {selectedCard.def.origin && <span className="text-white/55"> · {selectedCard.def.origin}</span>}
            </span>
          ) : phase === 'reveal' ? (
            <span>Revealing… {s.state.history.at(-1)?.firstToReveal === 0 ? 'You' : 'They'} reveal first.</span>
          ) : (
            <span className="text-white/60">Tap a card to read it. Element edge: Flame beats Moss, Moss beats Tide, Tide beats Flame (+1 each).</span>
          )}
        </div>
        <div className="flex items-end gap-2">
          <div className="grid size-16 shrink-0 place-items-center rounded-full border-2 border-cyan/80 bg-night text-center shadow-[0_0_24px_rgba(99,240,255,0.35)]" aria-label={`${left} of ${energy} energy left`}>
            <div>
              <Zap size={14} className="mx-auto text-[#8be9ff]" />
              <div className="font-display text-xl font-semibold leading-none">{left}</div>
            </div>
          </div>
          <div className="scroll-x flex flex-1 gap-1.5 pb-1 pt-4">
            {hand.map((c) => (
              <CardView key={c.uid} def={c.def} size="md" selected={selected === c.uid} dim={c.def.cost > left} onClick={() => phase === 'plan' && setSelected(selected === c.uid ? null : c.uid)} />
            ))}
            {hand.length === 0 && <div className="self-center px-2 text-sm text-white/50">No cards in hand.</div>}
          </div>
        </div>
        <div className="mt-2 flex gap-2 pb-1">
          <div className="relative flex items-center gap-2 rounded-full bg-white/10 px-3 text-xs text-white/75">
            <ChogSprite look={lo.look} size={32} background={false} />
            {me.drawPile.length} in deck
            <EmoteBubble emote={myEmote} side="bottom" />
          </div>
          <Button tone="gold" size="lg" className="flex-1" disabled={phase !== 'plan'} onClick={() => { setSelected(null); endTurn(); }}>
            {phase === 'plan' ? (staged.length ? `Reveal ${staged.length} card${staged.length > 1 ? 's' : ''}` : state.turn === MAX_TURNS ? 'Final reveal' : 'Pass & reveal') : phase === 'reveal' ? 'Revealing…' : 'Scoring…'}
          </Button>
        </div>
      </div>

      <Modal open={laneInfo !== null} onClose={() => setLaneInfo(null)} title={laneInfo !== null ? state.lanes[laneInfo].name : ''}>
        {laneInfo !== null && (
          <div className="space-y-2 text-dim">
            <p className="text-ink">{state.lanes[laneInfo].text}</p>
            <p>Holds {laneCapacity(state.lanes[laneInfo])} cards per side. Highest total power wins the lane.</p>
          </div>
        )}
      </Modal>
      <Modal open={confirmQuit} onClose={() => setConfirmQuit(false)} title="Leave the match?">
        <p className="text-dim">The remaining turns play out without your cards{s.mode === 'ranked' ? ' and the result counts for ranked' : ''}.</p>
        <div className="mt-4 flex gap-2">
          <Button tone="panel" className="flex-1" onClick={() => setConfirmQuit(false)}>Keep playing</Button>
          <Button tone="danger" className="flex-1" onClick={() => { setConfirmQuit(false); forfeit(); }}>Leave</Button>
        </div>
      </Modal>
      <AnimatePresence>{phase === 'result' && s.outcome && <ResultPanel />}</AnimatePresence>
      {phase === 'plan' && <div className="sr-only" aria-live="polite">Turn {state.turn}. {left} energy.</div>}
    </motion.div>
  );
}

function LaneCards({ cards, state, lane, hidden, faceDownHidden, top, staged = [], onUnstage, onTap }: { cards: CardInstance[]; state: BattleState; lane: number; hidden: Set<number>; faceDownHidden?: boolean; top?: boolean; staged?: CardInstance[]; onUnstage?: (uid: number) => void; onTap?: () => void }) {
  return (
    <div onClick={onTap} className={`grid min-h-[9.6rem] grid-cols-2 place-items-center gap-1 rounded-2xl bg-black/20 p-1 sm:min-h-[11.5rem] ${top ? 'content-end' : 'content-start'}`}>
      {cards.map((c) => {
        const isHidden = hidden.has(c.uid);
        return (
          <motion.div key={c.uid} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 26 }}>
            <div className="sm:hidden">
              <CardView def={c.def} size="xs" faceDown={isHidden && faceDownHidden} dim={isHidden && !faceDownHidden} power={isHidden ? undefined : cardPower(state, c, lane)} crit={!isHidden && c.crit} />
            </div>
            <div className="hidden sm:block">
              <CardView def={c.def} size="sm" faceDown={isHidden && faceDownHidden} dim={isHidden && !faceDownHidden} power={isHidden ? undefined : cardPower(state, c, lane)} crit={!isHidden && c.crit} />
            </div>
          </motion.div>
        );
      })}
      {staged.map((c) => (
        <motion.div key={c.uid} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="rounded-xl outline-2 outline-dashed outline-gold" onClick={(e) => e.stopPropagation()}>
          <div className="sm:hidden"><CardView def={c.def} size="xs" onClick={() => onUnstage?.(c.uid)} label={`Take back ${c.def.name}`} /></div>
          <div className="hidden sm:block"><CardView def={c.def} size="sm" onClick={() => onUnstage?.(c.uid)} label={`Take back ${c.def.name}`} /></div>
        </motion.div>
      ))}
    </div>
  );
}


function EmoteBubble({ emote, side }: { emote: { id: Emote; key: number } | null; side: 'top' | 'bottom' }) {
  return (
    <AnimatePresence>
      {emote && (
        <motion.div
          key={emote.key}
          initial={{ opacity: 0, scale: 0.4, y: side === 'top' ? -4 : 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ type: 'spring', stiffness: 420, damping: 18 }}
          className={`pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 ${side === 'top' ? 'top-14' : 'bottom-12'}`}
        >
          <div className="flex flex-col items-center rounded-3xl bg-white p-1.5 shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={EMOTES.find((e) => e.id === emote.id)?.src} alt={emote.id} className="size-16 rounded-[20px] object-cover" />
            <span className="px-1 pb-0.5 text-[11px] font-semibold text-royal">{EMOTES.find((e) => e.id === emote.id)?.label}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
