import type { Ability, CardDef } from '@/game/cards';

/** Original character art supplied by the project owner (see ASSETS.md). */
export const ART = {
  heroWild: '/art/hero-wild.webp',
  heroSpace: '/art/hero-space.webp',
  heroHoodie: '/art/hero-hoodie.webp',
  heroRunner: '/art/hero-runner.webp',
  avatar: '/art/avatar-wild.webp',
  turnFront: '/art/turn-front.webp',
  poses: { wild: '/art/pose-wild.webp', hoodie: '/art/pose-hoodie.webp', space: '/art/pose-space.webp', runner: '/art/pose-runner.webp' },
  story: (set: 'wild' | 'space' | 'hoodie' | 'runner', n: 1 | 2 | 3 | 4 | 5) => `/art/story-${set}-${n}.webp`,
} as const;

export type Emote = 'default' | 'happy' | 'surprised' | 'determined' | 'relaxed';
export const EMOTES: { id: Emote; label: string; src: string }[] = [
  { id: 'happy', label: 'Yay!', src: '/art/emote-happy.webp' },
  { id: 'determined', label: 'Bring it.', src: '/art/emote-determined.webp' },
  { id: 'surprised', label: 'Whoa!', src: '/art/emote-surprised.webp' },
  { id: 'relaxed', label: 'GG', src: '/art/emote-relaxed.webp' },
  { id: 'default', label: 'Hi!', src: '/art/emote-default.webp' },
];
export const emoteSrc = (id: Emote) => `/art/emote-${id}.webp`;

/** Picks a card portrait by what the card does. */
export function cardEmote(ability: Ability): Emote {
  switch (ability.kind) {
    case 'rally':
    case 'swarm':
      return 'happy';
    case 'lucky':
    case 'echo':
      return 'surprised';
    case 'charge':
      return 'relaxed';
    case 'ward':
    case 'lone':
      return 'default';
    default:
      return 'determined';
  }
}

export function cardArt(def: CardDef): string | null {
  if (def.source === 'bot' || def.id.startsWith('en-')) return null;
  return emoteSrc(cardEmote(def.ability));
}

export type GearId = 'runner' | 'hoodie' | 'space';
export const GEAR: { id: GearId; name: string; tagline: string; art: string; hero: string; unlock: { track: 'free' | 'holder'; tier: number } }[] = [
  { id: 'runner', name: 'Speed Runner', tagline: 'Goggles on, scarf in the wind.', art: ART.poses.runner, hero: ART.heroRunner, unlock: { track: 'free', tier: 3 } },
  { id: 'hoodie', name: 'Cozy Hoodie', tagline: 'Soft fabric, signature bow, tiny wings.', art: ART.poses.hoodie, hero: ART.heroHoodie, unlock: { track: 'holder', tier: 5 } },
  { id: 'space', name: 'Space Explorer', tagline: 'A small Chog. A bigger universe.', art: ART.poses.space, hero: ART.heroSpace, unlock: { track: 'holder', tier: 10 } },
];

export const ZONE_ART: Record<string, string> = {
  cloud: ART.story('hoodie', 4),
  grove: ART.story('wild', 1),
  neon: ART.story('space', 1),
  ember: ART.story('runner', 2),
  void: ART.story('space', 3),
};
