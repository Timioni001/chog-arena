'use client';

import { OrbitControls } from '@react-three/drei';
import { ExternalLink, RotateCcw, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ChogModel, type AnimCue } from '../three/ChogModel';
import { Stage, World, webglAvailable } from '../three/Scene';
import { ChogSprite } from '../ChogSprite';
import { CardView } from '../CardView';
import { Bar, Button, ElementBadge, Img, Panel, Pill, Title, toast } from '../ui';
import { useLoadout, useProgress, useQuality, useReducedMotion } from '@/lib/hooks';
import { useGame } from '@/lib/store';
import { ARCHETYPES, profileForToken } from '@/game/chog';
import { appearanceOf } from '@/lib/appearance';
import { isValidTokenId } from '@/game/collection';
import { COLLECTION, marketLinks, traitCount } from '@/game/collection';
import { SKILL_TREE, ASCENSIONS, type Branch } from '@/game/progression';
import { equipGear, rankSkill, respec } from '@/game/progress';
import { art, VARIANTS } from '@/lib/art';
import type { Gear } from '../three/ChogModel';
import { Lock, Check } from 'lucide-react';
import { ELEMENT_META } from '@/game/elements';
import type { StatKey } from '@/game/types';
import { sfx } from '@/lib/sound';

const STAT_INFO: Record<StatKey, { label: string; color: string; text: string }> = {
  power: { label: 'Power', color: '#ff6a3d', text: '+1 power to your 2+ cost cards every 8 points.' },
  speed: { label: 'Speed', color: '#2fc6ff', text: 'Breaks reveal-order ties: reveal first, react last.' },
  guard: { label: 'Guard', color: '#5ee36a', text: 'Shrinks enemy hex effects.' },
  luck: { label: 'Luck', color: '#ffd166', text: 'Crit chance on reveal (×1.5) and on taps (×5).' },
  focus: { label: 'Focus', color: '#c084fc', text: 'Energy cap and regen. 26+ draws an extra opening card.' },
};

