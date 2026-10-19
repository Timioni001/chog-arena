import type { Ability, CardDef } from '@/game/cards';
import { FREE_GEAR, HOLDER_GEAR } from '@/game/season';

/**
 * Original character art supplied by the project owner (see ASSETS.md).
 * Every image is cut from the owner's sheets and upscaled 4x with Real-ESRGAN, then
 * downsampled, so it is never shown larger than its pixels.
 */
export type VariantId = 'wild' | 'forest' | 'desert' | 'crystal' | 'cyber' | 'ice' | 'ocean' | 'runner' | 'hoodie' | 'space';

export interface Variant {
  id: VariantId;
  no: number;
  name: string;
  /** Short role line under the name, as on the profile cards. */
  role: string;
  tagline: string;
  blurb: string;
  traits: string[];
  /** Card colour, text colour on it, and an accent. */
  color: string;
  ink: string;
  accent: string;
  story: { title: string; frames: [string, string][] };
  emotes: string[];
  unlock: { track: 'free' | 'holder'; tier: number } | null;
}

export const art = {
  hero: (id: VariantId) => `/art/hero-${id}.webp`,
  cut: (id: VariantId) => `/art/cut-${id}.webp`,
  story: (id: VariantId, n: number) => `/art/story-${id}-${n}.webp`,
  /** Square-ish cover for browse tiles: wide storyboard strips fall back to the hero. */
  tile: (id: VariantId) => (id === 'hoodie' || id === 'space' ? `/art/hero-${id}.webp` : `/art/story-${id}-1.webp`),
  emote: (id: VariantId, name: string) => `/art/emote-${id}-${name}.webp`,
};

function unlockFor(id: VariantId): Variant['unlock'] {
  for (const [t, [g]] of Object.entries(FREE_GEAR)) if (g === id) return { track: 'free', tier: Number(t) };
  for (const [t, [g]] of Object.entries(HOLDER_GEAR)) if (g === id) return { track: 'holder', tier: Number(t) };
  return null;
}

const V = (v: Omit<Variant, 'unlock'>): Variant => ({ ...v, unlock: unlockFor(v.id) });

