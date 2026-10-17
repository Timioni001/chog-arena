import type { ChogProfile } from '@/game/chog';
import type { Trait } from '@/game/types';
import { ELEMENT_META } from '@/game/elements';

/**
 * Trait → look. Everything here is our own original art direction: the Chog's traits choose parts,
 * colors and props for a procedurally built character. No NFT image is ever used.
 */
export interface Appearance {
  archetype: ChogProfile['archetype'];
  skin: string;
  skinShade: string;
  face: string;
  cheeks: string;
  paws: string;
  metal: boolean;
  multi: boolean;
  skull: boolean;
  glow: string | null;
  bg: [string, string];
  aura: { color: string; kind: 'flame' | 'wind' | 'smoke' | 'glow' | 'electric' } | null;
  head: { kind: HeadKind; color: string; color2: string; text: string | null };
  eyes: { kind: EyeKind; color: string };
  mouth: { kind: MouthKind; color: string };
  body: { kind: BodyKind; color: string; color2: string; text: string | null };
  accessory: AccessoryKind | null;
  facing: 1 | -1;
  title: string | null;
}

export type HeadKind = 'none' | 'cap' | 'bucket' | 'beanie' | 'crown' | 'wizard' | 'helmet' | 'horns' | 'halo' | 'headband' | 'durag' | 'hair' | 'ushanka' | 'clownNose' | 'mask' | 'thirdEye' | 'shroom' | 'fedora' | 'gem';
export type EyeKind = 'normal' | 'happy' | 'laser' | 'visor' | 'shades' | 'vr' | 'heart' | 'dead' | 'cry' | 'tired' | 'angry' | 'side' | 'frog' | 'closed' | 'up';
export type MouthKind = 'smile' | 'sad' | 'flat' | 'o' | 'grin' | 'gum' | 'drool' | 'puke' | 'coin' | 'clown' | 'bite' | 'grit';
export type BodyKind = 'none' | 'suit' | 'hoodie' | 'shirt' | 'jersey' | 'robe' | 'armor' | 'astro' | 'costume' | 'vest' | 'tank' | 'stripes';
export type AccessoryKind = 'frog' | 'candleUp' | 'candleDown' | 'coin' | 'heart' | 'knife' | 'cigar' | 'box';

const COLORS: [RegExp, string][] = [
  [/blood/i, '#b3122e'], [/blaze/i, '#ff6a3d'], [/redd/i, '#e8414b'], [/krown/i, '#f5c542'], [/gold|midas/i, '#f5c542'], [/silver|metal/i, '#c8cfd8'], [/radioactive/i, '#39ff6a'],
  [/light purple|soft lavender|lavender/i, '#c8b6ff'], [/deep purple|supreme purple/i, '#4b1fa8'], [/violet/i, '#8b5cf6'], [/purple|mon\b/i, '#7c4dff'],
  [/light magenta|magenta/i, '#ff5fd2'], [/coral/i, '#ff7f6e'], [/peach/i, '#ffb38a'], [/rose|rosie|rosy/i, '#ff8fb1'], [/pink/i, '#ff8fc8'],
  [/red sky/i, '#ff5a3c'], [/afternoon orange|orange/i, '#ff9a3c'], [/red|fire|fiery|burn/i, '#ff4b4b'],
  [/lemon yellow|bright yellow/i, '#ffe14d'], [/lemon/i, '#fff07a'], [/sunlight|yellow/i, '#ffd34d'],
  [/aqua mint/i, '#7cf5d4'], [/mint/i, '#8ff0c0'], [/lime/i, '#b6f55a'], [/fresh green|green|jade/i, '#4ade80'],
  [/deep aqua/i, '#0fa3b1'], [/aqua blue|aqua/i, '#4ee6f0'], [/cyan/i, '#22d3ee'], [/sky/i, '#8fd3ff'], [/noble blue|royal blue|deep blue/i, '#2f5bea'], [/blue/i, '#3b82f6'],
  [/white|clean|cream/i, '#f4f1ea'], [/beige/i, '#e3cfa6'], [/grey|gray|smoke/i, '#9aa3ad'], [/black|dark/i, '#2a2433'], [/brown|farmer/i, '#8b5a3c'],
  [/wind|cool/i, '#a7e9ff'],
];

export function colorFrom(text: string | null | undefined, fallback: string): string {
  if (!text) return fallback;
  for (const [re, c] of COLORS) if (re.test(text)) return c;
  return fallback;
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + 255 * amt)));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const SKIN: Record<string, string> = {
  Origin: '#7c4dff', Pink: '#ff7ab8', Red: '#e8414b', Black: '#2b2236', Yellow: '#ffc93c', Blue: '#3b82f6', White: '#f2efe9',
  Green: '#3fcf6e', Jade: '#25b38a', 'Multi Colored': '#7c4dff', Purple: '#9b5cff', Beige: '#d9c39a', Metal: '#b8c2cc', Grey: '#8c96a3',
};

