import { handle, json } from '@/server/http';
import { leaderboard } from '@/server/arena';
import { listClans } from '@/server/clans';

export async function GET(req: Request) {
  return handle(async () => {
    const board = new URL(req.url).searchParams.get('board') ?? 'season';
    if (board === 'clan') return json({ board, rows: (await listClans()).map((c, i) => ({ rank: i + 1, ...c })) });
    const limit = Math.min(100, Math.max(1, Number(new URL(req.url).searchParams.get('limit')) || 50));
    return json(await leaderboard(board, limit), { headers: { 'cache-control': 'public, max-age=10' } });
  });
}
