import type { LaneKind } from './battle';
import type { AiLevel } from './ai';
import type { Element } from './types';

export interface Stage {
  id: string;
  name: string;
  lanes: LaneKind[];
  enemy: { name: string; element: Element; level: AiLevel; deckBias: Element; power: number; boss?: boolean };
  reward: { sparks: number; xp: number };
}

export interface Zone {
  id: string;
  name: string;
  tagline: string;
  sky: [string, string];
  accent: string;
  requiresHolder?: boolean;
  stages: Stage[];
}

const stage = (zone: string, n: number, name: string, lanes: LaneKind[], enemy: Stage['enemy'], sparks: number): Stage => ({
  id: `${zone}-${n}`,
  name,
  lanes,
  enemy,
  reward: { sparks, xp: Math.round(sparks / 5) },
});

export const ZONES: Zone[] = [
  {
    id: 'cloud', name: 'Cloud Isles', tagline: 'Sunny skies, soft landings.', sky: ['#9ed8ff', '#f6e8ff'], accent: '#7ec8ff',
    stages: [
      stage('cloud', 1, 'Fluff Hop', ['open', 'open', 'tidepool'], { name: 'Puffball', element: 'tide', level: 'rookie', deckBias: 'tide', power: 0 }, 300),
      stage('cloud', 2, 'Rainbow Ramp', ['open', 'static', 'tidepool'], { name: 'Drizzle Duo', element: 'tide', level: 'rookie', deckBias: 'tide', power: 1 }, 400),
      stage('cloud', 3, 'Kite Summit', ['narrow', 'open', 'static'], { name: 'Captain Gust', element: 'tide', level: 'adept', deckBias: 'tide', power: 2, boss: true }, 700),
    ],
  },
  {
    id: 'grove', name: 'Moss Hollow', tagline: 'The forest bites back.', sky: ['#1f5a3a', '#a6f0a0'], accent: '#5ee36a',
    stages: [
      stage('grove', 1, 'Mushroom Ring', ['grove', 'open', 'sanctuary'], { name: 'Spore Kid', element: 'moss', level: 'rookie', deckBias: 'moss', power: 1 }, 450),
      stage('grove', 2, 'Root Maze', ['grove', 'narrow', 'grove'], { name: 'Bramble Pack', element: 'moss', level: 'adept', deckBias: 'moss', power: 2 }, 600),
      stage('grove', 3, 'Elder Stump', ['grove', 'gravity', 'open'], { name: 'Old Bark', element: 'moss', level: 'adept', deckBias: 'moss', power: 3, boss: true }, 900),
    ],
  },
  {
    id: 'neon', name: 'Neon Alley', tagline: 'Teal lights, loud bots.', sky: ['#04232b', '#14e0c8'], accent: '#14e0c8',
    stages: [
      stage('neon', 1, 'Arcade Door', ['static', 'open', 'tidepool'], { name: 'Glitch Gang', element: 'void', level: 'adept', deckBias: 'void', power: 2 }, 600),
      stage('neon', 2, 'Rooftop Chase', ['narrow', 'static', 'open'], { name: 'Drone Swarm', element: 'tide', level: 'adept', deckBias: 'tide', power: 3 }, 800),
      stage('neon', 3, 'Server Room', ['gravity', 'static', 'sanctuary'], { name: 'MegaByte', element: 'void', level: 'master', deckBias: 'void', power: 4, boss: true }, 1200),
    ],
  },
  {
    id: 'ember', name: 'Ember Rift', tagline: 'Lightning, lava, and a lot of noise.', sky: ['#2a0710', '#ff7a3d'], accent: '#ff7a3d',
    stages: [
      stage('ember', 1, 'Ash Steps', ['ember', 'open', 'gravity'], { name: 'Cinder Imps', element: 'flame', level: 'adept', deckBias: 'flame', power: 3 }, 800),
      stage('ember', 2, 'Bolt Bridge', ['ember', 'narrow', 'static'], { name: 'Storm Brute', element: 'flame', level: 'master', deckBias: 'flame', power: 4 }, 1000),
      stage('ember', 3, 'Horde Gate', ['ember', 'gravity', 'ember'], { name: 'The Green Bull Horde', element: 'flame', level: 'master', deckBias: 'flame', power: 5, boss: true }, 1600),
    ],
  },
  {
    id: 'void', name: 'Abduction Belt', tagline: 'Holders only. Look up. Way up.', sky: ['#0b0630', '#39ff6a'], accent: '#39ff6a', requiresHolder: true,
    stages: [
      stage('void', 1, 'Tractor Beam', ['static', 'sanctuary', 'open'], { name: 'Saucer Scouts', element: 'void', level: 'master', deckBias: 'void', power: 5 }, 1500),
      stage('void', 2, 'Hull Breach', ['gravity', 'narrow', 'static'], { name: 'Probe Unit 9', element: 'void', level: 'master', deckBias: 'void', power: 6 }, 1800),
      stage('void', 3, 'Mothership', ['gravity', 'static', 'gravity'], { name: 'The Collector', element: 'void', level: 'master', deckBias: 'void', power: 7, boss: true }, 2600),
    ],
  },
];

export function findStage(id: string): { zone: Zone; stage: Stage } | null {
  for (const zone of ZONES) {
    const stage = zone.stages.find((s) => s.id === id);
    if (stage) return { zone, stage };
  }
  return null;
}
