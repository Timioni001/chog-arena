import 'server-only';
import { randomBytes } from 'node:crypto';
import { getAddress, type Address } from 'viem';
import { kv } from './kv';
import { ownerOf } from './chain';
import { attestMatch, type MatchAttestation } from './attest';
import { buildOpponent, ghostOpponent, replayMatch, type OpponentDesc } from '@/game/match';
import { buildDeck, guestProfile, applyHoldings, profileForToken } from '@/game/chog';
import { BOT_SPECIES, MAX_BOT_LEVEL, botSlots, type OwnedBot } from '@/game/bots';
import { findStage } from '@/game/campaign';
import { START_MMR, updateMmr } from '@/game/mmr';
import { SEASON } from '@/game/season';
import { weekKey } from '@/game/daily';
import { isValidTokenId } from '@/game/collection';
import type { AiLevel } from '@/game/ai';
import type { BattleResult, Fighter, LaneKind, Play } from '@/game/battle';
import { beats } from '@/game/elements';
import { seal, unseal } from './session';
import { activeFlag } from './flags';
import { checkName } from '@/game/moderation';

export type Mode = 'ranked' | 'practice' | 'campaign' | 'challenge';
export const TRANSFER_LOCK_MS = 24 * 60 * 60 * 1000;
const MATCH_TTL = 60 * 60;
const MAX_MATCHES_PER_HOUR = 60;

export interface PendingMatch {
  id: string;
  seed: string;
  mode: Mode;
  tokenId: number | null;
  address: Address | null;
  /** baseMmr: the player's mmr when the ghost was rolled, so the server can rebuild it exactly. */
  opponent: OpponentDesc;
  lanes?: LaneKind[];
  challenge?: ChallengeTicket;
  /** True when the session wallet was checked to own tokenId on chain. */
  verified: boolean;
  createdAt: number;
}

export interface PlayerRecord {
  tokenId: number;
  mmr: number;
  games: number;
  wins: number;
  streak: number;
  best: number;
  seasonPoints: number;
  weekPoints: number;
  week: string;
  address: Address | null;
  hideWallet: boolean;
  displayName: string | null;
  clanId: string | null;
  updatedAt: number;
}

export interface ChallengeTicket {
  seed: string;
  tokenId: number | null;
  name: string;
  score: number;
  won: boolean | null;
  exp: number;
}

export class ArenaError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function newId(): string {
  return randomBytes(12).toString('hex');
}

export async function getPlayer(tokenId: number): Promise<PlayerRecord> {
  const rec = await kv().get<PlayerRecord>(`player:${tokenId}`);
  const week = weekKey();
  if (rec) return rec.week === week ? rec : { ...rec, week, weekPoints: 0 };
  return { tokenId, mmr: START_MMR, games: 0, wins: 0, streak: 0, best: 0, seasonPoints: 0, weekPoints: 0, week, address: null, hideWallet: false, displayName: null, clanId: null, updatedAt: 0 };
}

async function rateLimit(key: string) {
  const bucket = `rl:${key}:${Math.floor(Date.now() / 3_600_000)}`;
  const n = (await kv().get<number>(bucket)) ?? 0;
  if (n >= MAX_MATCHES_PER_HOUR) throw new ArenaError(429, 'Too many matches this hour. Take a breather.');
  await kv().set(bucket, n + 1, 3600);
}

/** Records first sight of an owner; a change of owner starts the 24h ranked-reward lock. */
export async function ownershipLock(tokenId: number, owner: Address): Promise<{ lockedUntil: number | null }> {
  const key = `owner:${tokenId}`;
  const prev = await kv().get<{ address: Address; since: number }>(key);
  if (!prev) {
    await kv().set(key, { address: owner, since: 0 });
    return { lockedUntil: null };
  }
  if (prev.address !== owner) {
    const since = Date.now();
    await kv().set(key, { address: owner, since });
    return { lockedUntil: since + TRANSFER_LOCK_MS };
  }
  const until = prev.since + TRANSFER_LOCK_MS;
  return { lockedUntil: until > Date.now() ? until : null };
}

