import { parseSiweMessage, verifySiweMessage } from 'viem/siwe';
import { getAddress } from 'viem';
import { publicClient } from '@/server/chain';
import { setSession, takeNonce } from '@/server/session';
import { handle, json } from '@/server/http';
import { ArenaError } from '@/server/arena';

export async function POST(req: Request) {
  return handle(async () => {
    const { message, signature } = (await req.json()) as { message: string; signature: `0x${string}` };
    const nonce = await takeNonce();
    if (!nonce) throw new ArenaError(400, 'Sign-in expired. Try again.');
    const parsed = parseSiweMessage(message);
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';
    if (parsed.domain !== host) throw new ArenaError(400, 'Sign-in message is for another site.');
    if (parsed.chainId !== 143) throw new ArenaError(400, 'Switch to Monad to sign in.');
    const ok = await verifySiweMessage(publicClient, { message, signature, nonce, domain: host });
    if (!ok || !parsed.address) throw new ArenaError(401, 'Signature did not verify.');
    await setSession(getAddress(parsed.address));
    return json({ address: getAddress(parsed.address) });
  });
}
