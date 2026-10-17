import { getSession } from '@/server/session';
import { json } from '@/server/http';

export async function GET() {
  const s = await getSession();
  return json({ address: s?.address ?? null });
}
