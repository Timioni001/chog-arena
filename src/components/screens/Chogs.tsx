'use client';

import { useState } from 'react';
import { ProfileCard, StoryModal, useVariantState } from '../showcase';
import { Tabs } from '../ui';
import { useGame } from '@/lib/store';
import { useProgress } from '@/lib/hooks';
import { VARIANTS, type Variant } from '@/lib/art';

type F = 'all' | 'owned' | 'locked';

export function ChogsScreen() {
  const p = useProgress();
  const setScreen = useGame((s) => s.setScreen);
  const setTryOn = useGame((s) => s.setTryOn);
  const { owns } = useVariantState();
  const [f, setF] = useState<F>('all');
  const [story, setStory] = useState<Variant | null>(null);
  const list = VARIANTS.filter((v) => (f === 'owned' ? owns(v) : f === 'locked' ? !owns(v) : true));
  const n = VARIANTS.filter(owns).length;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-lg text-sm text-dim">Each variant is a gear set for your 3D Chog. Unlock them on the season pass, equip one, and it follows you into every match. <b className="text-ink">{n}/{VARIANTS.length}</b> unlocked.</p>
        <Tabs value={f} onChange={setF} items={[{ id: 'all', label: 'All' }, { id: 'owned', label: 'Owned' }, { id: 'locked', label: 'Locked' }]} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {list.map((v) => (
          <ProfileCard
            key={v.id}
            v={v}
            level={owns(v) && (p.gear ?? 'wild') === v.id ? p.level : undefined}
            onStory={() => setStory(v)}
            onTry={v.id === 'wild' ? undefined : () => { setTryOn(v.id); setScreen('lab'); }}
          />
        ))}
      </div>
      <StoryModal v={story} onClose={() => setStory(null)} />
    </div>
  );
}