export async function startMatch(args: { mode: Mode; tokenId: number | null; address: Address | null; stageId?: string; challenge?: string }): Promise<PendingMatch & { lockedUntil: number | null; ticket: string }> {
  const { mode } = args;
  let tokenId = args.tokenId;
  let lockedUntil: number | null = null;
  let verified = false;
  if (tokenId !== null) {
    if (!isValidTokenId(tokenId)) throw new ArenaError(400, 'Unknown Chog');
    if (args.address) {
      const owner = await ownerOf(tokenId);
      if (!owner || getAddress(owner) !== getAddress(args.address)) throw new ArenaError(403, 'That Chog is not in your wallet.');
      lockedUntil = (await ownershipLock(tokenId, owner)).lockedUntil;
      verified = true;
    } else if (mode === 'ranked') {
      throw new ArenaError(401, 'Sign in with your wallet to play ranked.');
    }
  }
  if (mode === 'ranked' && tokenId === null) throw new ArenaError(403, 'Ranked needs a Chog. Grab one on OpenSea or Magic Eden.');
  if (mode === 'ranked' && tokenId !== null) {
    const flag = await activeFlag(tokenId);
    if (flag) throw new ArenaError(403, `This Chog is flagged: ${flag.reason}. See the flag list on Ranks to appeal.`);
  }
  await rateLimit(args.address ?? 'guest');
  const seed = newId();
  const id = newId();
  let opponent: PendingMatch['opponent'];
  let lanes: LaneKind[] | undefined;
  let challenge: ChallengeTicket | undefined;
  if (mode === 'campaign') {
    const found = args.stageId ? findStage(args.stageId) : null;
    if (!found) throw new ArenaError(400, 'Unknown stage');
    if (found.zone.requiresHolder && tokenId === null) throw new ArenaError(403, 'This zone is for Chog holders.');
    opponent = { kind: 'stage', stageId: found.stage.id, mmr: 0, level: found.stage.enemy.level, name: found.stage.enemy.name };
    lanes = found.stage.lanes;
  } else if (mode === 'challenge') {
    const t = unseal<ChallengeTicket>(args.challenge);
    if (!t || t.exp < Date.now()) throw new ArenaError(400, 'This challenge link has expired.');
    challenge = t;
    opponent = { kind: 'challenge', tokenId: t.tokenId ?? undefined, mmr: START_MMR, level: 'adept', name: t.name };
  } else {
    const me = tokenId !== null ? await getPlayer(tokenId) : null;
    const baseMmr = me?.mmr ?? START_MMR;
    const g = ghostOpponent(seed, baseMmr, tokenId);
    opponent = { kind: 'ghost', tokenId: g.tokenId, mmr: g.mmr, baseMmr, level: mode === 'practice' ? 'rookie' : g.level, name: g.fighter.name };
  }
  const pending: PendingMatch = { id, seed: challenge?.seed ?? seed, mode, tokenId, address: args.address, verified, opponent, lanes, challenge, createdAt: Date.now() };
  await kv().set(`match:${id}`, pending, MATCH_TTL);
  // The sealed ticket lets any server instance finish the match (Workers isolates don't share memory).
  return { ...pending, lockedUntil, ticket: seal({ ...pending, exp: Date.now() + MATCH_TTL * 1000 }) };
}

export function sanitizeBots(bots: unknown, slots: number): OwnedBot[] {
  if (!Array.isArray(bots)) return [];
  const out: OwnedBot[] = [];
  for (const b of bots.slice(0, slots)) {
    if (!b || typeof b !== 'object') continue;
    const { uid, species, level } = b as Record<string, unknown>;
    if (typeof species !== 'string' || !BOT_SPECIES.some((s) => s.id === species)) continue;
    const lv = Number(level);
    if (!Number.isInteger(lv) || lv < 1 || lv > MAX_BOT_LEVEL) continue;
    out.push({ uid: String(uid ?? out.length), species, level: lv });
  }
  return out;
}

/** Rebuild both fighters exactly as the client did, from server-side data. */
export function fightersFor(pending: PendingMatch, bots: OwnedBot[], owned: number, skillStats: Partial<Record<string, number>> = {}): { player: Fighter; opponent: Fighter; level: AiLevel } {
  const profile = pending.tokenId === null ? guestProfile() : profileForToken(pending.tokenId);
  const clamp = (n: unknown) => Math.max(0, Math.min(20, Number(n) || 0));
  const skills = { power: clamp(skillStats.power), speed: clamp(skillStats.speed), guard: clamp(skillStats.guard), luck: clamp(skillStats.luck), focus: clamp(skillStats.focus) };
  const stats = applyHoldings(profile, owned, skills);
  const slots = botSlots(pending.tokenId !== null, profile.tier);
  const player: Fighter = { id: pending.tokenId === null ? 'guest' : String(pending.tokenId), name: profile.title ? `${profile.name} “${profile.title}”` : profile.name, stats, deck: buildDeck(profile, bots.slice(0, slots)), element: profile.element };
  return { player, ...opponentFighter(pending) };
}

