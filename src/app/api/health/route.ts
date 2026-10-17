import { json } from '@/server/http';
import { kv } from '@/server/kv';
import { COLLECTION } from '@/game/collection';

export async function GET() {
  const warnings: string[] = [];
  if (kv().kind === 'memory') warnings.push('No UPSTASH_REDIS_REST_URL/TOKEN: leaderboards, MMR and clans are not persisted.');
  if (!process.env.SESSION_SECRET) warnings.push('No SESSION_SECRET: sessions reset whenever the server restarts.');
  return json({
    ok: warnings.length === 0,
    warnings,
    store: kv().kind,
    collection: { contract: COLLECTION.contract, supply: COLLECTION.supply, indexedAt: COLLECTION.indexedAt },
    attestations: !!(process.env.ATTESTOR_PRIVATE_KEY && process.env.NEXT_PUBLIC_SEASONS_ADDRESS),
  });
}
