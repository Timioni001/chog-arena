import { handle, json, requireAdmin } from '@/server/http';
import { clearFlag, setFlag } from '@/server/flags';
import { isValidTokenId } from '@/game/collection';
import { ArenaError } from '@/server/arena';

/** POST { tokenId, reason, days? } flags a Chog; DELETE { tokenId } clears it. */
export async function POST(req: Request) {
  return handle(async () => {
    requireAdmin(req);
    const { tokenId, reason, days } = (await req.json()) as { tokenId: number; reason: string; days?: number };
    if (!isValidTokenId(tokenId) || !reason?.trim()) throw new ArenaError(400, 'tokenId and reason are required.');
    return json({ flag: await setFlag(tokenId, reason.trim(), days ?? null) });
  });
}

export async function DELETE(req: Request) {
  return handle(async () => {
    requireAdmin(req);
    const { tokenId } = (await req.json()) as { tokenId: number };
    await clearFlag(tokenId);
    return json({ ok: true });
  });
}
