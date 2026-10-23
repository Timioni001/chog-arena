import { handle, json, requireAdmin } from '@/server/http';
import { incomeFeed, incomeSeries, readIncome } from '@/server/income';
import { getClaim } from '@/server/prizes';
import { SEASON } from '@/game/season';

const ZERO = '0x0000000000000000000000000000000000000000';

export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    let income = null, error: string | null = null;
    try { income = await readIncome(); } catch (e) { error = `Chain read failed: ${(e as Error).message.split('\n')[0]}`; }
    const [series, feed, chog, mon] = await Promise.all([incomeSeries(30), incomeFeed(30), getClaim(SEASON.id, ZERO, 'chog'), getClaim(SEASON.id, ZERO, 'mon')]);
    return json({ income, error, series, feed, claims: { chog: chog.meta, mon: mon.meta } }, { headers: { 'cache-control': 'no-store' } });
  });
}
