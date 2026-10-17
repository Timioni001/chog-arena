import 'server-only';
import { createPublicClient, http, getAddress, type Address } from 'viem';
import { monad } from 'viem/chains';
import { COLLECTION } from '@/game/collection';

const NFT = (process.env.NEXT_PUBLIC_CHOG_NFT_ADDRESS || COLLECTION.contract) as Address;

export const publicClient = createPublicClient({ chain: monad, transport: http(process.env.MONAD_RPC_URL || 'https://rpc.monad.xyz', { batch: true, retryCount: 3 }) });

const ownerOfAbi = [{ type: 'function', name: 'ownerOf', stateMutability: 'view', inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ type: 'address' }] }] as const;

const g = globalThis as unknown as { __owners?: { at: number; owners: (Address | null)[]; pending?: Promise<(Address | null)[]> } };

/** Owner of every token, read with Multicall3 and cached for 60s. The contract is not enumerable. */
export async function ownersSnapshot(maxAgeMs = 60_000): Promise<(Address | null)[]> {
  const c = g.__owners;
  if (c && Date.now() - c.at < maxAgeMs) return c.owners;
  if (c?.pending) return c.pending;
  const pending = (async () => {
    const ids = Array.from({ length: COLLECTION.supply }, (_, i) => BigInt(COLLECTION.firstTokenId + i));
    const owners: (Address | null)[] = [];
    for (let i = 0; i < ids.length; i += 400) {
      const chunk = ids.slice(i, i + 400);
      const res = await publicClient.multicall({ contracts: chunk.map((id) => ({ address: NFT, abi: ownerOfAbi, functionName: 'ownerOf', args: [id] })), allowFailure: true });
      for (const r of res) owners.push(r.status === 'success' ? (r.result as Address) : null);
    }
    g.__owners = { at: Date.now(), owners };
    return owners;
  })();
  g.__owners = { at: c?.at ?? 0, owners: c?.owners ?? [], pending };
  try {
    return await pending;
  } catch (e) {
    g.__owners = c;
    throw e;
  }
}

export async function tokensOf(address: string): Promise<number[]> {
  const a = getAddress(address);
  const owners = await ownersSnapshot();
  const out: number[] = [];
  owners.forEach((o, i) => { if (o && o === a) out.push(COLLECTION.firstTokenId + i); });
  return out;
}

/** Fresh ownerOf read (no cache): used right before ranked matches and attestations. */
export async function ownerOf(tokenId: number): Promise<Address | null> {
  try {
    return await publicClient.readContract({ address: NFT, abi: ownerOfAbi, functionName: 'ownerOf', args: [BigInt(tokenId)] });
  } catch {
    return null;
  }
}
