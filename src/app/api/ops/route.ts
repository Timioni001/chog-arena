import { handle, json } from '@/server/http';
import { getOps } from '@/server/ops';

/** Public live-ops state: the announcement banner and whether ranked is paused. */
export async function GET() {
  return handle(async () => json(await getOps(), { headers: { 'cache-control': 'public, max-age=30' } }));
}
