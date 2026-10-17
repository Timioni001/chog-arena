export type League = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Mythic';

export const LEAGUES: { name: League; min: number; color: string }[] = [
  { name: 'Bronze', min: 0, color: '#c98a5a' },
  { name: 'Silver', min: 1100, color: '#c7d2e0' },
  { name: 'Gold', min: 1300, color: '#ffd166' },
  { name: 'Platinum', min: 1500, color: '#7ef0d8' },
  { name: 'Diamond', min: 1700, color: '#7ab8ff' },
  { name: 'Mythic', min: 1900, color: '#ff7ad9' },
];

export const START_MMR = 1000;

export function leagueFor(mmr: number) {
  let current = LEAGUES[0];
  for (const l of LEAGUES) if (mmr >= l.min) current = l;
  const idx = LEAGUES.indexOf(current);
  const next = LEAGUES[idx + 1];
  const progress = next ? (mmr - current.min) / (next.min - current.min) : 1;
  return { ...current, next: next?.name ?? null, nextAt: next?.min ?? null, progress };
}

/** Elo update. K shrinks as games played rises, so new Chogs place fast and veterans stay stable. */
export function updateMmr(mmr: number, opponentMmr: number, outcome: 1 | 0.5 | 0, gamesPlayed: number): number {
  const k = gamesPlayed < 10 ? 48 : gamesPlayed < 40 ? 32 : 20;
  const expected = 1 / (1 + 10 ** ((opponentMmr - mmr) / 400));
  return Math.max(0, Math.round(mmr + k * (outcome - expected)));
}
