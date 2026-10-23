import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { getAddress } from 'viem';
import { kv } from './kv';
import { getSession, seal, unseal } from './session';
import { ArenaError } from './arena';

/**
 * Owner-only access. Two factors when ADMIN_ADDRESSES is set: the ADMIN_TOKEN secret and a SIWE
 * session from an allowlisted wallet. A login swaps the token for an 8h httpOnly, SameSite=Strict
 * cookie, so the token never sits in browser storage. Rotating ADMIN_TOKEN signs every device out.
 */
const COOKIE = 'ca_admin';
const TTL = 8 * 60 * 60;
const MAX_FAILS = 5;
const LOCK_SEC = 15 * 60;

interface AdminCookie { k: 'admin'; exp: number; h: string; a: string | null }

const fingerprint = (t: string) => createHash('sha256').update(`admin:${t}`).digest('hex').slice(0, 16);

function tokenMatches(got: string | null | undefined): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token || token.length < 16 || !got) return false;
  const a = createHash('sha256').update(got).digest();
  const b = createHash('sha256').update(token).digest();
  return timingSafeEqual(a, b);
}

/** Lowercased wallet allowlist from the ADMIN_ADDRESSES secret (comma separated); empty = token only. */
function allowlist(): string[] {
  return (process.env.ADMIN_ADDRESSES ?? '').split(',').map((s) => s.trim().toLowerCase()).filter((s) => /^0x[0-9a-f]{40}$/.test(s));
}

export const clientIp = (req: Request) => req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';

export async function adminLogin(req: Request, token: string) {
  const ip = clientIp(req);
  const failKey = `admin:fail:${ip}`;
  if (((await kv().get<number>(failKey)) ?? 0) >= MAX_FAILS) throw new ArenaError(429, 'Too many attempts. Try again in 15 minutes.');
  if (!tokenMatches(token)) {
    await kv().incr(failKey, 1, LOCK_SEC);
    await audit(req, 'login_failed');
    throw new ArenaError(401, 'Wrong admin token.');
  }
  const list = allowlist();
  let address: string | null = null;
  if (list.length) {
    const s = await getSession();
    if (!s || !list.includes(s.address.toLowerCase())) throw new ArenaError(403, 'Sign in with your admin wallet in the game first, then come back.');
    address = getAddress(s.address);
  }
  await kv().del(failKey);
  const c: AdminCookie = { k: 'admin', exp: Date.now() + TTL * 1000, h: fingerprint(process.env.ADMIN_TOKEN!), a: address };
  (await cookies()).set(COOKIE, seal(c), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: TTL });
  await audit(req, 'login', address ?? undefined);
}

export async function adminLogout() {
  (await cookies()).delete(COOKIE);
}

/** True when the request carries a live admin cookie (used by the /admin page to pick login vs console). */
export async function hasAdminCookie(): Promise<boolean> {
  const token = process.env.ADMIN_TOKEN;
  const c = unseal<AdminCookie>((await cookies()).get(COOKIE)?.value);
  if (!token || token.length < 16 || !c || c.k !== 'admin' || c.exp < Date.now() || c.h !== fingerprint(token)) return false;
  const list = allowlist();
  if (list.length) {
    const s = await getSession();
    if (!c.a || !s || s.address.toLowerCase() !== c.a.toLowerCase() || !list.includes(c.a.toLowerCase())) return false;
  }
  return true;
}

/**
 * Admin endpoints accept `Authorization: Bearer <ADMIN_TOKEN>` (scripts) or the admin cookie
 * (the console). Cookie writes must come from this origin.
 */
export async function requireAdmin(req: Request) {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (bearer) {
    if (tokenMatches(bearer)) return;
    throw new ArenaError(401, 'Admin token required.');
  }
  if (!(await hasAdminCookie())) throw new ArenaError(401, 'Admin sign-in required.');
  if (req.method !== 'GET') {
    const origin = req.headers.get('origin');
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    if (!origin || new URL(origin).host !== host) throw new ArenaError(403, 'Cross-site admin request blocked.');
  }
}

export interface AuditEntry { t: number; action: string; detail?: string; ip: string }

export async function audit(req: Request, action: string, detail?: string) {
  const e: AuditEntry = { t: Date.now(), action, detail: detail?.slice(0, 200), ip: clientIp(req) };
  await kv().zadd('admin:log', e.t, JSON.stringify(e)).catch(() => undefined);
}

export async function auditLog(n = 40): Promise<AuditEntry[]> {
  return (await kv().ztop('admin:log', n)).map((r) => JSON.parse(r.member) as AuditEntry);
}
