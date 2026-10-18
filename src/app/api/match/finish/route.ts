import { getSession } from '@/server/session';
import { handle, json } from '@/server/http';
import { finishMatch } from '@/server/arena';
import type { Play } from '@/game/battle';

export async function POST(req: Request) {
  return handle(async () => {
    const body = (await req.json()) as { matchId: string; ticket?: string; plays: Play[][]; bots: unknown; owned: number; skills?: Record<string, number>; displayName?: string; hideWallet?: boolean };
    const s = await getSession();
    const r = await finishMatch({ ...body, address: s?.address ?? null });
    return json(r);
  });
}
