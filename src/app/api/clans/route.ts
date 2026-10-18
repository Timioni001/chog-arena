import { handle, json, requireOwner } from '@/server/http';
import { createClan, getClan, joinClan, leaveClan, listClans } from '@/server/clans';
import { ArenaError } from '@/server/arena';

export async function GET(req: Request) {
  return handle(async () => {
    const id = new URL(req.url).searchParams.get('id');
    if (id) return json({ clan: await getClan(id) });
    return json({ clans: await listClans() });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const body = (await req.json()) as { action: 'create' | 'join' | 'leave'; tokenId: number; name?: string; tag?: string; clanId?: string };
    if (!Number.isInteger(body.tokenId)) throw new ArenaError(403, 'Clans need a Chog.');
    await requireOwner(body.tokenId);
    if (body.action === 'create') return json({ clan: await createClan(body.tokenId, body.name ?? '', body.tag ?? '') });
    if (body.action === 'join') return json({ clan: await joinClan(body.tokenId, body.clanId ?? '') });
    await leaveClan(body.tokenId);
    return json({ ok: true });
  });
}
