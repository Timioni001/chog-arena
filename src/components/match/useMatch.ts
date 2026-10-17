'use client';

import { create } from 'zustand';
import { choosePlays, type AiLevel } from '@/game/ai';
import { cloneBattle, createBattle, energyFor, laneCapacity, resolveTurn, type BattleEvent, type BattleResult, type BattleState, type Fighter, type LaneKind, type Play } from '@/game/battle';
import { buildOpponent, type OpponentDesc } from '@/game/match';
import { findStage } from '@/game/campaign';
import { recordMatch, type MatchReward } from '@/game/progress';
import { beats } from '@/game/elements';
import type { OwnedBot } from '@/game/bots';
import type { Stats } from '@/game/types';
import { api, ApiError } from '@/lib/api';
import { useGame } from '@/lib/store';
import { sfx, haptic } from '@/lib/sound';
import { toast } from '../ui';

export type MatchMode = 'ranked' | 'practice' | 'campaign' | 'challenge';

export interface MatchCtx {
  fighter: Fighter;
  tokenId: number | null;
  bots: OwnedBot[];
  owned: number;
  skills: Partial<Stats>;
  displayName: string;
  hideWallet: boolean;
}

export interface Attestation {
  seasonId: string;
  tokenId: string;
  player: `0x${string}`;
  won: boolean;
  score: number;
  matchId: `0x${string}`;
  deadline: string;
  signature: `0x${string}`;
  verifyingContract: `0x${string}`;
}

export interface MatchOutcome {
  result: BattleResult;
  reward: MatchReward;
  verified: boolean;
  mmr: number | null;
  rank: number | null;
  attestation: Attestation | null;
  rewardsLockedUntil: number | null;
  challengeLink: string | null;
  challengeScore: number | null;
}

export interface Session {
  id: string | null;
  ticket: string | null;
  seed: string;
  mode: MatchMode;
  stageId?: string;
  ctx: MatchCtx;
  opponent: Fighter;
  opponentDesc: OpponentDesc;
  level: AiLevel;
  lanes?: LaneKind[];
  state: BattleState;
  plays: Play[][];
  staged: Play[];
  phase: 'plan' | 'reveal' | 'finishing' | 'result';
  hidden: Set<number>;
  floaters: { lane: number; side: 0 | 1; amount: number; key: number }[];
  lastEvents: BattleEvent[];
  outcome: MatchOutcome | null;
  challenge: { name: string; score: number } | null;
  online: boolean;
}

interface MatchStore {
  session: Session | null;
  busy: boolean;
  start: (mode: MatchMode, ctx: MatchCtx, opts?: { stageId?: string; challenge?: string }) => Promise<void>;
  startChallenge: (ticket: string, ctx?: MatchCtx) => Promise<void>;
  pendingChallenge: string | null;
  stage: (uid: number, lane: number) => void;
  unstage: (uid: number) => void;
  endTurn: () => void;
  forfeit: () => void;
  close: () => void;
  rematch: () => Promise<void>;
}

function localSeed() {
  const a = new Uint32Array(3);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => x.toString(16)).join('');
}

