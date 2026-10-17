import { getSession } from '@/server/session';
import { handle, json } from '@/server/http';
import { startMatch, type Mode } from '@/server/arena';

export async function POST(req: Request) {
  return handle(async () => {
    const body = (await req.json()) as { mode: Mode; tokenId: number | null; stageId?: string; challenge?: string };
    const s = await getSession();
    const m = await startMatch({ mode: body.mode, tokenId: body.tokenId ?? null, address: s?.address ?? null, stageId: body.stageId, challenge: body.challenge });
    return json({ matchId: m.id, seed: m.seed, mode: m.mode, opponent: m.opponent, lanes: m.lanes ?? null, challenge: m.challenge ?? null, lockedUntil: m.lockedUntil, ticket: m.ticket });
  });
}
