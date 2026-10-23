import { handle, json, requireAdmin } from '@/server/http';
import { reach, stats } from '@/server/analytics';
import { listFlags } from '@/server/flags';
import { listClans } from '@/server/clans';
import { kv } from '@/server/kv';
import { SEASON } from '@/game/season';

export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const [days, r, flags, clans, ranked] = await Promise.all([stats(37), reach(), listFlags(), listClans(), kv().zcard(`lb:mmr:${SEASON.id}`)]);
    return json({ store: kv().kind, days, reach: r, flags, players: { ranked, clans: clans.length }, season: { id: SEASON.id, name: SEASON.name, start: SEASON.start, end: SEASON.end } }, { headers: { 'cache-control': 'no-store' } });
  });
}
