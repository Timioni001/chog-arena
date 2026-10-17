import { json } from '@/server/http';
import { kv } from '@/server/kv';
import { COLLECTION } from '@/game/collection';

export async function GET() {
  return json({
    ok: true,
    store: kv().kind,
    collection: { contract: COLLECTION.contract, supply: COLLECTION.supply, indexedAt: COLLECTION.indexedAt },
    attestations: !!(process.env.ATTESTOR_PRIVATE_KEY && process.env.NEXT_PUBLIC_SEASONS_ADDRESS),
  });
}
