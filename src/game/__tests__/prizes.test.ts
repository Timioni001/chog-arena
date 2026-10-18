import { describe, expect, it } from 'vitest';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { encodeAbiParameters, keccak256, concat } from 'viem';
import { computePayouts, PAYOUT_TOTAL_BPS } from '../prizes';

const addr = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as `0x${string}`;

describe('season prizes', () => {
  it('splits exactly 100% across the top 100', () => {
    expect(PAYOUT_TOTAL_BPS).toBe(10_000);
    const ranked = Array.from({ length: 120 }, (_, i) => ({ tokenId: i + 1, owner: addr(i + 1) }));
    const { total, unallocated, payouts } = computePayouts(ranked, 10_000n * 10n ** 18n, 0n);
    expect(payouts).toHaveLength(100);
    expect(total + unallocated).toBe(10_000n * 10n ** 18n);
    expect(unallocated).toBe(0n);
  });
  it('aggregates by owner and applies the per-wallet cap', () => {
    const whale = addr(1);
    const ranked = [{ tokenId: 1, owner: whale }, { tokenId: 2, owner: whale }, { tokenId: 3, owner: addr(3) }];
    const pool = 1_000n * 10n ** 18n;
    const { payouts, unallocated } = computePayouts(ranked, pool, 200n * 10n ** 18n);
    const w = payouts.find((p) => p.address === whale)!;
    expect(w.tokens).toEqual([1, 2]);
    expect(w.amount).toBe(200n * 10n ** 18n); // 250 capped to 200
    expect(unallocated).toBeGreaterThan(0n);
  });
  it('builds leaves the contract accepts', () => {
    const values = [[addr(1), '600'], [addr(2), '400']];
    const tree = StandardMerkleTree.of(values, ['address', 'uint256']);
    // ChogArenaSeasons: keccak256(bytes.concat(keccak256(abi.encode(account, amount))))
    const inner = keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [addr(1), 600n]));
    expect(tree.leafHash(values[0])).toBe(keccak256(concat([inner])));
    expect(StandardMerkleTree.verify(tree.root, ['address', 'uint256'], values[0], tree.getProof(0))).toBe(true);
  });
});