export function opponentFighter(pending: PendingMatch): { opponent: Fighter; level: AiLevel } {
  const { fighter, level } = buildOpponent(pending.opponent, pending.seed, pending.tokenId);
  return { opponent: fighter, level };
}

export interface FinishResult {
  result: BattleResult;
  mode: Mode;
  mmr: number | null;
  mmrDelta: number;
  rank: number | null;
  attestation: MatchAttestation | null;
  rewardsLockedUntil: number | null;
  elementLaneWin: boolean;
  challengeLink: string | null;
}

export async function finishMatch(args: { matchId: string; ticket?: string; plays: Play[][]; bots: unknown; owned: number; skills?: Record<string, number>; address: Address | null; displayName?: string; hideWallet?: boolean }): Promise<FinishResult> {
  let pending = await kv().get<PendingMatch>(`match:${args.matchId}`);
  if (!pending) {
    const t = unseal<PendingMatch & { exp: number }>(args.ticket);
    if (t && t.id === args.matchId && t.exp > Date.now()) pending = t;
  }
  if (!pending) throw new ArenaError(404, 'Match expired or already finished.');
  if (pending.address && (!args.address || getAddress(pending.address) !== getAddress(args.address))) throw new ArenaError(403, 'Not your match.');
  if (await kv().get(`done:${pending.id}`)) throw new ArenaError(409, 'Match already finished.');
  await kv().set(`done:${pending.id}`, 1, MATCH_TTL);
  await kv().del(`match:${args.matchId}`);
  if (pending.mode === 'ranked' && kv().kind === 'memory' && process.env.NODE_ENV === 'production') {
    console.warn('[chog-arena] ranked results are using the in-memory store; set UPSTASH_REDIS_REST_URL/TOKEN.');
  }

  const profile = pending.tokenId === null ? guestProfile() : profileForToken(pending.tokenId);
  const bots = sanitizeBots(args.bots, botSlots(pending.tokenId !== null, profile.tier));
  const { player, opponent, level } = fightersFor(pending, bots, Math.max(1, Math.min(50, Number(args.owned) || 1)), args.skills);
  let state;
  try {
    state = replayMatch({ seed: pending.seed, player, opponent, opponentLevel: level, lanes: pending.lanes, plays: args.plays });
  } catch (e) {
    throw new ArenaError(400, `Replay rejected: ${(e as Error).message}`);
  }
  const result = state.result!;
  const won = result.winner === null ? null : result.winner === 0;
  const elementLaneWin = result.laneWinners.some((w, l) => w === 0 && state.sides[0].lanes[l].some((c) => state.sides[1].lanes[l].some((e) => beats(c.def.element, e.def.element))));

  let mmr: number | null = null, mmrDelta = 0, rank: number | null = null, attestation: MatchAttestation | null = null, rewardsLockedUntil: number | null = null;
  if (pending.mode === 'ranked' && pending.tokenId !== null && pending.address) {
    const owner = await ownerOf(pending.tokenId);
    if (!owner || getAddress(owner) !== getAddress(pending.address)) throw new ArenaError(403, 'Chog changed hands during the match.');
    rewardsLockedUntil = (await ownershipLock(pending.tokenId, owner)).lockedUntil;
    const rec = await getPlayer(pending.tokenId);
    const outcome = won === null ? 0.5 : won ? 1 : 0;
    const next = updateMmr(rec.mmr, pending.opponent.mmr, outcome, rec.games);
    mmrDelta = next - rec.mmr;
    mmr = next;
    const points = result.score[0];
    const streak = won ? rec.streak + 1 : 0;
    const updated: PlayerRecord = {
      ...rec,
      mmr: next,
      games: rec.games + 1,
      wins: rec.wins + (won ? 1 : 0),
      streak,
      best: Math.max(rec.best, streak),
      seasonPoints: rec.seasonPoints + points,
      weekPoints: rec.weekPoints + points,
      address: getAddress(pending.address),
      hideWallet: !!args.hideWallet,
      displayName: cleanName(args.displayName) ?? rec.displayName,
      updatedAt: Date.now(),
    };
    await kv().set(`player:${pending.tokenId}`, updated);
    await indexLeaderboards(updated, rewardsLockedUntil !== null);
    rank = await kv().zrank(`lb:season:${SEASON.id}`, String(pending.tokenId));
    if (!rewardsLockedUntil) attestation = await attestMatch({ seasonId: SEASON.id, tokenId: pending.tokenId, player: getAddress(pending.address), won: !!won, score: points, matchId: pending.id });
  }

  const ticket: ChallengeTicket = { seed: pending.seed, tokenId: pending.tokenId, name: pending.verified || pending.tokenId === null ? player.name : `${player.name} (unverified)`, score: result.score[0], won, exp: Date.now() + 7 * 24 * 3600_000 };
  return { result, mode: pending.mode, mmr, mmrDelta, rank: rank === null ? null : rank + 1, attestation, rewardsLockedUntil, elementLaneWin, challengeLink: pending.mode === 'challenge' ? null : seal(ticket) };
}