/** Short, clean cap prints. Values not listed here get a plain cap. */
const CAP_TEXT: [RegExp, string][] = [
  [/tism/i, 'TISM'], [/^mon (cap|beanie)/i, 'MON'], [/mcga/i, 'MCGA'], [/mmga/i, 'MMGA'], [/wagmi/i, 'WAGMI'], [/10k tps/i, '10K'],
  [/btc/i, '₿'], [/eth/i, 'Ξ'], [/dollar/i, '$'], [/star/i, '★'], [/peace/i, '☮'], [/thunder/i, 'ϟ'], [/cloud/i, '☁'],
  [/choggie|chog cap|mega chog/i, 'CHOG'], [/rh beanie/i, 'RH'], [/8 ball/i, '8'], [/jeet/i, 'JEET'], [/neet/i, 'NEET'],
];

function v(traits: Trait[], type: string): string | null {
  return traits.find((t) => t.type === type)?.value ?? null;
}

function headOf(value: string | null, title: string | null): Appearance['head'] {
  const base = { color: '#ff5a5a', color2: '#ffffff', text: null as string | null };
  if (!value) {
    if (title && /krown|midas/i.test(title)) return { kind: 'crown', color: '#f5c542', color2: '#ff4b9b', text: null };
    if (title && /halo/i.test(title)) return { kind: 'halo', color: '#fff3a8', color2: '#ffffff', text: null };
    return { kind: 'none', ...base };
  }
  const color = colorFrom(value, '#ff5a5a');
  const text = CAP_TEXT.find(([re]) => re.test(value))?.[1] ?? null;
  if (/crown/i.test(value)) return { kind: 'crown', color: '#f5c542', color2: '#ff4b9b', text: null };
  if (/wreath|thorn/i.test(value)) return { kind: 'halo', color: colorFrom(value, '#f5c542'), color2: '#7a5', text: null };
  if (/holy seal/i.test(value)) return { kind: 'halo', color: '#fff3a8', color2: '#ffffff', text: null };
  if (/diamond/i.test(value)) return { kind: 'gem', color: '#9ef0ff', color2: '#ffffff', text: null };
  if (/horn/i.test(value)) return { kind: 'horns', color: colorFrom(value, /void/i.test(value) ? '#3b2a6b' : '#d33'), color2: '#fff', text: null };
  if (/helmet/i.test(value)) return { kind: 'helmet', color: '#d9a441', color2: '#c0392b', text: null };
  if (/wizard hat/i.test(value)) return { kind: 'wizard', color: '#4b2bbd', color2: '#ffd34d', text: null };
  if (/3rd eye|laser/i.test(value)) return { kind: 'thirdEye', color: '#ff5fd2', color2: '#fff', text: null };
  if (/beanie/i.test(value)) return { kind: 'beanie', color: /wizard/i.test(value) ? '#4b2bbd' : color === '#ff5a5a' ? '#2f5bea' : color, color2: '#ffffff', text };
  if (/bucket/i.test(value)) return { kind: 'bucket', color, color2: shade(color, -0.15), text };
  if (/headband|bandana/i.test(value)) return { kind: 'headband', color: /japan/i.test(value) ? '#ffffff' : '#e8414b', color2: '#e8414b', text: null };
  if (/durag|wrap/i.test(value)) return { kind: 'durag', color: color === '#ff5a5a' ? '#1f2937' : color, color2: '#111827', text: null };
  if (/bob hair/i.test(value)) return { kind: 'hair', color: '#3b2416', color2: '#5a3a24', text: null };
  if (/rainbow wig/i.test(value)) return { kind: 'hair', color: '#ff5fd2', color2: '#4ee6f0', text: 'rainbow' };
  if (/russian/i.test(value)) return { kind: 'ushanka', color: '#6b4a32', color2: '#e9dcc6', text: null };
  if (/clown nose/i.test(value)) return { kind: 'clownNose', color: '#ff2d3d', color2: '#fff', text: null };
  if (/robber/i.test(value)) return { kind: 'mask', color: '#151318', color2: '#fff', text: null };
  if (/shroom/i.test(value)) return { kind: 'shroom', color: '#9b2fff', color2: '#ffffff', text: null };
  if (/mafia/i.test(value)) return { kind: 'fedora', color: '#232028', color2: '#b3122e', text: null };
  if (/plumber/i.test(value)) return { kind: 'cap', color: '#e8414b', color2: '#ffffff', text: 'P' };
  if (/banana/i.test(value)) return { kind: 'shroom', color: '#ffd34d', color2: '#8b5a3c', text: null };
  return { kind: 'cap', color: text === 'MON' || text === 'CHOG' ? '#7c4dff' : color, color2: '#ffffff', text };
}

