import { handle, json, requireAdmin } from '@/server/http';
import { publishClaims, type ClaimEntry } from '@/server/prizes';
import { ArenaError } from '@/server/arena';

/** POST { season, root, total, entries } from scripts/build-prize-root.ts --publish. */
export async function POST(req: Request) {
  return handle(async () => {
    requireAdmin(req);
    const body = (await req.json()) as { season: number; root: `0x${string}`; total: string; entries: ClaimEntry[] };
    if (!Number.isInteger(body.season) || !/^0x[0-9a-f]{64}$/i.test(body.root) || !Array.isArray(body.entries)) throw new ArenaError(400, 'Bad claims payload');
    return json({ meta: await publishClaims(body.season, body.root, body.total, body.entries) });
  });
}
