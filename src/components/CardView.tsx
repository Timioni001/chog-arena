'use client';

import { memo } from 'react';
import { abilityText, type CardDef } from '@/game/cards';
import { ELEMENT_META } from '@/game/elements';
import { BOT_SPECIES } from '@/game/bots';
import { cardArt } from '@/lib/art';
import { BotSprite } from './BotSprite';

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
  const dims = size === 'lg' ? 'w-44 h-[15.5rem]' : size === 'md' ? 'w-[5.6rem] h-[7.9rem]' : size === 'sm' ? 'w-[4rem] h-[5.5rem]' : 'w-[3.3rem] h-[4.5rem]';
  const shown = power ?? def.power;
  const buffed = power !== undefined && power !== def.power;
  const Tag = onClick ? 'button' : 'div';
  const radius = size === 'xs' || size === 'sm' ? 'rounded-[14px]' : 'rounded-[18px]';
  if (faceDown) {
    return (
      <div className={`${dims} ${radius} relative shrink-0 overflow-hidden border border-white/15 bg-[radial-gradient(circle_at_50%_35%,#7d52e6,#2a1450_75%)] shadow-lg`} aria-label="Hidden card">
        <svg viewBox="0 0 40 40" className="absolute inset-0 m-auto w-1/2 opacity-70" aria-hidden>
          <path d="M20 4l3 7 7-3-2 7 7 2-6 4 6 4-7 2 2 7-7-3-3 7-3-7-7 3 2-7-7-2 6-4-6-4 7-2-2-7 7 3z" fill="#cdb9ff" />
        </svg>
      </div>
    );
  }
  const desc = abilityText(def.ability);
  const art = cardArt(def);
  const badge = size === 'xs' ? 'size-[1.15rem] text-[10px]' : size === 'sm' ? 'size-5 text-[11px]' : 'size-6 text-xs';
  return (
    <Tag
      onClick={onClick}
      aria-label={label ?? `${def.name}, cost ${def.cost}, power ${shown}. ${desc}`}
      aria-pressed={onClick ? !!selected : undefined}
      className={`${dims} ${radius} group relative shrink-0 overflow-hidden text-left shadow-[0_10px_24px_-12px_rgba(10,4,30,0.9)] transition ${selected ? '-translate-y-3 ring-2 ring-gold ring-offset-2 ring-offset-[#120b24]' : ''} ${dim ? 'opacity-45 saturate-50' : ''} ${onClick ? 'cursor-pointer active:scale-95' : ''}`}
      style={{ background: `linear-gradient(170deg, color-mix(in srgb, ${el.color} 38%, #f6ead8) 0%, color-mix(in srgb, ${el.color} 30%, #2a1450) 100%)`, boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${el.color} 70%, white)` }}
    >
      <div className="absolute inset-x-0 top-0 h-[64%] overflow-hidden" aria-hidden>
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} alt="" className="size-full object-cover object-[50%_35%]" loading="lazy" draggable={false} />
        ) : def.source === 'bot' && BOT_BY_CARD[def.name] ? (
          <div className="grid size-full place-items-center bg-white/25"><BotSprite species={BOT_BY_CARD[def.name]} size={size === 'lg' ? 110 : size === 'md' ? 64 : size === 'sm' ? 46 : 36} /></div>
        ) : (
          <div className="grid size-full place-items-center" style={{ background: `radial-gradient(circle, ${el.glow}aa, transparent 75%)` }}>
            <span className={size === 'lg' ? 'text-5xl' : size === 'md' ? 'text-3xl' : 'text-xl'}>{GLYPHS[def.glyph] ?? '✦'}</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent" />
      </div>
      <span className={`absolute left-1 top-1 grid place-items-center rounded-full bg-night/80 font-semibold text-cyan ring-1 ring-cyan/60 backdrop-blur ${badge}`}>{def.cost}</span>
      <span className={`absolute right-1 top-1 grid place-items-center rounded-full font-semibold shadow ring-1 ring-black/10 ${badge} ${crit ? 'bg-gold text-[#3a2400]' : buffed ? (shown > def.power ? 'bg-lime text-[#05271a]' : 'bg-danger text-white') : 'bg-cream text-royal'}`}>{shown}</span>
      {size !== 'xs' && (
        <span className="absolute left-1.5 top-[54%] text-[11px] drop-shadow" aria-hidden>{size === 'sm' ? el.icon : GLYPHS[def.glyph] ?? el.icon}</span>
      )}
      {size !== 'xs' && (
        <div className="absolute inset-x-0 bottom-0 h-[36%] px-1.5 pt-1 text-white">
          <div className={`truncate font-display font-semibold leading-tight ${size === 'lg' ? 'text-lg' : size === 'md' ? 'text-[12px]' : 'text-[10px]'}`}>{def.name}</div>
          {size === 'lg' && <div className="mt-0.5 text-[12px] leading-snug text-white/85">{desc || def.text}</div>}
          {size === 'lg' && def.origin && <div className="mt-1 truncate text-[10px] text-white/60">{def.origin}</div>}
          {size === 'md' && <div className="line-clamp-2 text-[8.5px] leading-tight text-white/80">{desc || def.text}</div>}
        </div>
      )}
      {crit && <div className="pointer-events-none absolute inset-0 animate-pulse rounded-[inherit] ring-2 ring-gold" />}
      {delta ? <div className="pointer-events-none absolute left-1/2 top-1/3 animate-float-up font-display text-lg font-semibold drop-shadow" style={{ color: delta > 0 ? '#4be3a6' : '#ff5f7e' }}>{delta > 0 ? `+${delta}` : delta}</div> : null}
    </Tag>
  );
});

const BOT_BY_CARD: Record<string, (typeof BOT_SPECIES)[number]> = Object.fromEntries(BOT_SPECIES.map((b) => [b.card.name, b]));

export function glyphFor(key: string) {
  return GLYPHS[key] ?? '✦';
}
