'use client';

import { motion } from 'framer-motion';
import { Link2, Share2, ShieldCheck, Swords, Trophy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { useMatch } from './useMatch';
import { ChogModel, type AnimCue } from '../three/ChogModel';
import { Stage, World, webglAvailable } from '../three/Scene';
import { ChogSprite } from '../ChogSprite';
import { Button, Pill, Spark, toast } from '../ui';
import { fmt, useLoadout, useQuality, useReducedMotion } from '@/lib/hooks';
import { seasonsAbi, SEASONS_ADDRESS } from '@/lib/wagmi';
import { makeShareCard } from './shareCard';
import { useGame } from '@/lib/store';
import type { Gear } from '../three/ChogModel';

export function ResultPanel() {
  const live = useMatch((x) => x.session);
  const last = useRef(live);
  if (live) last.current = live;
  const s = last.current!;
  const close = useMatch((x) => x.close);
  const rematch = useMatch((x) => x.rematch);
  const lo = useLoadout();
  const quality = useQuality();
  const reduced = useReducedMotion();
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const [recorded, setRecorded] = useState<string | null>(null);
  const spriteRef = useRef<HTMLDivElement>(null);
  const o = s.outcome!;
  const won = o.result.winner === 0;
  const draw = o.result.winner === null;
  const [cue, setCue] = useState<AnimCue>({ kind: 'idle', id: 0 });
  const [gl] = useState(() => webglAvailable());
  useEffect(() => {
    const t = setTimeout(() => setCue({ kind: won ? 'win' : draw ? 'idle' : 'lose', id: 1 }), 250);
    return () => clearTimeout(t);
  }, [won, draw]);

  const shareUrl = o.challengeLink ? `${window.location.origin}/?c=${encodeURIComponent(o.challengeLink)}` : null;

  const share = async () => {
    const svg = spriteRef.current?.querySelector('svg');
    const blob = await makeShareCard({ won, draw, name: s.ctx.fighter.name, opponent: s.opponent.name, score: o.result.score[0], lanes: o.result.laneWinners, power: o.result.totalPower, mode: s.mode, svg: svg ?? null, url: shareUrl });
    const file = new File([blob], 'chog-arena-result.png', { type: 'image/png' });
    const text = `${won ? 'Won' : draw ? 'Drew' : 'Lost'} a ${s.mode} match in Chog Arena with ${s.ctx.fighter.name}: ${o.result.score[0]} pts.${shareUrl ? ' Think you can beat it?' : ''}`;
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text, url: shareUrl ?? undefined });
        return;
      }
    } catch {
      /* user cancelled */
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'chog-arena-result.png';
    a.click();
    toast.good('Result card saved.');
  };

  const copyChallenge = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.good('Challenge link copied: same seed, same lanes. Beat my score!');
    } catch {
      toast.info(shareUrl);
    }
  };

  const recordOnchain = async () => {
    if (!o.attestation || !SEASONS_ADDRESS) return;
    const a = o.attestation;
    try {
      const hash = await writeContractAsync({
        address: SEASONS_ADDRESS as `0x${string}`,
        abi: seasonsAbi,
        functionName: 'recordMatch',
        args: [{ seasonId: BigInt(a.seasonId), tokenId: BigInt(a.tokenId), player: a.player, won: a.won, score: a.score, matchId: a.matchId, deadline: BigInt(a.deadline) }, a.signature],
      });
      setRecorded(hash);
      toast.good('Recorded on Monad.');
    } catch (e) {
      toast.bad((e as Error).message.split('\n')[0]);
    }
  };

  const beatChallenge = o.challengeScore !== null ? o.result.score[0] > o.challengeScore : null;

  return (
    <motion.div className="absolute inset-0 z-10 overflow-y-auto bg-black/70 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="safe-top mx-auto flex min-h-full max-w-md flex-col px-4 pb-8 pt-4">
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }} className={`text-center font-display text-6xl font-semibold italic ${won ? 'shimmer-text' : draw ? 'text-white' : 'text-[#ff8fa8]'}`}>
          {won ? 'Victory' : draw ? 'Draw' : 'Defeat'}
        </motion.div>
        <div className="mt-1 text-center text-sm text-white/70">
          {o.result.laneWinners.filter((w) => w === 0).length}–{o.result.laneWinners.filter((w) => w === 1).length} lanes · {o.result.totalPower[0]} vs {o.result.totalPower[1]} power
        </div>

        <div className="relative mx-auto mt-4 h-60 w-full overflow-hidden rounded-[28px] border border-white/15">
          {gl ? (
            <Stage quality={quality} reducedMotion={reduced} className="absolute inset-0" camera={[0, 1.5, 5.2]}>
              <World backdrop={s.stageId ? (s.stageId.split('-')[0] as 'cloud') : 'studio'} />
              <ChogModel look={lo.look} cue={cue} ascension={lo.ascension.ring} gear={(useGame.getState().progress[useGame.getState().activeKey]?.gear as Gear) ?? null} />
            </Stage>
          ) : (
            <div className="grid h-full place-items-center"><ChogSprite look={lo.look} size={180} /></div>
          )}
        </div>
        <div ref={spriteRef} className="hidden"><ChogSprite look={lo.look} size={400} /></div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Reward label="Sparks" value={<span className="flex items-center gap-1"><Spark />+{fmt(o.reward.sparks)}</span>} />
          <Reward label="XP" value={`+${o.reward.xp}`} />
          {s.mode === 'ranked' && <Reward label="MMR" value={<span className={o.reward.mmrDelta >= 0 ? 'text-lime' : 'text-danger'}>{o.reward.mmrDelta >= 0 ? '+' : ''}{o.reward.mmrDelta}</span>} />}
          {s.mode === 'ranked' && <Reward label="Season rank" value={o.rank ? `#${o.rank}` : '—'} />}
          <Reward label="Score" value={o.result.score[0]} />
          <Reward label="Pass XP" value={`+${o.reward.passXp}`} />
        </div>
        {o.reward.levelsGained > 0 && <div className="mt-2 rounded-2xl bg-gold/15 p-2 text-center font-bold text-gold">Level up! +{o.reward.levelsGained} skill point{o.reward.levelsGained > 1 ? 's' : ''}</div>}
        {beatChallenge !== null && (
          <div className={`mt-2 rounded-2xl p-2 text-center font-bold ${beatChallenge ? 'bg-lime/15 text-lime' : 'bg-danger/15 text-[#ffb3bf]'}`}>
            {beatChallenge ? `You beat ${s.challenge?.name}'s ${o.challengeScore} pts!` : `${s.challenge?.name} keeps the crown with ${o.challengeScore} pts.`}
          </div>
        )}

        <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs">
          {o.verified ? <Pill color="#39ff6a"><ShieldCheck size={12} /> Server-verified replay</Pill> : s.online ? <Pill color="#ff5a6e">Not verified</Pill> : <Pill>Offline match</Pill>}
          {o.rewardsLockedUntil && <Pill color="#ffd166">Prize boards unlock {new Date(o.rewardsLockedUntil).toLocaleDateString()}</Pill>}
        </div>

        <div className="mt-4 grid gap-2">
          {o.attestation && SEASONS_ADDRESS && address && (
            <Button tone="lime" onClick={recordOnchain} disabled={isPending || !!recorded}>
              <Trophy size={18} /> {recorded ? 'Recorded on Monad' : isPending ? 'Confirm in wallet…' : 'Record result on Monad'}
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button tone="panel" onClick={share}><Share2 size={18} /> Share card</Button>
            <Button tone="panel" onClick={copyChallenge} disabled={!shareUrl}><Link2 size={18} /> Challenge</Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button tone="ghost" className="!text-white" onClick={close}>Done</Button>
            <Button tone="chog" onClick={() => void rematch()}><Swords size={18} /> Play again</Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Reward({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.06] p-3.5">
      <div className="eyebrow !text-[0.6rem] !text-white/55">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
