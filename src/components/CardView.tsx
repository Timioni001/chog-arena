'use client';

import { memo } from 'react';
import { abilityText, type CardDef } from '@/game/cards';
import { ELEMENT_META } from '@/game/elements';

const GLYPHS: Record<string, string> = {
  crown: '👑', horn: '🐂', helmet: '🛡️', wizard: '🧙', eye: '👁️', beanie: '🧶', band: '🎌', hair: '💇', honk: '🤡', sneak: '🥷', cap: '🧢', bonk: '💥',
  laser: '🔴', visor: '🥽', shades: '🕶️', heart: '💖', tear: '💧', blank: '😶', side: '👀', frog: '🐸', eyes: '✨',
  bubble: '🫧', rainbow: '🌈', coin: '🪙', grin: '😁', drool: '🤤', sad: '🥺', smile: '😊', chomp: '😬',
  armor: '🦾', aura: '🌟', tux: '🤵', hood: '🧥', jersey: '🎽', costume: '🎭', street: '🧢', shirt: '👕', bristle: '🦔',
  candleUp: '📈', candleDown: '📉', edge: '🗡️', smoke: '💨', stash: '🎁', glow: '🔆', burst: '💫', turf: '🏝️',
  skull: '💀', atom: '☢️', star: '⭐', spikes: '🦔', pebble: '🪨', dash: '💨', huddle: '🫂', roll: '🌀', nap: '😴', stomp: '🦶',
  drone: '🛸', mite: '🔥', orb: '🔮', crab: '🦀', kite: '🪁', golem: '🗿', flame: '🔥', drop: '💧', leaf: '🍃', ufo: '🛸',
};

export const CardView = memo(function CardView({
  def,
  power,
  crit,
  faceDown,
  size = 'md',
  selected,
  dim,
  delta,
  onClick,
  label,
}: {
  def: CardDef;
  power?: number;
  crit?: boolean;
  faceDown?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  selected?: boolean;
  dim?: boolean;
  delta?: number;
  onClick?: () => void;
  label?: string;
}) {
  const el = ELEMENT_META[def.element];
  const dims = size === 'lg' ? 'w-40 h-56' : size === 'md' ? 'w-[5.4rem] h-[7.6rem]' : size === 'sm' ? 'w-[3.9rem] h-[5.3rem]' : 'w-[3.3rem] h-[4.5rem]';
  const shown = power ?? def.power;
  const buffed = power !== undefined && power !== def.power;
  const Tag = onClick ? 'button' : 'div';
  if (faceDown) {
    return (
      <div className={`${dims} relative shrink-0 overflow-hidden rounded-xl border-2 border-[#3a2b6b] bg-[radial-gradient(circle_at_50%_40%,#5b3fd0,#1d1440)] shadow-lg`} aria-label="Hidden card">
        <div className="absolute inset-0 grid place-items-center text-2xl opacity-80">🦔</div>
      </div>
    );
  }
  const desc = abilityText(def.ability);
  return (
    <Tag
      onClick={onClick}
      aria-label={label ?? `${def.name}, cost ${def.cost}, power ${shown}. ${desc}`}
      aria-pressed={onClick ? !!selected : undefined}
      className={`${dims} group relative shrink-0 overflow-hidden rounded-xl border-2 text-left shadow-lg transition ${selected ? '-translate-y-3 ring-4 ring-gold' : ''} ${dim ? 'opacity-50 saturate-50' : ''} ${onClick ? 'cursor-pointer active:scale-95' : ''}`}
      style={{ borderColor: el.color, background: `linear-gradient(160deg, color-mix(in srgb, ${el.color} 55%, #1a1230) 0%, #1a1230 70%)` }}
    >
      <div className="absolute inset-x-0 top-[14%] grid place-items-center" aria-hidden>
        <div className="grid aspect-square w-[62%] place-items-center rounded-full" style={{ background: `radial-gradient(circle, ${el.glow}66, transparent 70%)` }}>
          <span className={size === 'lg' ? 'text-5xl' : size === 'md' ? 'text-3xl' : size === 'sm' ? 'text-xl' : 'text-lg'}>{GLYPHS[def.glyph] ?? '✦'}</span>
        </div>
      </div>
      <span className={`absolute left-1 top-1 grid place-items-center rounded-full bg-[#2fc6ff] font-pixel text-white shadow ring-2 ring-black/30 ${size === 'xs' ? 'size-4 text-[9px]' : 'size-6 text-xs'}`}>{def.cost}</span>
      <span className={`absolute right-1 top-1 grid place-items-center rounded-full font-pixel shadow ring-2 ring-black/30 ${size === 'xs' ? 'size-5 text-[11px]' : 'size-6 text-xs'} ${crit ? 'bg-gold text-[#2a1a00]' : buffed ? (shown > def.power ? 'bg-lime text-[#05210c]' : 'bg-danger text-white') : 'bg-[#ff8a3c] text-white'}`}>{shown}</span>
      {size !== 'xs' && (
        <div className="absolute inset-x-0 bottom-0 bg-black/45 px-1.5 pb-1 pt-0.5 backdrop-blur-[2px]">
          <div className={`truncate font-extrabold leading-tight text-white ${size === 'lg' ? 'text-base' : 'text-[10px]'}`}>{def.name}</div>
          {size === 'lg' && <div className="mt-0.5 text-xs leading-snug text-white/85">{desc || def.text}</div>}
          {size === 'lg' && def.origin && <div className="mt-1 truncate text-[10px] text-white/60">{def.origin}</div>}
          {size === 'md' && desc && <div className="line-clamp-2 text-[8.5px] leading-tight text-white/80">{desc}</div>}
        </div>
      )}
      {crit && <div className="pointer-events-none absolute inset-0 animate-pulse rounded-xl ring-4 ring-gold/70" />}
      {delta ? <div className="pointer-events-none absolute left-1/2 top-1/3 animate-float-up font-pixel text-lg drop-shadow" style={{ color: delta > 0 ? '#39ff6a' : '#ff5a6e' }}>{delta > 0 ? `+${delta}` : delta}</div> : null}
    </Tag>
  );
});

export function glyphFor(key: string) {
  return GLYPHS[key] ?? '✦';
}
