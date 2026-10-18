import 'server-only';
import { NextResponse } from 'next/server';
import { ArenaError } from './arena';
import { getSession } from './session';
import { ownerOf } from './chain';
import { getAddress } from 'viem';

export function json(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === 'number' ? { status: init } : init);
}

export function handle(fn: () => Promise<Response>) {
  return fn().catch((e: unknown) => {
    if (e instanceof ArenaError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'Something went wrong. Try again.' }, 500);
  });
}

/** Session address that currently owns `tokenId` on chain, or throws. */
export async function requireOwner(tokenId: number) {
  const s = await getSession();
  if (!s) throw new ArenaError(401, 'Sign in with your wallet first.');
  const owner = await ownerOf(tokenId);
  if (!owner || getAddress(owner) !== getAddress(s.address)) throw new ArenaError(403, 'That Chog is not in your wallet.');
  return s.address;
}

/** Admin endpoints require `Authorization: Bearer <ADMIN_TOKEN>` (a Worker secret). */
export function requireAdmin(req: Request) {
  const token = process.env.ADMIN_TOKEN;
  const got = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || token.length < 16 || got !== token) throw new ArenaError(401, 'Admin token required.');
}