function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const c = checkName(raw);
  return c.ok ? c.value : null;
}

async function indexLeaderboards(rec: PlayerRecord, locked: boolean) {
  const id = String(rec.tokenId);
  const s = SEASON.id;
  const store = kv();
  await store.zadd(`lb:mmr:${s}`, rec.mmr, id);
  if (locked) return; // points still count for MMR, but prize boards wait out the transfer lock
  await store.zadd(`lb:season:${s}`, rec.seasonPoints, id);
  await store.zadd(`lb:week:${rec.week}`, rec.weekPoints, id);
  if (rec.games <= 25) await store.zadd(`lb:rookie:${s}`, rec.seasonPoints, id);
  const p = profileForToken(rec.tokenId);
  if (p.tier) await store.zadd(`lb:tier:${p.tier}:${s}`, rec.seasonPoints, id);
  for (const t of p.traits) {
    if (['Head', 'Eyes', 'Mouth', 'Body', 'Accessory', 'Aura', 'Base', 'Skin'].includes(t.type)) await store.zadd(`lb:trait:${t.type}:${t.value}:${s}`, rec.seasonPoints, id);
  }
  if (rec.clanId) await store.zincr(`lb:clan:${s}`, rec.seasonPoints - ((await store.zscore(`clanmember:${rec.clanId}`, id)) ?? 0), rec.clanId).then(() => store.zadd(`clanmember:${rec.clanId}`, rec.seasonPoints, id));
}

export async function leaderboard(board: string, limit = 50) {
  const s = SEASON.id;
  const key =
    board === 'season' ? `lb:season:${s}` :
    board === 'weekly' ? `lb:week:${weekKey()}` :
    board === 'rookie' ? `lb:rookie:${s}` :
    board === 'mmr' ? `lb:mmr:${s}` :
    board.startsWith('tier:') ? `lb:tier:${board.slice(5)}:${s}` :
    board.startsWith('trait:') ? `lb:trait:${board.slice(6)}:${s}` :
    null;
  if (!key) throw new ArenaError(400, 'Unknown board');
  const raw = await kv().ztop(key, Math.min(100, limit) + 20);
  const flagged = new Set((await kv().smembers('flags')).map(Number));
  const top = raw.filter((r) => !flagged.has(Number(r.member))).slice(0, Math.min(100, limit));
  const rows = await Promise.all(
    top.map(async ({ member, score }, i) => {
      const rec = await getPlayer(Number(member));
      const p = profileForToken(Number(member));
      return {
        rank: i + 1,
        tokenId: Number(member),
        name: rec.displayName || (p.title ? `${p.name} “${p.title}”` : p.name),
        score,
        mmr: rec.mmr,
        wins: rec.wins,
        games: rec.games,
        streak: rec.streak,
        element: p.element,
        archetype: p.archetype,
        tier: p.tier,
        clanId: rec.clanId,
        address: rec.hideWallet || !rec.address ? null : rec.address,
      };
    }),
  );
  return { board, key, rows, store: kv().kind };
}
