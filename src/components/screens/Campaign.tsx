'use client';

import { ArrowLeft, Crown, Lock, Star } from 'lucide-react';
import { ZONES } from '@/game/campaign';
import { useMatch } from '../match/useMatch';
import { useMatchCtx } from '../match/useMatchCtx';
import { Button, ElementBadge } from '../ui';
import { useLoadout, useProgress } from '@/lib/hooks';
import { useGame } from '@/lib/store';
import { ZONE_ART } from '@/lib/art';

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
      <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-sm font-semibold"><Star size={16} className="fill-gold text-gold" /> {totalStars} / {ZONES.length * 9} stars</span><Button tone="ghost" size="sm" onClick={() => setScreen('battle')}><ArrowLeft size={16} /> Battle</Button></div>
      {ZONES.map((zone, zi) => {
        const prevZoneDone = zi === 0 || ZONES[zi - 1].stages.every((s) => cleared(s.id));
        const holderLocked = zone.requiresHolder && !lo.isHolder;
        return (
          <section key={zone.id} className="surface overflow-hidden rounded-[32px]">
            <div className="relative flex h-48 items-end sm:h-56 justify-between gap-3 p-5 text-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ZONE_ART[zone.id]} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover object-[50%_32%]" />
              <div className="absolute inset-0 bg-gradient-to-t from-night/90 via-night/25 to-transparent" />
              <div className="relative">
                <div className="eyebrow !text-white/70">Zone {zi + 1}</div>
                <h3 className="font-display text-[1.7rem] font-semibold leading-tight">{zone.name}</h3>
                <p className="text-sm text-white/75">{zone.tagline}</p>
              </div>
              {zone.requiresHolder && <span className="relative rounded-full bg-gold px-3 py-1 text-[11px] font-bold tracking-wider text-[#3a2400]">HOLDERS</span>}
            </div>
            <div className="grid gap-2 p-3 sm:grid-cols-3">
              {zone.stages.map((st, si) => {
                const unlocked = !holderLocked && prevZoneDone && (si === 0 || cleared(zone.stages[si - 1].id));
                const stars = p.campaign[st.id] ?? 0;
                return (
                  <div key={st.id} className={`rounded-[22px] border border-line bg-panel-2 p-4 ${unlocked ? '' : 'opacity-55'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-dim">Stage {si + 1}</div>
                        <div className="flex items-center gap-1 font-semibold">{st.enemy.boss && <Crown size={14} className="text-gold" />}{st.name}</div>
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
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
