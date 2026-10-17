import { isAddress } from 'viem';
import { tokensOf } from '@/server/chain';
import { handle, json } from '@/server/http';
import { ArenaError } from '@/server/arena';

export async function GET(req: Request) {
  return handle(async () => {
    const address = new URL(req.url).searchParams.get('address') ?? '';
    if (!isAddress(address)) throw new ArenaError(400, 'Bad address');
    return json({ address, tokens: await tokensOf(address) }, { headers: { 'cache-control': 'private, max-age=30' } });
  });
}
