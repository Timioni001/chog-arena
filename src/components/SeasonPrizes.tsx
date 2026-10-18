'use client';

import { useQuery } from '@tanstack/react-query';
import { Gift } from 'lucide-react';
import { formatUnits } from 'viem';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { api } from '@/lib/api';
import { SEASONS_ADDRESS, seasonsAbi } from '@/lib/wagmi';
import { SEASON } from '@/game/season';
import { Button, Panel, toast } from './ui';

interface ClaimResp {
  meta: { root: `0x${string}`; total: string; count: number } | null;
  claim: { amount: string; proof: `0x${string}`[]; tokens: number[] } | null;
}

/** Season prize claims: proofs come from the app, the payout comes from ChogArenaSeasons. */
export function SeasonPrizes() {
  const { address } = useAccount();
  const contract = (SEASONS_ADDRESS || undefined) as `0x${string}` | undefined;
  const q = useQuery({ queryKey: ['claim', SEASON.id, address], queryFn: () => api<ClaimResp>(`/api/claims?season=${SEASON.id}&address=${address}`), enabled: !!address });
  const onchain = useReadContract({ address: contract, abi: seasonsAbi, functionName: 'seasons', args: [BigInt(SEASON.id)], query: { enabled: !!contract } });
  const claimed = useReadContract({ address: contract, abi: seasonsAbi, functionName: 'hasClaimed', args: address ? [BigInt(SEASON.id), address] : undefined, query: { enabled: !!contract && !!address } });
  const { writeContractAsync, isPending } = useWriteContract();

  const ended = Date.now() > SEASON.end;
  const meta = q.data?.meta;
  const claim = q.data?.claim;
  const rootLive = !!meta && onchain.data?.[3]?.toLowerCase() === meta.root.toLowerCase();
  const deadline = onchain.data?.[2] ? Number(onchain.data[2]) * 1000 : null;

  let body: React.ReactNode;
  if (!contract) body = <p className="text-sm text-dim">Season prizes pay out from the onchain prize vault once the contracts go live.</p>;
  else if (!ended) body = <p className="text-sm text-dim">Top 100 on the season board share the $CHOG prize vault when the season ends on {new Date(SEASON.end).toLocaleDateString()}. The vault fills from shop purchases, not new tokens.</p>;
  else if (!address) body = <p className="text-sm text-dim">Connect the wallet that held your Chog at the season snapshot to check for prizes.</p>;
  else if (!meta) body = <p className="text-sm text-dim">Final standings are being verified. Prizes appear here once the season root is published.</p>;
  else if (!claim) body = <p className="text-sm text-dim">No prize for this wallet this season. {meta.count} wallets placed in the top 100.</p>;
  else {
    const amount = formatUnits(BigInt(claim.amount), 18);
    body = (
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-display text-3xl font-semibold">{Number(amount).toLocaleString('en-US', { maximumFractionDigits: 2 })} <span className="text-base text-dim">$CHOG</span></div>
          <div className="text-xs text-dim">For Chog{claim.tokens.length > 1 ? 's' : ''} {claim.tokens.map((t) => `#${t}`).join(', ')}{deadline ? ` · claim by ${new Date(deadline).toLocaleDateString()}` : ''}</div>
        </div>
        <Button
          tone="gold"
          disabled={!rootLive || claimed.data === true || isPending}
          onClick={async () => {
            try {
              await writeContractAsync({ address: contract, abi: seasonsAbi, functionName: 'claim', args: [BigInt(SEASON.id), BigInt(claim.amount), claim.proof] });
              toast.good('Prize claimed. Check your wallet.');
              await claimed.refetch();
            } catch (e) {
              toast.bad((e as Error).message.split('\n')[0]);
            }
          }}
        >
          <Gift size={16} /> {claimed.data ? 'Claimed' : !rootLive ? 'Awaiting onchain root' : isPending ? 'Confirm in wallet…' : 'Claim prize'}
        </Button>
      </div>
    );
  }
  return (
    <Panel>
      <div className="eyebrow mb-1.5">Season prizes</div>
      <div className="mb-3 font-display text-xl font-semibold">{SEASON.name}</div>
      {body}
    </Panel>
  );
}
