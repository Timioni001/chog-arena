'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { ChogSprite } from './ChogSprite';
import { Button } from './ui';
import { useGame } from '@/lib/store';
import { useLoadout } from '@/lib/hooks';

const STEPS = [
  { title: 'This is your Chog', body: 'Hold a Chog Genesis NFT and its traits build your fighter: parts, colors, element, stats and battle cards. No Chog yet? A demo Chog is ready to go.', emoji: '🦔' },
  { title: 'Tap for Sparks', body: 'Each tap spends energy and earns Sparks. Fast taps build a combo, and filling the charge bar sets off an Overcharge.', emoji: '⚡' },
  { title: 'Bots work while you sleep', body: 'Equip bots to earn Sparks every hour, even offline. Merge two matching bots to level them up.', emoji: '🤖' },
  { title: 'Battle: win 2 of 3 lanes', body: 'Six quick turns. Play cards up to your energy, then reveal. 🔥 beats 🌿, 🌿 beats 🌊, 🌊 beats 🔥. Ranked seasons and $CHOG prizes are for holders.', emoji: '⚔️' },
];

export function Tutorial() {
  const [i, setI] = useState(0);
  const finish = useGame((s) => s.finishTutorial);
  const lo = useLoadout();
  const step = STEPS[i];
  return (
    <div className="fixed inset-0 z-[55] grid place-items-end bg-black/70 p-3 backdrop-blur-sm sm:place-items-center" role="dialog" aria-modal="true" aria-label="Tutorial">
      <AnimatePresence mode="wait">
        <motion.div key={i} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="w-full max-w-md rounded-3xl border border-line bg-panel p-6">
          <div className="flex items-center gap-4">
            {i === 0 ? <ChogSprite look={lo.look} size={96} /> : <div className="grid size-24 place-items-center rounded-3xl bg-panel-2 text-5xl">{step.emoji}</div>}
            <div>
              <div className="text-xs font-bold text-dim">{i + 1} / {STEPS.length}</div>
              <h2 className="font-pixel text-2xl leading-tight">{step.title}</h2>
            </div>
          </div>
          <p className="mt-4 text-dim">{step.body}</p>
          <div className="mt-5 flex gap-2">
            <Button tone="ghost" onClick={finish}>Skip</Button>
            <Button tone="gold" className="flex-1" onClick={() => (i + 1 < STEPS.length ? setI(i + 1) : finish())}>{i + 1 < STEPS.length ? 'Next' : 'Let’s go!'}</Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
