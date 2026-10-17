'use client';

import { ArrowLeft, Crown, Lock, Star } from 'lucide-react';
import { ZONES } from '@/game/campaign';
import { useMatch } from '../match/useMatch';
import { useMatchCtx } from '../match/useMatchCtx';
import { Button, ElementBadge, Panel, Title } from '../ui';
import { useLoadout, useProgress } from '@/lib/hooks';
import { useGame } from '@/lib/store';

export function CampaignScreen() {
  const p = useProgress();
  const lo = useLoadout();
  const ctx = useMatchCtx();
  const start = useMatch((s) => s.start);
  const busy = useMatch((s) => s.busy);
  const setScreen = useGame((s) => s.setScreen);
  const cleared = (id: string) => (p.campaign[id] ?? 0) > 0;
  const totalStars = Object.values(p.campaign).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <Title sub={`${totalStars} / ${ZONES.length * 9} stars`} right={<Button tone="ghost" size="sm" onClick={() => setScreen('battle')}><ArrowLeft size={16} /> Battle</Button>}>Campaign</Title>
      {ZONES.map((zone, zi) => {
        const prevZoneDone = zi === 0 || ZONES[zi - 1].stages.every((s) => cleared(s.id));
        const holderLocked = zone.requiresHolder && !lo.isHolder;
        return (
          <section key={zone.id} className="overflow-hidden rounded-3xl border border-line" style={{ background: `linear-gradient(135deg, ${zone.sky[0]}55, ${zone.sky[1]}cc)` }}>
            <div className="flex items-center justify-between gap-3 bg-black/25 px-4 py-3 text-white">
              <div>
                <h3 className="font-pixel text-xl">{zone.name}</h3>
                <p className="text-sm text-white/75">{zone.tagline}</p>
              </div>
              {zone.requiresHolder && <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-black text-[#2a1a00]">HOLDERS</span>}
            </div>
            <div className="grid gap-2 p-3 sm:grid-cols-3">
              {zone.stages.map((st, si) => {
                const unlocked = !holderLocked && prevZoneDone && (si === 0 || cleared(zone.stages[si - 1].id));
                const stars = p.campaign[st.id] ?? 0;
                return (
                  <Panel key={st.id} className={`!bg-panel/90 ${unlocked ? '' : 'opacity-60'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-dim">Stage {si + 1}</div>
                        <div className="flex items-center gap-1 font-extrabold">{st.enemy.boss && <Crown size={14} className="text-gold" />}{st.name}</div>
                        <div className="text-xs text-dim">vs {st.enemy.name}</div>
                      </div>
                      <ElementBadge element={st.enemy.element} />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex gap-0.5" aria-label={`${stars} of 3 stars`}>
                        {[1, 2, 3].map((n) => <Star key={n} size={16} className={n <= stars ? 'fill-gold text-gold' : 'text-dim'} />)}
                      </div>
                      {unlocked ? (
                        <Button size="sm" tone={stars ? 'panel' : 'gold'} disabled={busy} onClick={() => void start('campaign', ctx, { stageId: st.id })}>{stars ? 'Replay' : 'Fight'}</Button>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-dim"><Lock size={14} />{holderLocked ? 'Chog holders' : 'Locked'}</span>
                      )}
                    </div>
                    {!stars && <div className="mt-1 text-[11px] text-dim">First clear: +{st.reward.sparks} Sparks</div>}
                  </Panel>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
