/**
 * Season prize split. Shares are in basis points of the pool by final rank on the season board
 * (top 100, after flagged and transfer-locked Chogs are removed). Prizes go to whoever owns the
 * Chog at the snapshot, because rewards follow the token.
 */
export function rankShareBps(rank: number): number {
  if (rank === 1) return 1500;
  if (rank === 2) return 1000;
  if (rank === 3) return 700;
  if (rank <= 10) return 300; // 7 × 3%  = 21%
  if (rank <= 50) return 100; // 40 × 1% = 40%
  if (rank <= 100) return 14; // 50 × 0.14% = 7%
  return 0;
}

export const PAYOUT_TOTAL_BPS = Array.from({ length: 100 }, (_, i) => rankShareBps(i + 1)).reduce((a, b) => a + b, 0);

export interface Payout {
  address: `0x${string}`;
  amount: bigint;
  tokens: number[];
}

/**
 * @param ranked tokens in final board order with their owner at snapshot time
 * @param pool   total $CHOG (wei) committed for the season
 * @param cap    contract maxClaimPerWallet (wei); 0 = no cap. Anything above it stays in the vault.
 */
export function computePayouts(ranked: { tokenId: number; owner: `0x${string}` }[], pool: bigint, cap: bigint): { payouts: Payout[]; total: bigint; unallocated: bigint } {
  const byOwner = new Map<string, Payout>();
  ranked.slice(0, 100).forEach((r, i) => {
    const amount = (pool * BigInt(rankShareBps(i + 1))) / 10_000n;
    if (amount === 0n) return;
    const key = r.owner.toLowerCase();
    const cur = byOwner.get(key) ?? { address: r.owner, amount: 0n, tokens: [] };
    cur.amount += amount;
    cur.tokens.push(r.tokenId);
    byOwner.set(key, cur);
  });
  const payouts = [...byOwner.values()].map((p) => ({ ...p, amount: cap > 0n && p.amount > cap ? cap : p.amount })).filter((p) => p.amount > 0n);
  const total = payouts.reduce((a, p) => a + p.amount, 0n);
  return { payouts, total, unallocated: pool - total };
}