export function LabScreen() {
  const lo = useLoadout();
  const p = useProgress();
  const update = useGame((s) => s.update);
  const quality = useQuality();
  const reduced = useReducedMotion();
  const [cue, setCue] = useState<AnimCue>({ kind: 'idle', id: 0 });
  const [gl] = useState(() => webglAvailable());
  const [previewInput, setPreviewInput] = useState('');
  const [previewId, setPreviewId] = useState<number | null>(null);
  const preview = useMemo(() => (previewId !== null ? profileForToken(previewId) : null), [previewId]);
  const pr = preview ?? lo.profile;
  const look = useMemo(() => (preview ? appearanceOf(preview) : lo.look), [preview, lo.look]);
  const stats = preview ? preview.stats : lo.stats;
  const links = pr.tokenId !== null ? marketLinks(pr.tokenId) : null;
  const openPreview = (raw: string) => {
    const n = Number(raw.replace('#', '').trim());
    if (!isValidTokenId(n)) return toast.bad(`Token ids run from 1 to ${COLLECTION.supply}.`);
    setPreviewId(n);
  };
  const anims: AnimCue['kind'][] = ['tap', 'charge', 'attack', 'hit', 'win', 'levelup'];
  const tryOn = useGame((s) => s.tryOn);
  const setTryOn = useGame((s) => s.setTryOn);
  const setScreen = useGame((s) => s.setScreen);
  useEffect(() => () => setTryOn(null), [setTryOn]);
  const gear = (tryOn ?? (preview ? null : p.gear ?? null)) as Gear;

  return (
    <div className="space-y-4">
            <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); openPreview(previewInput); }}>
        <label htmlFor="preview" className="text-sm font-bold text-dim">Preview any Chog</label>
        <input id="preview" inputMode="numeric" value={previewInput} onChange={(e) => setPreviewInput(e.target.value)} placeholder={`Token id 1–${COLLECTION.supply}`} className="min-h-10 w-40 rounded-xl border border-line bg-panel px-3" />
        <Button size="sm" tone="panel" type="submit">View</Button>
        <Button size="sm" tone="ghost" type="button" onClick={() => setPreviewId(1 + Math.floor(Math.random() * COLLECTION.supply))}>Random</Button>
        {preview && <Button size="sm" tone="gold" type="button" onClick={() => setPreviewId(null)}>Back to mine</Button>}
      </form>
      {preview && <div className="rounded-2xl border border-gold/40 bg-gold/10 px-4 py-2 text-sm">Previewing token #{preview.tokenId}: view only. Stats shown without skills or holdings.</div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <div className="relative h-[440px] overflow-hidden rounded-[32px] border border-line">
            {gl ? (
              <Stage quality={quality} reducedMotion={reduced} className="absolute inset-0" camera={[0, 1.4, 5.4]}>
                <World backdrop="studio" />
                <ChogModel look={look} cue={cue} ascension={preview ? 0 : lo.ascension.ring} gear={gear} />
                <OrbitControls enablePan={false} enableZoom={false} target={[0, 1.15, 0]} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI / 1.9} />
              </Stage>
            ) : (
              <div className="grid h-full place-items-center bg-panel"><ChogSprite look={look} size={280} /></div>
            )}
            <div className="pointer-events-none absolute left-3 top-3 space-y-1.5">
              <div className="font-display text-[1.7rem] font-semibold text-white drop-shadow">{pr.name}{pr.title ? ` “${pr.title}”` : ''}</div>
              <div className="flex flex-wrap gap-1.5">
                <ElementBadge element={pr.element} />
                <span className="rounded-full bg-night/50 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur">{ARCHETYPES[pr.archetype].name}</span>
                {pr.tier && <span className="rounded-full bg-night/50 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur">{pr.tier}</span>}
              </div>
            </div>
            <div className="absolute inset-x-2 bottom-2 flex flex-wrap justify-center gap-1">
              {anims.map((a) => (
                <button key={a} onClick={() => setCue((c) => ({ kind: a, id: c.id + 1 }))} className="min-h-8 rounded-full bg-night/50 px-3 text-xs font-semibold capitalize text-white backdrop-blur">{a}</button>
              ))}
            </div>
          </div>
          {links ? (
            <Panel>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-bold">Rarity rank #{pr.rarityRank} / {COLLECTION.supply}</span>
                <span className="text-dim">· token #{pr.tokenId}</span>
                <div className="ml-auto flex flex-wrap gap-2">
                  <a href={links.opensea} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg bg-panel-2 px-2 py-1 font-bold">OpenSea <ExternalLink size={12} /></a>
                  <a href={links.magicEden} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg bg-panel-2 px-2 py-1 font-bold">Magic Eden <ExternalLink size={12} /></a>
                  <a href={links.explorer} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg bg-panel-2 px-2 py-1 font-bold">Explorer <ExternalLink size={12} /></a>
                </div>
              </div>
              <p className="mt-2 text-xs text-dim">The 3D character is our own art, assembled from this token’s traits. Progress, bots and history are bound to the token id and travel with it if it’s sold.</p>
            </Panel>
          ) : (
            <Panel className="text-sm text-dim">This is the demo Chog. Connect a wallet with a Chog to load its real traits.</Panel>
          )}
        </div>

        <div className="space-y-3">
          <Panel>
            <Title sub="From traits, tier, synergies, skills and holdings (capped at +15%).">Stats</Title>
            <div className="space-y-2.5">
              {(Object.keys(STAT_INFO) as StatKey[]).map((k) => (
                <div key={k}>
                  <div className="flex justify-between text-sm"><span className="font-bold" style={{ color: STAT_INFO[k].color }}>{STAT_INFO[k].label}</span><span className="font-display">{stats[k]}</span></div>
                  <Bar value={stats[k]} max={45} color={STAT_INFO[k].color} height={8} />
                  <div className="mt-0.5 text-[11px] text-dim">{STAT_INFO[k].text}</div>
                </div>
              ))}
            </div>
            {pr.synergies.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {pr.synergies.map((s) => <Pill key={s.id} color="#ff8fc8">✦ {s.name}: {Object.entries(s.bonus).map(([k, v]) => `+${v} ${k}`).join(', ')}</Pill>)}
              </div>
            )}
          </Panel>
          <Panel>
            <Title sub={`Counts are from all ${COLLECTION.supply.toLocaleString()} tokens, read from the collection's metadata.`}>Traits</Title>
            {pr.traits.length === 0 ? <p className="text-sm text-dim">No traits.</p> : (
              <div className="grid grid-cols-2 gap-2">
                {pr.traits.map((t) => {
                  const c = traitCount(t.type, t.value);
                  return (
                    <div key={t.type} className="rounded-xl border border-line bg-panel-2 px-3 py-2">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-dim">{t.type}</div>
                      <div className="truncate font-semibold">{t.value}</div>
                      {!pr.isGuest && <div className="text-[11px] text-dim">{c} have this · {((c / COLLECTION.supply) * 100).toFixed(1)}%</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <Panel>
        <Title eyebrow="Wardrobe" sub="Variant gear dresses your 3D Chog. Tap one to try it on here." right={<Button size="sm" tone="panel" onClick={() => setScreen('chogs')}>All Chogs</Button>}>Gear</Title>
        <div className="scroll-x -mx-1 flex gap-3 px-1 pb-1">
          {VARIANTS.map((v) => {
            const owned = v.id === 'wild' || p.cosmetics.includes(`gear-${v.id}`);
            const on = (p.gear ?? 'wild') === v.id;
            const trying = (tryOn ?? null) === (v.id === 'wild' ? null : v.id) && tryOn !== null;
            return (
              <div key={v.id} className={`relative w-36 shrink-0 overflow-hidden rounded-[22px] ring-2 transition ${trying ? 'ring-chog-3' : on ? 'ring-lime' : 'ring-transparent'}`} style={{ background: v.color, color: v.ink }}>
                <button onClick={() => setTryOn(v.id === 'wild' ? null : tryOn === v.id ? null : v.id)} className="block w-full text-left" aria-label={`Try on ${v.name}`}>
                  <div className="relative h-32"><Img src={art.cut(v.id)} className="absolute bottom-0 left-1/2 h-[112%] w-auto max-w-none -translate-x-1/2 drop-shadow-[0_10px_14px_rgba(0,0,0,0.35)]" /></div>
                  <div className="px-3 pb-1 pt-2 text-sm font-bold leading-tight">{v.name}</div>
                </button>
                <div className="px-3 pb-3">
                  {owned ? (
                    <button onClick={() => { update((cur) => equipGear(cur, v.id === 'wild' ? null : v.id)); setTryOn(null); sfx.buff(); }} className={`mt-1 flex min-h-8 w-full items-center justify-center gap-1 rounded-full text-xs font-semibold ${on ? 'bg-black/25' : 'bg-[#14051f] text-mist'}`}>{on ? <><Check size={12} /> Equipped</> : 'Equip'}</button>
                  ) : (
                    <div className="mt-1 flex min-h-8 items-center justify-center gap-1 rounded-full bg-black/20 text-[11px] font-semibold"><Lock size={11} /> {v.unlock?.track === 'holder' ? 'Holder' : 'Free'} T{v.unlock?.tier}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel>
        <Title sub="Trait cards come from your Chog. Rarer trait values hit harder.">Trait cards</Title>
        <div className="scroll-x -mx-1 flex gap-3 px-1 pb-2">
          {pr.traitCards.map((c) => <CardView key={c.id} def={c} size="lg" />)}
        </div>
      </Panel>

      <Panel>
        <Title sub={`${p.skillPoints} point${p.skillPoints === 1 ? '' : 's'} to spend · 1 per level`} right={<Button size="sm" tone="ghost" onClick={() => { if (update((cur) => respec(cur))) toast.good('Skills reset.'); else toast.bad(`Respec costs ${1000 + p.level * 100} Sparks and needs spent points.`); }}><RotateCcw size={14} /> Respec</Button>}>Skill tree</Title>
        <div className="grid gap-3 md:grid-cols-3">
          {(['attack', 'defense', 'economy'] as Branch[]).map((b) => (
            <div key={b} className="rounded-2xl border border-line bg-panel-2 p-3">
              <div className="mb-2 font-display capitalize" style={{ color: b === 'attack' ? ELEMENT_META.flame.color : b === 'defense' ? ELEMENT_META.moss.color : '#ffd166' }}>{b}</div>
              <div className="space-y-2">
                {SKILL_TREE.filter((n) => n.branch === b).map((n) => {
                  const r = p.skills[n.id] ?? 0;
                  const locked = !!n.requires && !(p.skills[n.requires] ?? 0);
                  return (
                    <div key={n.id} className={`flex items-center gap-2 rounded-xl bg-panel p-2 ${locked ? 'opacity-50' : ''}`}>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold">{n.name}</div>
                        <div className="text-[11px] text-dim">{n.text}</div>
                        <div className="mt-1 flex gap-1">{Array.from({ length: n.maxRank }, (_, i) => <span key={i} className={`h-1.5 w-4 rounded-full ${i < r ? 'bg-gold' : 'bg-line'}`} />)}</div>
                      </div>
                      <Button size="sm" tone={p.skillPoints > 0 && !locked && r < n.maxRank ? 'gold' : 'panel'} disabled={p.skillPoints <= 0 || locked || r >= n.maxRank} onClick={() => { if (update((cur) => rankSkill(cur, n.id))) sfx.buff(); }} aria-label={`Rank up ${n.name}`}>
                        <Sparkles size={14} />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <Title sub="Each ascension adds a ring to your 3D Chog.">Ascension</Title>
        <div className="scroll-x flex gap-2">
          {ASCENSIONS.map((a) => (
            <div key={a.name} className={`shrink-0 rounded-2xl border px-3 py-2 text-center ${p.level >= a.level ? 'border-gold bg-gold/10' : 'border-line bg-panel-2 opacity-70'}`}>
              <div className="font-display">{a.name}</div>
              <div className="text-xs text-dim">Level {a.level}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
