import { handle, json, requireAdmin } from '@/server/http';
import { clearFlag, setFlag } from '@/server/flags';
import { isValidTokenId } from '@/game/collection';
import { ArenaError } from '@/server/arena';
import { audit } from '@/server/admin';

/** POST { tokenId, reason, days? } flags a Chog; DELETE { tokenId } clears it. */
export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const { tokenId, reason, days } = (await req.json()) as { tokenId: number; reason: string; days?: number };
    if (!isValidTokenId(tokenId) || !reason?.trim()) throw new ArenaError(400, 'tokenId and reason are required.');
    await audit(req, 'flag', `#${tokenId}: ${reason.trim()}`);
    return json({ flag: await setFlag(tokenId, reason.trim(), days ?? null) });
  });
}

export async function DELETE(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const { tokenId } = (await req.json()) as { tokenId: number };
    await clearFlag(tokenId);
    await audit(req, 'unflag', `#${tokenId}`);
    return json({ ok: true });
  });
}
