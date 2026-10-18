import { handle, json } from '@/server/http';
import { listFlags } from '@/server/flags';

export async function GET() {
  return handle(async () => json({ flags: await listFlags() }, { headers: { 'cache-control': 'public, max-age=30' } }));
}
