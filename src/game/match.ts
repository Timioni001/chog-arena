import { choosePlays, type AiLevel } from './ai';
import { createBattle, resolveTurn, MAX_TURNS, IllegalPlayError, type BattleState, type Fighter, type LaneKind, type Play } from './battle';
import { buildDeck, guestProfile, profileForToken } from './chog';
import { findStage } from './campaign';
import { stageFighter } from './stage';
import { COLLECTION } from './collection';
import { createRng } from './rng';
import { BOT_SPECIES, type OwnedBot } from './bots';

export interface MatchLog {
  seed: string;
  player: Fighter;
  opponent: Fighter;
  opponentLevel: AiLevel;
  lanes?: LaneKind[];
  /** One entry per turn: the player's plays. The opponent's plays are recomputed. */
  plays: Play[][];
}

/**
 * Server-side replay. Rebuilds the battle from the seed, applies the player's recorded plays, and
 * recomputes every opponent move with the same deterministic AI. Any illegal play throws.
 */
export function replayMatch(log: MatchLog): BattleState {
  if (log.plays.length > MAX_TURNS) throw new IllegalPlayError('too many turns');
  const state = createBattle(log.seed, log.player, log.opponent, log.lanes);
  for (let t = 0; t < MAX_TURNS; t++) {
    const mine = log.plays[t] ?? [];
    resolveTurn(state, mine, choosePlays(state, 1, log.opponentLevel));
  }
  return state;
}

/**
 * Ranked "ghost" opponents: real Chogs from the collection, piloted by the AI. Picked
 * deterministically from the match seed so the server and client agree.
 */
export function ghostOpponent(seed: string, mmr: number, excludeToken: number | null): { fighter: Fighter; level: AiLevel; mmr: number; tokenId: number } {
  const rng = createRng(`${seed}:ghost`);
  let tokenId = 1 + rng.int(COLLECTION.supply);
  if (tokenId === excludeToken) tokenId = (tokenId % COLLECTION.supply) + 1;
  const p = profileForToken(tokenId);
  const oppMmr = Math.max(0, Math.round(mmr + (rng.next() - 0.5) * 160));
  const level: AiLevel = oppMmr < 1150 ? 'rookie' : oppMmr < 1550 ? 'adept' : 'master';
  const botCount = oppMmr < 1100 ? 0 : oppMmr < 1400 ? 1 : 2;
  const bots: OwnedBot[] = Array.from({ length: botCount }, (_, i) => {
    const species = BOT_SPECIES[rng.int(Math.min(BOT_SPECIES.length, 3 + Math.floor(oppMmr / 300)))];
    return { uid: `g${i}`, species: species.id, level: 1 + Math.min(9, Math.floor(Math.max(0, oppMmr - 1000) / 120)) };
  });
  return {
    fighter: { id: `ghost-${tokenId}`, name: p.title ? `${p.name} “${p.title}”` : p.name, stats: p.stats, deck: buildDeck(p, bots), element: p.element },
    level,
    mmr: oppMmr,
    tokenId,
  };
}

export interface OpponentDesc {
  kind: 'ghost' | 'stage' | 'challenge';
  tokenId?: number;
  stageId?: string;
  mmr: number;
  /** The player's mmr when the ghost was rolled. */
  baseMmr?: number;
  level: AiLevel;
  name: string;
}

/** Rebuilds the opponent identically on client and server from the match descriptor. */
export function buildOpponent(desc: OpponentDesc, seed: string, playerTokenId: number | null): { fighter: Fighter; level: AiLevel } {
  if (desc.kind === 'stage') {
    const found = findStage(desc.stageId!);
    if (!found) throw new IllegalPlayError('unknown stage');
    return { fighter: stageFighter(found.stage), level: desc.level };
  }
  if (desc.kind === 'challenge') {
    const p = desc.tokenId ? profileForToken(desc.tokenId) : guestProfile();
    return { fighter: { id: `challenge-${desc.tokenId ?? 'guest'}`, name: desc.name, stats: p.stats, deck: buildDeck(p, []), element: p.element }, level: 'adept' };
  }
  return { fighter: ghostOpponent(seed, desc.baseMmr ?? desc.mmr, playerTokenId).fighter, level: desc.level };
}
