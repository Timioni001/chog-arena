import { handle, json } from '@/server/http';
import { leaderboard } from '@/server/arena';
import { listClans } from '@/server/clans';

export async function GET(req: Request) {
  return handle(async () => {
    const board = new URL(req.url).searchParams.get('board') ?? 'season';
    if (board === 'clan') return json({ board, rows: (await listClans()).map((c, i) => ({ rank: i + 1, ...c })) });
    return json(await leaderboard(board), { headers: { 'cache-control': 'public, max-age=10' } });
  });
}