export const VARIANTS: Variant[] = [
  V({
    id: 'wild', no: 1, name: 'Wild Chog', role: 'the original', tagline: 'Playful, brave, and full of wonder.',
    blurb: 'A curious, energetic creature that roams wildlands, drawn to mysterious sights and shining things.',
    traits: ['Curious', 'Playful', 'Brave'], color: '#7B3FC0', ink: '#F5EBFA', accent: '#FF5FA2',
    story: { title: 'A curious encounter', frames: [['Emerges', 'Spots something unusual in the grass.'], ['Sniffs', 'Curious about the glowing orb.'], ['Senses', 'Movement nearby. Ears up.'], ['Dashes', 'Forward, full of energy.'], ['Rests', 'Content and happy after the chase.']] },
    emotes: ['default', 'happy', 'surprised', 'determined', 'relaxed'],
  }),
  V({
    id: 'forest', no: 2, name: 'Forest Ranger', role: 'small steps, big wilderness', tagline: 'New trails make brighter days.',
    blurb: 'Roams the forests and protects its little corner of the world, finding wonder in every leaf, light ray and hidden path.',
    traits: ['Curious', 'Adventurous', 'Kind-hearted'], color: '#3E6A3A', ink: '#F5EBFA', accent: '#FFC861',
    story: { title: 'A forest adventure', frames: [['Spots a trail', 'Mysterious tracks in the soft ground.'], ['Investigates', 'Glowing mushrooms and something unusual.'], ['Climbs forward', 'Bravely scales a fallen log.'], ['Finds a ruin', 'Ancient, overgrown, full of wonder.'], ['Rests at sunset', 'Happy and fulfilled.']] },
    emotes: ['happy', 'determined', 'surprised', 'relaxed'],
  }),
  V({
    id: 'desert', no: 3, name: 'Desert Nomad', role: 'new lands, same spirit', tagline: 'Follows winds, wonders and forgotten places.',
    blurb: 'A wandering Chog who is curious, resilient and always in search of new horizons across the dunes.',
    traits: ['Adventurous', 'Resourceful', 'Resilient'], color: '#E3A25A', ink: '#2A1206', accent: '#7A2E0E',
    story: { title: 'A journey through the sands', frames: [['Crossing the dunes', 'Driven by curiosity.'], ['Finds a trail', 'Mysterious tracks in the sand.'], ['Uncovers an artifact', 'A hidden relic from the past.'], ['Escapes a sand gust', 'Hunkers down against the wind.'], ['Watches the sunset', 'Resting on a cliff, a new horizon.']] },
    emotes: ['happy', 'curious', 'determined', 'playful'],
  }),
  V({
    id: 'crystal', no: 4, name: 'Crystal Mage', role: 'small creature, vast magic', tagline: 'Brighter worlds ahead.',
    blurb: 'A mystical Chog who communes with the energy of the world’s crystals and protects the balance of light.',
    traits: ['Mystical', 'Powerful', 'Adaptable'], color: '#D1C4E9', ink: '#24083F', accent: '#5A0FAF',
    story: { title: 'A moment of crystal magic', frames: [['Senses energy', 'Attuned to the crystals’ whispers.'], ['Summons an orb', 'Crystals gather into light.'], ['Opens a portal', 'New worlds unfold.'], ['Shields', 'A barrier of crystal energy.'], ['Spell complete', 'Mission complete. Chog beams.']] },
    emotes: ['default', 'happy', 'determined', 'curious'],
  }),
  V({
    id: 'cyber', no: 5, name: 'Cyber Ninja', role: 'small steps, big missions', tagline: 'Quiet but fearless.',
    blurb: 'Moves through shadows and neon lights, combining agility, curiosity and cutting-edge tech.',
    traits: ['Stealthy', 'Agile', 'Tech-savvy'], color: '#17121F', ink: '#F5EBFA', accent: '#FF4FD8',
    story: { title: 'A night operation', frames: [['Rooftop lookout', 'Surveys the target and scans the city.'], ['Stealth', 'Moves silently through the shadows.'], ['Hacks the terminal', 'Quick, clever and focused.'], ['Evades detection', 'Always one step ahead.'], ['Mission success', 'Another mystery a little brighter.']] },
    emotes: ['default', 'focused', 'happy', 'surprised'],
  }),
  V({
    id: 'ice', no: 6, name: 'Ice Guardian', role: 'a big heart in the cold', tagline: 'Cold places need warm hearts too.',
    blurb: 'Roams frozen peaks and crystal valleys, using the power of ice to shield others and bring warmth to the harshest places.',
    traits: ['Protective', 'Brave', 'Calm'], color: '#9CC3FF', ink: '#0B1A3F', accent: '#2C4EA0',
    story: { title: 'A guardian’s journey', frames: [['Through the snow', 'Tracks a signal across the peaks.'], ['Against the storm', 'Stands strong in the blizzard.'], ['Ice barrier', 'Channels ancient ice.'], ['Rescues a friend', 'Finds and saves a lost little one.'], ['A brighter tomorrow', 'New adventures under the aurora.']] },
    emotes: ['happy', 'determined', 'joyful', 'surprised'],
  }),
  V({
    id: 'ocean', no: 7, name: 'Ocean Diver', role: 'deep places, bright finds', tagline: 'Braves the depths for lost treasures.',
    blurb: 'Equipped with a compact diving suit and a curious spirit, befriending the mysterious life beneath the waves.',
    traits: ['Curious', 'Explorative', 'Brave'], color: '#1596B8', ink: '#F5EBFA', accent: '#FFD6F0',
    story: { title: 'A journey beneath the waves', frames: [['Dive in', 'Ready for a new adventure.'], ['The cavern', 'A pearl glowing with mysterious light.'], ['Chase the glow', 'Follows a bioluminescent fish.'], ['Scan the relic', 'An ancient artifact, decoded.'], ['Surface happy', 'Back with a special treasure.']] },
    emotes: ['happy', 'curious', 'determined', 'surprised'],
  }),
  V({
    id: 'runner', no: 8, name: 'Speed Runner', role: 'fast feet, bright places', tagline: 'Goggles on, scarf in the wind.',
    blurb: 'A free-spirited Chog who lives for speed, exploration and new horizons. Every path is an adventure.',
    traits: ['Fast', 'Fearless', 'Free'], color: '#FF6B4A', ink: '#2A0A04', accent: '#FFE08A',
    story: { title: 'A short run', frames: [['At the start', 'Focused and ready.'], ['Burst into a dash', 'Speed takes over.'], ['Leap', 'Light, agile, fearless.'], ['Slide under debris', 'Quick thinking, no limits.'], ['Reach the finish', 'Another adventure complete.']] },
    emotes: ['happy', 'determined', 'cheeky', 'surprised'],
  }),
  V({
    id: 'hoodie', no: 9, name: 'Cozy Hoodie', role: 'soft, sweet, a little magic', tagline: 'A brighter world awaits.',
    blurb: 'Signature pink bow, a heart charm and tiny wings. Playful charm brings magic to life.',
    traits: ['Playful', 'Charming', 'Gentle'], color: '#FF9FCF', ink: '#3A0626', accent: '#6E3482',
    story: { title: 'Peek, cast, arrive', frames: [['Peek', 'Curious eyes spot something shining.'], ['Discover', 'A mysterious orb floats in the air.'], ['Cast', 'A playful charm brings magic to life.'], ['Jump', 'Through a portal to new adventures.'], ['Arrive', 'A brighter world awaits.']] },
    emotes: [],
  }),
  V({
    id: 'space', no: 10, name: 'Space Explorer', role: 'a bigger universe', tagline: 'A small Chog. A bigger universe.',
    blurb: 'A curious little Chog who explores new worlds with bravery and joy.',
    traits: ['Explorer', 'Bold', 'Joyful'], color: '#26246B', ink: '#F5EBFA', accent: '#63F0FF',
    story: { title: 'A small Chog, a bigger universe', frames: [['Gearing up', 'Ready for a new mission.'], ['Beam lift', 'Steps into the launch beam.'], ['Zero gravity', 'Explores freely among asteroids.'], ['Scanning', 'An ancient artifact, analysed.'], ['Touchdown', 'A new moon, ready for more.']] },
    emotes: [],
  }),
];

export const variantById = (id: string | null | undefined): Variant => VARIANTS.find((v) => v.id === id) ?? VARIANTS[0];
/** A face for avatar rails: first emote if the sheet has expressions, else the cutout. */
export const faceOf = (v: Variant): string => (v.emotes.length ? art.emote(v.id, v.emotes[0]) : art.cut(v.id));

export type Emote = 'default' | 'happy' | 'surprised' | 'determined' | 'relaxed';
export const emoteSrc = (id: Emote) => art.emote('wild', id);
export const EMOTES: { id: Emote; label: string; src: string }[] = [
  { id: 'happy', label: 'Yay!', src: emoteSrc('happy') },
  { id: 'determined', label: 'Bring it.', src: emoteSrc('determined') },
  { id: 'surprised', label: 'Whoa!', src: emoteSrc('surprised') },
  { id: 'relaxed', label: 'GG', src: emoteSrc('relaxed') },
  { id: 'default', label: 'Hi!', src: emoteSrc('default') },
];

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

export const ZONE_ART: Record<string, string> = {
  cloud: art.hero('crystal'),
  grove: art.hero('forest'),
  neon: art.hero('cyber'),
  ember: art.hero('desert'),
  void: art.hero('space'),
};
