import { handle, json } from '@/server/http';
import { recordReceipt } from '@/server/income';
import { ArenaError } from '@/server/arena';

/** POST { hash } after a pass, sponsor or shop transaction lands; feeds the revenue log. */
export async function POST(req: Request) {
  return handle(async () => {
    const { hash } = (await req.json().catch(() => ({}))) as { hash?: string };
    if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new ArenaError(400, 'Bad transaction hash.');
    return json({ recorded: await recordReceipt(hash as `0x${string}`) });
  });
}
