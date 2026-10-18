import { isAddress } from 'viem';
import { handle, json } from '@/server/http';
import { getClaim } from '@/server/prizes';
import { ArenaError } from '@/server/arena';

/** GET ?season=1&address=0x… → the wallet's prize amount and merkle proof, if any. */
export async function GET(req: Request) {
  return handle(async () => {
    const u = new URL(req.url);
    const season = Number(u.searchParams.get('season'));
    const address = u.searchParams.get('address') ?? '';
    if (!Number.isInteger(season) || season < 1 || !isAddress(address)) throw new ArenaError(400, 'season and address are required');
    return json(await getClaim(season, address));
  });
}
