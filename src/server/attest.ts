import 'server-only';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, toHex, type Address, type Hex } from 'viem';

export interface MatchAttestation {
  seasonId: string;
  tokenId: string;
  player: Address;
  won: boolean;
  score: number;
  matchId: Hex;
  deadline: string;
  signature: Hex;
  verifyingContract: Address;
}

/**
 * Signs a server-verified match result as EIP-712 typed data matching ChogArenaSeasons.MatchResult.
 * Returns null when no attestor key or seasons contract is configured.
 */
export async function attestMatch(args: { seasonId: number; tokenId: number; player: Address; won: boolean; score: number; matchId: string }): Promise<MatchAttestation | null> {
  const pk = process.env.ATTESTOR_PRIVATE_KEY as Hex | undefined;
  const contract = process.env.NEXT_PUBLIC_SEASONS_ADDRESS as Address | undefined;
  if (!pk || !contract) return null;
  const account = privateKeyToAccount(pk);
  const matchId = keccak256(toHex(args.matchId));
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24);
  const message = { seasonId: BigInt(args.seasonId), tokenId: BigInt(args.tokenId), player: args.player, won: args.won, score: args.score, matchId, deadline };
  const signature = await account.signTypedData({
    domain: { name: 'ChogArena', version: '1', chainId: 143, verifyingContract: contract },
    types: {
      MatchResult: [
        { name: 'seasonId', type: 'uint256' }, { name: 'tokenId', type: 'uint256' }, { name: 'player', type: 'address' }, { name: 'won', type: 'bool' },
        { name: 'score', type: 'uint32' }, { name: 'matchId', type: 'bytes32' }, { name: 'deadline', type: 'uint64' },
      ],
    },
    primaryType: 'MatchResult',
    message,
  });
  return { seasonId: String(args.seasonId), tokenId: String(args.tokenId), player: args.player, won: args.won, score: args.score, matchId, deadline: deadline.toString(), signature, verifyingContract: contract };
}
