import { kv } from '@/server/kv';
import { handle, json, requireOwner } from '@/server/http';
import { ArenaError } from '@/server/arena';
import { isValidTokenId } from '@/game/collection';
import { MAX_LEVEL } from '@/game/progression';
import type { Progress } from '@/game/progress';

/** Progress is keyed by token id: whoever holds the Chog inherits everything it earned. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = Number((await params).id);
    if (!isValidTokenId(id)) throw new ArenaError(404, 'No such Chog');
    return json({ progress: await kv().get<Progress>(`progress:${id}`) });
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = Number((await params).id);
    if (!isValidTokenId(id)) throw new ArenaError(404, 'No such Chog');
    await requireOwner(id);
    const { progress } = (await req.json()) as { progress: Progress };
    if (!progress || progress.version !== 1) throw new ArenaError(400, 'Bad progress');
    if (progress.level < 1 || progress.level > MAX_LEVEL || progress.sparks < 0 || progress.sparks > progress.lifetimeSparks + 50_000) throw new ArenaError(422, 'Progress failed sanity checks.');
    const prev = await kv().get<Progress>(`progress:${id}`);
    if (prev && prev.updatedAt > progress.updatedAt) return json({ progress: prev, stale: true }, 409);
    // Ranked numbers always come from the server record, never from the client copy.
    await kv().set(`progress:${id}`, { ...progress, history: progress.history.slice(0, 30) });
    return json({ ok: true });
  });
}
