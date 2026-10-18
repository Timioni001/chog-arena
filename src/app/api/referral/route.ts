import { handle, json } from '@/server/http';
import { kv } from '@/server/kv';
import { ArenaError } from '@/server/arena';

const REF = /^(t\d{1,5}|d-[a-zA-Z0-9-]{8,64})$/;
const DEVICE = /^[a-zA-Z0-9-]{8,64}$/;

/** GET ?key=t123 → how many invited players finished their first match. */
export async function GET(req: Request) {
  return handle(async () => {
    const key = new URL(req.url).searchParams.get('key') ?? '';
    if (!REF.test(key)) throw new ArenaError(400, 'Bad referral key');
    return json({ count: (await kv().get<number>(`ref:${key}`)) ?? 0 });
  });
}

/** POST { ref, device }: sent once by the invitee after their first finished match. */
export async function POST(req: Request) {
  return handle(async () => {
    const { ref, device } = (await req.json()) as { ref: string; device: string };
    if (!REF.test(ref) || !DEVICE.test(device)) throw new ArenaError(400, 'Bad referral');
    if (ref === `d-${device}`) throw new ArenaError(400, 'You cannot refer yourself.');
    if (await kv().get(`refdev:${device}`)) return json({ ok: true, counted: false });
    await kv().set(`refdev:${device}`, ref);
    const count = await kv().incr(`ref:${ref}`, 1);
    return json({ ok: true, counted: true, count });
  });
}