function eyesOf(value: string | null): Appearance['eyes'] {
  const c = colorFrom(value, '#1b1424');
  if (!value) return { kind: 'normal', color: '#1b1424' };
  if (/laser/i.test(value)) return { kind: 'laser', color: colorFrom(value.replace(/laser/i, ''), '#ff3b3b') };
  if (/visor/i.test(value)) return { kind: 'visor', color: /sunset/i.test(value) ? '#ff8a3c' : /plasma/i.test(value) ? '#c04bff' : '#4ee6f0' };
  if (/vr/i.test(value)) return { kind: 'vr', color: /modern/i.test(value) ? '#f4f1ea' : '#2a2433' };
  if (/glass|mog|viper|thug/i.test(value)) return { kind: 'shades', color: /btc/i.test(value) ? '#ff9a3c' : /retro/i.test(value) ? '#ff5fd2' : /anime/i.test(value) ? '#4ee6f0' : '#151318' };
  if (/heart/i.test(value)) return { kind: 'heart', color: '#ff3b7a' };
  if (/dead|xd/i.test(value)) return { kind: 'dead', color: '#1b1424' };
  if (/cry|tear|teary/i.test(value)) return { kind: 'cry', color: '#1b1424' };
  if (/tired/i.test(value)) return { kind: 'tired', color: '#1b1424' };
  if (/angry|vertical/i.test(value)) return { kind: 'angry', color: '#1b1424' };
  if (/side|smirk/i.test(value)) return { kind: 'side', color: c === '#1b1424' ? '#1b1424' : c };
  if (/frog/i.test(value)) return { kind: 'frog', color: '#3fcf6e' };
  if (/flat|retard/i.test(value)) return { kind: 'closed', color: c };
  if (/up/i.test(value)) return { kind: 'up', color: '#1b1424' };
  if (/happy/i.test(value)) return { kind: 'happy', color: c };
  return { kind: 'normal', color: c };
}

function mouthOf(value: string | null): Appearance['mouth'] {
  if (!value) return { kind: 'smile', color: '#5a1830' };
  if (/gum|bubble/i.test(value)) return { kind: 'gum', color: '#ff8fc8' };
  if (/puke|rainbow/i.test(value)) return { kind: 'puke', color: '#ff5fd2' };
  if (/btc coin/i.test(value)) return { kind: 'coin', color: '#ff9a3c' };
  if (/coin/i.test(value)) return { kind: 'coin', color: '#9b7bff' };
  if (/gold tooth/i.test(value)) return { kind: 'grin', color: '#f5c542' };
  if (/grit/i.test(value)) return { kind: 'grit', color: '#ffffff' };
  if (/drool/i.test(value)) return { kind: 'drool', color: '#9fe8ff' };
  if (/clown/i.test(value)) return { kind: 'clown', color: '#ff2d3d' };
  if (/lip/i.test(value)) return { kind: 'bite', color: '#5a1830' };
  if (/sad|worried/i.test(value)) return { kind: 'sad', color: '#5a1830' };
  if (/flat/i.test(value)) return { kind: 'flat', color: '#5a1830' };
  if (/^wo$/i.test(value)) return { kind: 'o', color: '#5a1830' };
  return { kind: 'smile', color: '#5a1830' };
}

