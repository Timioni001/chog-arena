import { handle, json } from '@/server/http';
import { adminLogin, adminLogout } from '@/server/admin';

/** POST { token } signs this browser in to the console; DELETE signs it out. */
export async function POST(req: Request) {
  return handle(async () => {
    const { token } = (await req.json().catch(() => ({}))) as { token?: string };
    await adminLogin(req, String(token ?? ''));
    return json({ ok: true });
  });
}

export async function DELETE() {
  return handle(async () => {
    await adminLogout();
    return json({ ok: true });
  });
}