export const useMatch = create<MatchStore>((set, get) => ({
  session: null,
  busy: false,
  pendingChallenge: null,

  async start(mode, ctx, opts = {}) {
    if (get().busy) return;
    set({ busy: true });
    try {
      let id: string | null = null;
      let ticket: string | null = null;
      let seed = localSeed();
      let desc: OpponentDesc | null = null;
      let lanes: LaneKind[] | undefined;
      let challenge: Session['challenge'] = null;
      let online = false;
      try {
        const r = await api<{ matchId: string; ticket: string; seed: string; opponent: OpponentDesc; lanes: LaneKind[] | null; challenge: { name: string; score: number } | null; lockedUntil: number | null }>('/api/match/start', {
          json: { mode, tokenId: ctx.tokenId, stageId: opts.stageId, challenge: opts.challenge },
        });
        id = r.matchId;
        ticket = r.ticket;
        seed = r.seed;
        desc = r.opponent;
        lanes = r.lanes ?? undefined;
        challenge = r.challenge ? { name: r.challenge.name, score: r.challenge.score } : null;
        online = true;
        if (r.lockedUntil) toast.info(`This Chog changed hands recently: ranked rewards unlock ${new Date(r.lockedUntil).toLocaleString()}.`);
      } catch (e) {
        // Ranked and challenges need the server. Practice and campaign fall back to local play when it is unreachable.
        if (mode === 'ranked' || mode === 'challenge' || (e as ApiError).status !== 0) throw e;
      }
      if (!desc) {
        if (mode === 'campaign') {
          const found = findStage(opts.stageId ?? '');
          if (!found) throw new Error('Unknown stage');
          desc = { kind: 'stage', stageId: found.stage.id, mmr: 0, level: found.stage.enemy.level, name: found.stage.enemy.name };
          lanes = found.stage.lanes;
        } else {
          desc = { kind: 'ghost', mmr: 1000, baseMmr: 1000, level: 'rookie', name: 'Practice ghost' };
        }
      }
      const { fighter: opponent, level } = buildOpponent(desc, seed, ctx.tokenId);
      const state = createBattle(seed, ctx.fighter, opponent, lanes);
      set({
        session: { id, ticket, seed, mode, stageId: opts.stageId, ctx, opponent, opponentDesc: desc, level, lanes, state, plays: [], staged: [], phase: 'plan', hidden: new Set(), floaters: [], lastEvents: [], outcome: null, challenge, online },
      });
      sfx.reveal();
    } catch (e) {
      toast.bad((e as Error).message);
    } finally {
      set({ busy: false });
    }
  },

  async startChallenge(ticket, ctx) {
    if (!ctx) {
      set({ pendingChallenge: ticket });
      return;
    }
    set({ pendingChallenge: null });
    await get().start('challenge', ctx, { challenge: ticket });
  },

  stage(uid, lane) {
    const s = get().session;
    if (!s || s.phase !== 'plan') return;
    const side = s.state.sides[0];
    const card = side.hand.find((c) => c.uid === uid);
    if (!card) return;
    const staged = s.staged.filter((p) => p.uid !== uid);
    const spent = staged.reduce((sum, p) => sum + (side.hand.find((c) => c.uid === p.uid)?.def.cost ?? 0), 0);
    if (spent + card.def.cost > energyFor(s.state, 0)) {
      toast.bad('Not enough energy for that card.');
      return;
    }
    const inLane = side.lanes[lane].length + staged.filter((p) => p.lane === lane).length;
    if (inLane >= laneCapacity(s.state.lanes[lane])) {
      toast.bad('That lane is full.');
      return;
    }
    sfx.card();
    haptic(8);
    set({ session: { ...s, staged: [...staged, { uid, lane }] } });
  },

  unstage(uid) {
    const s = get().session;
    if (!s || s.phase !== 'plan') return;
    set({ session: { ...s, staged: s.staged.filter((p) => p.uid !== uid) } });
  },

  endTurn() {
    const s = get().session;
    if (!s || s.phase !== 'plan') return;
    const state = cloneBattle(s.state);
    const mine = s.staged;
    const theirs = choosePlays(state, 1, s.level);
    const record = resolveTurn(state, mine, theirs);
    const hidden = new Set<number>(record.events.filter((e) => e.t === 'reveal').map((e) => (e as { uid: number }).uid));
    set({ session: { ...s, state, plays: [...s.plays, mine], staged: [], phase: 'reveal', hidden, lastEvents: record.events, floaters: [] } });

    // Reveal one card at a time.
    const reveals = record.events;
    let i = 0;
    const step = () => {
      const cur = get().session;
      if (!cur || cur.state !== state) return;
      if (i >= reveals.length) {
        if (state.result) void finish();
        else set({ session: { ...cur, phase: 'plan', hidden: new Set() } });
        return;
      }
      const ev = reveals[i++];
      const next = { ...cur, hidden: new Set(cur.hidden) };
      if (ev.t === 'reveal') {
        next.hidden.delete(ev.uid);
        if (ev.crit) sfx.crit();
        else sfx.reveal();
      } else if (ev.t === 'buff') {
        next.floaters = [...cur.floaters, { lane: ev.lane, side: ev.side, amount: ev.amount, key: Math.random() }];
        sfx.buff();
      } else if (ev.t === 'hex') {
        if (!ev.blocked) next.floaters = [...cur.floaters, { lane: ev.lane, side: ev.side === 0 ? 1 : 0, amount: -ev.amount, key: Math.random() }];
        sfx.hex();
      }
      set({ session: next });
      setTimeout(step, ev.t === 'reveal' ? 420 : 300);
    };
    setTimeout(step, 350);
  },

  forfeit() {
    const s = get().session;
    if (!s) return;
    if (s.phase === 'result') return get().close();
    // Leaving early plays out the remaining turns with no cards from you.
    const state = cloneBattle(s.state);
    const plays = [...s.plays];
    while (!state.result) {
      plays.push([]);
      resolveTurn(state, [], choosePlays(state, 1, s.level));
    }
    set({ session: { ...s, state, plays, staged: [], hidden: new Set() } });
    void finish();
  },

  close() {
    set({ session: null });
  },

  async rematch() {
    const s = get().session;
    if (!s) return;
    const { mode, ctx, stageId } = s;
    set({ session: null });
    await get().start(mode === 'challenge' ? 'practice' : mode, ctx, { stageId });
  },
}));

