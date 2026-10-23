import { handle, json, requireAdmin } from '@/server/http';
import { kv } from '@/server/kv';
import { publicClient } from '@/server/chain';
import { COLLECTION } from '@/game/collection';

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: boolean; ms: number; value?: T; error?: string }> {
  const t = Date.now();
  try {
    const value = await fn();
    return { ok: true, ms: Date.now() - t, value };
  } catch (e) {
    return { ok: false, ms: Date.now() - t, error: (e as Error).message.split('\n')[0] };
  }
}

/** Health and configuration. Reports whether secrets are set, never their values. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const [store, rpc] = await Promise.all([timed(() => kv().get('health:ping')), timed(() => publicClient.getBlockNumber())]);
    const e = process.env;
    const rpcHost = (() => { try { return new URL(e.MONAD_RPC_URL || 'https://rpc.monad.xyz').host; } catch { return 'invalid'; } })();
    return json({
      store: { kind: kv().kind, ok: store.ok, ms: store.ms, error: store.error },
      rpc: { ok: rpc.ok, ms: rpc.ms, block: rpc.value ? Number(rpc.value) : null, host: rpcHost, keyed: /alchemy|quiknode|ankr|infura/.test(rpcHost), error: rpc.error },
      access: { cloudflareAccess: !!req.headers.get('cf-access-authenticated-user-email'), walletAllowlist: !!e.ADMIN_ADDRESSES },
      secrets: {
        SESSION_SECRET: !!e.SESSION_SECRET, ADMIN_TOKEN: (e.ADMIN_TOKEN?.length ?? 0) >= 16, ADMIN_ADDRESSES: !!e.ADMIN_ADDRESSES,
        UPSTASH_REDIS_REST_URL: !!e.UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN: !!e.UPSTASH_REDIS_REST_TOKEN,
        ATTESTOR_PRIVATE_KEY: !!e.ATTESTOR_PRIVATE_KEY, MONAD_RPC_URL: !!e.MONAD_RPC_URL,
      },
      contracts: {
        collection: COLLECTION.contract,
        chog: e.NEXT_PUBLIC_CHOG_TOKEN_ADDRESS || '0x350035555E10d9AfAF1566AaebfCeD5BA6C27777',
        seasons: e.NEXT_PUBLIC_SEASONS_ADDRESS || null,
        shop: e.NEXT_PUBLIC_SHOP_ADDRESS || null,
        pass: e.NEXT_PUBLIC_PASS_ADDRESS || null,
      },
    }, { headers: { 'cache-control': 'no-store' } });
  });
}
