/**
 * Builds the season prize merkle tree from the live season board and (optionally) publishes the
 * per-wallet proofs to the app so players can claim in-game.
 *
 *   npx tsx scripts/build-prize-root.ts --site https://YOUR_DOMAIN --season 1 --pool 100000 [--cap 5000] [--publish]
 *   npx tsx scripts/build-prize-root.ts --site https://YOUR_DOMAIN --season 1 --asset mon --pool <MON in ChogPass> [--publish]
 *
 * --pool is the amount (whole tokens) you will commit: $CHOG already in ChogArenaSeasons, or with
 * --asset mon the MON pool shown by ChogPass.seasons(id). MON has no per-wallet cap by default.
 * --publish needs ADMIN_TOKEN in the environment.
 * Output: out/prizes-season-<n>.json and the exact setPrizeRoot arguments for the Safe.
 */
import fs from 'node:fs';
import path from 'node:path';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { createPublicClient, formatUnits, http, parseUnits } from 'viem';
import { monad } from 'viem/chains';
import { computePayouts } from '../src/game/prizes';

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1];
  if (fallback !== undefined) return fallback;
  throw new Error(`missing --${name}`);
}

const site = arg('site').replace(/\/$/, '');
const season = Number(arg('season', '1'));
const pool = parseUnits(arg('pool'), 18);
const asset = arg('asset', 'chog') === 'mon' ? 'mon' : 'chog';
const unit = asset === 'mon' ? 'MON' : 'CHOG';
const cap = parseUnits(arg('cap', asset === 'mon' ? '0' : '5000'), 18);
const publish = process.argv.includes('--publish');
const NFT = (process.env.NEXT_PUBLIC_CHOG_NFT_ADDRESS || '0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763') as `0x${string}`;
const client = createPublicClient({ chain: monad, transport: http(process.env.MONAD_RPC_URL || 'https://rpc.monad.xyz', { retryCount: 4 }) });
const ownerOfAbi = [{ type: 'function', name: 'ownerOf', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }] }] as const;

async function main() {
  const board = (await (await fetch(`${site}/api/leaderboard?board=season&limit=100`)).json()) as { rows: { tokenId: number; score: number }[] };
  if (!board.rows?.length) throw new Error('season board is empty');
  const owners = await client.multicall({ contracts: board.rows.map((r) => ({ address: NFT, abi: ownerOfAbi, functionName: 'ownerOf', args: [BigInt(r.tokenId)] })), allowFailure: true });
  const ranked = board.rows.flatMap((r, i) => (owners[i].status === 'success' ? [{ tokenId: r.tokenId, owner: owners[i].result as `0x${string}` }] : []));
  const { payouts, total, unallocated } = computePayouts(ranked, pool, cap);
  const values = payouts.map((p) => [p.address, p.amount.toString()]);
  const tree = StandardMerkleTree.of(values, ['address', 'uint256']);
  const entries = payouts.map((p, i) => ({ address: p.address, amount: p.amount.toString(), proof: tree.getProof(i) as `0x${string}`[], tokens: p.tokens }));
  const block = await client.getBlockNumber();

  const outDir = path.resolve('out');
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `prizes-${asset}-season-${season}.json`);
  fs.writeFileSync(file, JSON.stringify({ season, asset, root: tree.root, total: total.toString(), snapshotBlock: block.toString(), entries, tree: tree.dump() }, null, 2));

  console.log(`Snapshot block ${block}, ${ranked.length} ranked Chogs → ${payouts.length} wallets`);
  console.log(`Root:        ${tree.root}`);
  console.log(`Total:       ${formatUnits(total, 18)} ${unit} (${total} wei)`);
  console.log(`Unallocated: ${formatUnits(unallocated, 18)} ${unit} stays in the pool for a later season`);
  console.log(asset === 'mon' ? `\nSafe → ChogPass.setPrizeRoot(${season}, ${tree.root})` : `\nSafe → ChogArenaSeasons.setPrizeRoot(${season}, ${tree.root}, ${total})`);
  console.log(`Wrote ${file}`);

  if (publish) {
    const res = await fetch(`${site}/api/admin/claims`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.ADMIN_TOKEN ?? ''}` },
      body: JSON.stringify({ season, asset, root: tree.root, total: total.toString(), entries }),
    });
    console.log(`Publish: ${res.status} ${await res.text()}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
