import 'server-only';
import { randomBytes } from 'node:crypto';
import { kv } from './kv';
import { ArenaError, getPlayer } from './arena';
import { SEASON } from '@/game/season';

export interface Clan {
  id: string;
  name: string;
  tag: string;
  leader: number;
  members: number[];
  createdAt: number;
}

export const CLAN_MAX = 30;
export const CHEST_MILESTONES = [1_000, 5_000, 20_000, 60_000];

export async function listClans() {
  const ids = await kv().smembers('clans');
  const clans = (await Promise.all(ids.map((id) => kv().get<Clan>(`clan:${id}`)))).filter((c): c is Clan => !!c);
  const withPoints = await Promise.all(clans.map(async (c) => ({ ...c, points: (await kv().zscore(`lb:clan:${SEASON.id}`, c.id)) ?? 0 })));
  return withPoints.sort((a, b) => b.points - a.points);
}

export async function createClan(tokenId: number, name: string, tag: string): Promise<Clan> {
  const n = name.trim().slice(0, 24), t = tag.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  if (n.length < 3 || t.length < 2) throw new ArenaError(400, 'Name needs 3+ characters and tag 2–4 letters.');
  const rec = await getPlayer(tokenId);
  if (rec.clanId) throw new ArenaError(400, 'Leave your current clan first.');
  const clan: Clan = { id: randomBytes(6).toString('hex'), name: n, tag: t, leader: tokenId, members: [tokenId], createdAt: Date.now() };
  await kv().set(`clan:${clan.id}`, clan);
  await kv().sadd('clans', clan.id);
  await kv().set(`player:${tokenId}`, { ...rec, clanId: clan.id });
  await kv().zadd(`lb:clan:${SEASON.id}`, 0, clan.id);
  return clan;
}

export async function joinClan(tokenId: number, clanId: string): Promise<Clan> {
  const clan = await kv().get<Clan>(`clan:${clanId}`);
  if (!clan) throw new ArenaError(404, 'Clan not found.');
  if (clan.members.length >= CLAN_MAX) throw new ArenaError(400, 'Clan is full.');
  const rec = await getPlayer(tokenId);
  if (rec.clanId) throw new ArenaError(400, 'Leave your current clan first.');
  const next = { ...clan, members: [...new Set([...clan.members, tokenId])] };
  await kv().set(`clan:${clanId}`, next);
  await kv().set(`player:${tokenId}`, { ...rec, clanId });
  return next;
}

export async function leaveClan(tokenId: number): Promise<void> {
  const rec = await getPlayer(tokenId);
  if (!rec.clanId) return;
  const clan = await kv().get<Clan>(`clan:${rec.clanId}`);
  await kv().set(`player:${tokenId}`, { ...rec, clanId: null });
  if (!clan) return;
  const members = clan.members.filter((m) => m !== tokenId);
  if (!members.length) {
    await kv().del(`clan:${clan.id}`);
    await kv().srem('clans', clan.id);
    return;
  }
  await kv().set(`clan:${clan.id}`, { ...clan, members, leader: clan.leader === tokenId ? members[0] : clan.leader });
}

export async function getClan(id: string) {
  const clan = await kv().get<Clan>(`clan:${id}`);
  if (!clan) return null;
  const points = (await kv().zscore(`lb:clan:${SEASON.id}`, id)) ?? 0;
  const members = await Promise.all(clan.members.map(async (m) => ({ tokenId: m, points: (await kv().zscore(`clanmember:${id}`, String(m))) ?? 0 })));
  return { ...clan, points, members: members.sort((a, b) => b.points - a.points), milestones: CHEST_MILESTONES };
}
