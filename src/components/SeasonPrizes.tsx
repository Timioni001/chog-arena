'use client';

import { useQuery } from '@tanstack/react-query';
import { Gift } from 'lucide-react';
import { formatUnits } from 'viem';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { api } from '@/lib/api';
import { PASS_ADDRESS, passAbi, SEASONS_ADDRESS, seasonsAbi } from '@/lib/wagmi';
import { SEASON } from '@/game/season';
import { Button, Panel, toast } from './ui';

interface ClaimResp {
  meta: { root: `0x${string}`; total: string; count: number } | null;
  claim: { amount: string; proof: `0x${string}`[]; tokens: number[] } | null;
}

type Asset = 'chog' | 'mon';
const SID = BigInt(SEASON.id);

/** Season prize claims: proofs come from the app; $CHOG pays from ChogArenaSeasons, MON from ChogPass. */
export function SeasonPrizes() {
  const { address } = useAccount();
  const ended = Date.now() > SEASON.end;
  const any = !!SEASONS_ADDRESS || !!PASS_ADDRESS;
  let intro: React.ReactNode = null;
  if (!any) intro = <p className="text-sm text-dim">Season prizes pay out onchain once the contracts go live.</p>;
  else if (!ended) intro = <p className="text-sm text-dim">The top 100 on the season board split the MON and $CHOG pools when the season ends on {new Date(SEASON.end).toLocaleDateString()}. Pools fill from Premium Passes, shop purchases and sponsors, not new tokens.</p>;
  else if (!address) intro = <p className="text-sm text-dim">Connect the wallet that held your Chog at the season snapshot to check for prizes.</p>;
  return (
    <Panel>
      <div className="eyebrow mb-1.5">Your season prizes</div>
      <div className="mb-3 font-display text-xl font-semibold">{SEASON.name}</div>
      {intro ?? (
        <div className="space-y-3">
          {PASS_ADDRESS && <ClaimRow asset="mon" />}
          {SEASONS_ADDRESS && <ClaimRow asset="chog" />}
        </div>
      )}
    </Panel>
  );
}

function ClaimRow({ asset }: { asset: Asset }) {
  const { address } = useAccount();
  const isMon = asset === 'mon';
  const contract = ((isMon ? PASS_ADDRESS : SEASONS_ADDRESS) || undefined) as `0x${string}` | undefined;
  const q = useQuery({ queryKey: ['claim', asset, SEASON.id, address], queryFn: () => api<ClaimResp>(`/api/claims?season=${SEASON.id}&address=${address}${isMon ? '&asset=mon' : ''}`), enabled: !!address });
  // The two contracts expose the same `seasons`/`hasClaimed` reads with different tuple layouts.
  const onchain = useReadContract({ address: contract, abi: (isMon ? passAbi : seasonsAbi) as typeof passAbi, functionName: 'seasons', args: [SID], query: { enabled: !!contract } });
  const claimed = useReadContract({ address: contract, abi: passAbi, functionName: 'hasClaimed', args: address ? [SID, address] : undefined, query: { enabled: !!contract && !!address } });
  const { writeContractAsync, isPending } = useWriteContract();
  const unit = isMon ? 'MON' : '$CHOG';
  const meta = q.data?.meta;
  const claim = q.data?.claim;
  const data = onchain.data as readonly unknown[] | undefined;
  const root = (isMon ? data?.[5] : data?.[3]) as string | undefined;
  const deadline = data?.[2] ? Number(data[2] as bigint) * 1000 : null;
  const rootLive = !!meta && root?.toLowerCase() === meta.root.toLowerCase();

  if (!meta) return <p className="text-sm text-dim">{unit}: final standings are being verified. Prizes appear here once the payout root is published.</p>;
  if (!claim) return <p className="text-sm text-dim">{unit}: no prize for this wallet this season. {meta.count} wallets placed in the top 100.</p>;
  const amount = Number(formatUnits(BigInt(claim.amount), 18));
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-panel-2 p-3">
      <div className="min-w-0 flex-1">
        <div className="font-display text-3xl font-semibold">{amount.toLocaleString('en-US', { maximumFractionDigits: 4 })} <span className="text-base text-dim">{unit}</span></div>
        <div className="text-xs text-dim">For Chog{claim.tokens.length > 1 ? 's' : ''} {claim.tokens.map((t) => `#${t}`).join(', ')}{deadline ? ` · claim by ${new Date(deadline).toLocaleDateString()}` : ''}</div>
      </div>
      <Button
        tone="gold"
        disabled={!rootLive || claimed.data === true || isPending}
        onClick={async () => {
          try {
            await writeContractAsync({ address: contract!, abi: isMon ? passAbi : seasonsAbi, functionName: 'claim', args: [SID, BigInt(claim.amount), claim.proof] } as never);
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
