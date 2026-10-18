import { handle, json, requireAdmin } from '@/server/http';
import { stats } from '@/server/analytics';
import { listFlags } from '@/server/flags';
import { kv } from '@/server/kv';

export async function GET(req: Request) {
  return handle(async () => {
    requireAdmin(req);
    return json({ store: kv().kind, days: await stats(14), flags: await listFlags() });
  });
}
