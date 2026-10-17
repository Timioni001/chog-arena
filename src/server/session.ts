import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE = 'ca_session';
const NONCE = 'ca_nonce';
const TTL = 60 * 60 * 24 * 7;

const g = globalThis as unknown as { __chogSecret?: string };
function secret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (!g.__chogSecret) {
    // Ephemeral fallback for local runs: sessions and challenge links stop working after a restart.
    if (process.env.NODE_ENV === 'production') console.warn('[chog-arena] SESSION_SECRET is not set; using a temporary secret.');
    g.__chogSecret = randomBytes(32).toString('hex');
  }
  return g.__chogSecret;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function seal(data: object): string {
  const body = Buffer.from(JSON.stringify(data)).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function unseal<T>(token: string | undefined): T | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expect = Buffer.from(sign(body));
  const got = Buffer.from(sig);
  if (expect.length !== got.length || !timingSafeEqual(expect, got)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString()) as T;
  } catch {
    return null;
  }
}

export interface Session {
  address: `0x${string}`;
  exp: number;
}

export async function getSession(): Promise<Session | null> {
  const s = unseal<Session>((await cookies()).get(COOKIE)?.value);
  if (!s || s.exp < Date.now()) return null;
  return s;
}

export async function setSession(address: `0x${string}`) {
  (await cookies()).set(COOKIE, seal({ address, exp: Date.now() + TTL * 1000 }), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: TTL });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function issueNonce(): Promise<string> {
  const nonce = randomBytes(12).toString('hex');
  (await cookies()).set(NONCE, seal({ nonce, exp: Date.now() + 10 * 60_000 }), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 600 });
  return nonce;
}

export async function takeNonce(): Promise<string | null> {
  const jar = await cookies();
  const n = unseal<{ nonce: string; exp: number }>(jar.get(NONCE)?.value);
  jar.delete(NONCE);
  if (!n || n.exp < Date.now()) return null;
  return n.nonce;
}