function bodyOf(value: string | null): Appearance['body'] {
  if (!value) return { kind: 'none', color: '#000', color2: '#000', text: null };
  const color = colorFrom(value, '#2a2433');
  const two = shade(color, -0.18);
  if (/143 jersey/i.test(value)) return { kind: 'jersey', color, color2: '#ffffff', text: '143' };
  if (/armor/i.test(value)) return { kind: 'armor', color: '#f5c542', color2: '#c8962b', text: null };
  if (/astro|sci fi/i.test(value)) return { kind: 'astro', color: /sci/i.test(value) ? '#c8cfd8' : '#f4f1ea', color2: '#4ee6f0', text: null };
  if (/robe|wizard|jesus|cape/i.test(value)) return { kind: 'robe', color: /kings/i.test(value) ? '#b3122e' : /wizard/i.test(value) ? '#4b2bbd' : '#f4f1ea', color2: '#f5c542', text: null };
  if (/banana|duck|shark|toad|dragon|squid game guard|mummy/i.test(value)) {
    const c = /banana/i.test(value) ? '#ffd34d' : /duck/i.test(value) ? '#ffd34d' : /shark/i.test(value) ? '#8fb6d9' : /dragon/i.test(value) ? '#3fcf6e' : /squid/i.test(value) ? '#ff3b7a' : /mummy/i.test(value) ? '#efe6cf' : color;
    return { kind: 'costume', color: c, color2: shade(c, -0.2), text: null };
  }
  if (/tuxedo|suit|mafia|ceo/i.test(value)) return { kind: 'suit', color: color === '#2a2433' ? '#1d1a24' : color, color2: '#ffffff', text: null };
  if (/hoodie|jacket|trackset/i.test(value)) return { kind: 'hoodie', color: /glitch/i.test(value) ? '#22d3ee' : /electro/i.test(value) ? '#ffe14d' : /mon/i.test(value) ? '#7c4dff' : color, color2: two, text: /mon/i.test(value) ? 'MON' : null };
  if (/vest/i.test(value)) return { kind: 'vest', color: /army/i.test(value) ? '#5b6b3a' : color, color2: '#f4f1ea', text: null };
  if (/tank|sleeveless/i.test(value)) return { kind: 'tank', color, color2: two, text: null };
  if (/stripe|inmate|prisoner|squid game/i.test(value)) return { kind: 'stripes', color: /inmate|prisoner/i.test(value) ? '#ff9a3c' : '#f4f1ea', color2: /squid/i.test(value) ? '#3fcf6e' : '#1d1a24', text: null };
  if (/chinese|yukata|polo|hawaiian/i.test(value)) return { kind: 'robe', color: color === '#2a2433' ? '#ff9a3c' : color, color2: '#f5c542', text: null };
  return { kind: 'shirt', color: color === '#2a2433' && !/black|dark/i.test(value) ? '#f4f1ea' : color, color2: two, text: null };
}

function accessoryOf(value: string | null): AccessoryKind | null {
  if (!value) return null;
  if (/fwog|pepe/i.test(value)) return 'frog';
  if (/green candle/i.test(value)) return 'candleUp';
  if (/red candle/i.test(value)) return 'candleDown';
  if (/coin/i.test(value)) return 'coin';
  if (/heart/i.test(value)) return 'heart';
  if (/knife/i.test(value)) return 'knife';
  if (/cigar/i.test(value)) return 'cigar';
  return 'box';
}

function auraOf(value: string | null, element: ChogProfile['element']): Appearance['aura'] {
  if (!value) return null;
  const kind: NonNullable<Appearance['aura']>['kind'] = /fir|burn/i.test(value) ? 'flame' : /wind|cool/i.test(value) ? 'wind' : /smoke|mist|scent/i.test(value) ? 'smoke' : /electric/i.test(value) ? 'electric' : 'glow';
  return { color: colorFrom(value, ELEMENT_META[element].glow), kind };
}

export function appearanceOf(profile: ChogProfile): Appearance {
  const t = profile.traits;
  const archetype = profile.archetype;
  const skinName = v(t, 'Skin') ?? 'Origin';
  let skin = SKIN[skinName] ?? '#7c4dff';
  let glow: string | null = null;
  const title = profile.title;
  if (archetype === 'Radioactive') glow = '#39ff6a';
  if (archetype === '1:1') {
    skin = colorFrom(title, '#7c4dff');
    if (/grim|skully/i.test(title ?? '')) skin = '#2b2236';
    if (/frogger/i.test(title ?? '')) skin = '#3fcf6e';
    if (/chogbomination/i.test(title ?? '')) skin = '#5b6b3a';
    if (/scream/i.test(title ?? '')) skin = '#f2efe9';
    glow = '#ffd166';
  }
  const bgName = v(t, 'Background');
  const bg1 = colorFrom(bgName, archetype === '1:1' ? '#ffd166' : '#b9a6ff');
  const aura = auraOf(v(t, 'Aura'), profile.element) ?? (archetype === '1:1' ? { color: '#ffd166', kind: 'glow' as const } : null);
  return {
    archetype,
    skin,
    skinShade: shade(skin, -0.16),
    face: archetype === 'Skull' ? '#f4f1ea' : '#fff1d6',
    cheeks: '#ff8fc8',
    paws: archetype === 'Skull' ? '#e8e2d0' : '#ff8fc8',
    metal: skinName === 'Metal',
    multi: skinName === 'Multi Colored',
    skull: archetype === 'Skull' || /skully|grim/i.test(title ?? ''),
    glow,
    bg: [bg1, shade(bg1, -0.25)],
    aura,
    head: headOf(v(t, 'Head'), title),
    eyes: eyesOf(v(t, 'Eyes')),
    mouth: mouthOf(v(t, 'Mouth')),
    body: bodyOf(v(t, 'Body')),
    accessory: accessoryOf(v(t, 'Accessory')),
    facing: v(t, 'Side') === 'Left' ? -1 : 1,
    title,
  };
}