async function finish() {
  const st = useMatch.getState();
  const s = st.session;
  if (!s || !s.state.result) return;
  useMatch.setState({ session: { ...s, phase: 'finishing' } });
  let result = s.state.result;
  let verified = false;
  let mmr: number | null = null, rank: number | null = null, attestation: Attestation | null = null, rewardsLockedUntil: number | null = null, challengeLink: string | null = null;
  let mmrDeltaServer: number | null = null;
  if (s.online && s.id) {
    try {
      const r = await api<{ result: BattleResult; mmr: number | null; mmrDelta: number; rank: number | null; attestation: Attestation | null; rewardsLockedUntil: number | null; challengeLink: string | null }>('/api/match/finish', {
        json: { matchId: s.id, ticket: s.ticket, plays: s.plays, bots: s.ctx.bots, owned: s.ctx.owned, skills: s.ctx.skills, displayName: s.ctx.displayName, hideWallet: s.ctx.hideWallet },
      });
      result = r.result;
      verified = JSON.stringify(r.result.laneWinners) === JSON.stringify(s.state.result.laneWinners);
      mmr = r.mmr;
      mmrDeltaServer = r.mmrDelta;
      rank = r.rank;
      attestation = r.attestation;
      rewardsLockedUntil = r.rewardsLockedUntil;
      challengeLink = r.challengeLink;
    } catch (e) {
      toast.bad(`Server could not verify this match: ${(e as Error).message}`);
    }
  }
  const won = result.winner === null ? null : result.winner === 0;
  const elementLaneWin = result.laneWinners.some((w, l) => w === 0 && s.state.sides[0].lanes[l].some((c) => s.state.sides[1].lanes[l].some((e) => beats(c.def.element, e.def.element))));
  const stage = s.stageId ? findStage(s.stageId) : null;
  let reward: MatchReward = { sparks: 0, xp: 0, mmrDelta: 0, levelsGained: 0, passXp: 0 };
  // Ranked only counts when the server verified it; other modes reward locally.
  const counts = s.mode !== 'ranked' || verified;
  if (counts) {
    useGame.getState().update((p) => {
      const r = recordMatch(p, { id: s.id ?? s.seed, mode: s.mode, opponent: s.opponent.name, opponentMmr: s.opponentDesc.mmr, won, score: result.score[0], lanes: result.laneWinners, elementLaneWin, stageId: s.stageId, stageReward: stage?.stage.reward }, Date.now());
      reward = r.reward;
      // The server is the source of truth for ranked MMR.
      return mmr !== null ? { ...r.p, mmr } : r.p;
    });
    if (mmrDeltaServer !== null) reward = { ...reward, mmrDelta: mmrDeltaServer };
  }
  if (won) { sfx.win(); haptic([30, 50, 30, 50, 80]); } else if (won === false) sfx.lose();
  const cur = useMatch.getState().session;
  if (!cur) return;
  useMatch.setState({
    session: { ...cur, phase: 'result', hidden: new Set(), outcome: { result, reward, verified, mmr, rank, attestation, rewardsLockedUntil, challengeLink, challengeScore: s.challenge?.score ?? null } },
  });
}
