import { isAddress } from 'viem';
import { handle, json, requireAdmin } from '@/server/http';
import { audit } from '@/server/admin';
import { ArenaError, getPlayer, leaderboard } from '@/server/arena';
import { activeFlag } from '@/server/flags';
import { ownerOf, ownersSnapshot, tokensOf } from '@/server/chain';
import { kv } from '@/server/kv';
import { isValidTokenId } from '@/game/collection';
import { profileForToken } from '@/game/chog';

async function lookup(tokenId: number) {
  const [rec, flag, owner] = await Promise.all([getPlayer(tokenId), activeFlag(tokenId), ownerOf(tokenId)]);
  const p = profileForToken(tokenId);
  return { tokenId, name: p.name, title: p.title, tier: p.tier, element: p.element, archetype: p.archetype, owner, flag, record: rec };
}

/** GET ?q=<token id | wallet> looks players up; without q it returns the top of the season board. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
    if (q) {
      if (/^#?\d+$/.test(q)) {
        const id = Number(q.replace('#', ''));
        if (!isValidTokenId(id)) throw new ArenaError(400, 'No Chog with that id.');
        return json({ results: [await lookup(id)] });
      }
      if (isAddress(q)) return json({ results: await Promise.all((await tokensOf(q)).slice(0, 25).map(lookup)) });
      throw new ArenaError(400, 'Search by token id or wallet address.');
    }
    const [top, owners] = await Promise.all([leaderboard('season', 25), ownersSnapshot().catch(() => [])]);
    const holders = new Set(owners.filter(Boolean)).size;
    return json({ top: top.rows, holders, store: kv().kind });
  });
}

/** POST { action: 'reset_name', tokenId } for moderation. */
export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const { action, tokenId } = (await req.json()) as { action: string; tokenId: number };
    if (!isValidTokenId(tokenId)) throw new ArenaError(400, 'Bad token id.');
    if (action !== 'reset_name') throw new ArenaError(400, 'Unknown action.');
    const rec = await getPlayer(tokenId);
    await kv().set(`player:${tokenId}`, { ...rec, displayName: null });
    await audit(req, 'reset_name', `#${tokenId} (${rec.displayName ?? 'none'})`);
    return json({ ok: true });
  });
}
