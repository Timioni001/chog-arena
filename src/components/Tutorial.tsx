'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { Button } from './ui';
import { useGame } from '@/lib/store';
import { ART } from '@/lib/art';
import { track } from '@/lib/analytics';

const STEPS = [
  { title: 'Meet your Chog', body: 'Hold a Chog Genesis NFT and its traits build your fighter: parts, colors, element, stats and battle cards. No Chog yet? A demo Chog is ready to go.', img: ART.story('wild', 1) },
  { title: 'Tap for Sparks', body: 'Each tap spends energy and earns Sparks. Fast taps build a combo, and filling the charge bar sets off an Overcharge.', img: ART.story('wild', 2) },
  { title: 'Bots work while you sleep', body: 'Equip bots to earn Sparks every hour, even offline. Merge two matching bots to level them up.', img: ART.story('wild', 5) },
  { title: 'Win two of three lanes', body: 'Six quick turns. Play cards up to your energy, then reveal. Flame beats Moss, Moss beats Tide, Tide beats Flame. Ranked seasons and $CHOG prizes are for holders.', img: ART.story('wild', 4) },
];

export function Tutorial() {
  const [i, setI] = useState(0);
  const done = useGame((s) => s.finishTutorial);
  const finish = () => { track('tutorial_done', { kind: i + 1 < STEPS.length ? 'skipped' : 'completed' }); done(); };
  const step = STEPS[i];
  return (
    <div className="fixed inset-0 z-[55] grid place-items-end bg-black/70 p-3 backdrop-blur-sm sm:place-items-center" role="dialog" aria-modal="true" aria-label="Tutorial">
      <AnimatePresence mode="wait">
        <motion.div key={i} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="w-full max-w-md overflow-hidden rounded-[32px] border border-line bg-night text-white shadow-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={step.img} alt="" className="h-60 w-full object-cover" />
          <div className="p-6">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, k) => <span key={k} className={`h-1 rounded-full transition-all ${k === i ? 'w-6 bg-white' : 'w-2 bg-white/30'}`} />)}
          </div>
          <h2 className="mt-4 font-display text-[1.9rem] font-semibold leading-tight">{step.title}</h2>
          <p className="mt-2 text-white/70">{step.body}</p>
          <div className="mt-5 flex gap-2">
            <Button tone="ghost" className="!text-white" onClick={finish}>Skip</Button>
            <Button tone="chog" className="flex-1" onClick={() => (i + 1 < STEPS.length ? setI(i + 1) : finish())}>{i + 1 < STEPS.length ? 'Next' : 'Let’s play'}</Button>
          </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
