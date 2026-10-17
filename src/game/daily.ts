import { createRng } from './rng';

export function dayKey(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function weekKey(now: number = Date.now()): string {
  const d = new Date(now);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

// ------------------------------------------------------------------ quests

export type QuestKind = 'taps' | 'battles' | 'wins' | 'merge' | 'campaign' | 'combo' | 'sparks' | 'elementWin';

export interface QuestDef {
  id: string;
  kind: QuestKind;
  title: string;
  goal: number;
  reward: { sparks: number; xp: number; passXp: number };
}

const QUEST_POOL: QuestDef[] = [
  { id: 'tap500', kind: 'taps', title: 'Tap 500 times', goal: 500, reward: { sparks: 400, xp: 60, passXp: 40 } },
  { id: 'tap1500', kind: 'taps', title: 'Tap 1,500 times', goal: 1500, reward: { sparks: 1000, xp: 120, passXp: 60 } },
  { id: 'battle3', kind: 'battles', title: 'Play 3 battles', goal: 3, reward: { sparks: 500, xp: 90, passXp: 60 } },
  { id: 'win2', kind: 'wins', title: 'Win 2 battles', goal: 2, reward: { sparks: 700, xp: 120, passXp: 80 } },
  { id: 'merge1', kind: 'merge', title: 'Merge a bot', goal: 1, reward: { sparks: 300, xp: 50, passXp: 40 } },
  { id: 'camp1', kind: 'campaign', title: 'Clear a campaign stage', goal: 1, reward: { sparks: 450, xp: 80, passXp: 50 } },
  { id: 'spark5k', kind: 'sparks', title: 'Earn 5,000 Sparks', goal: 5000, reward: { sparks: 600, xp: 80, passXp: 50 } },
  { id: 'elem1', kind: 'elementWin', title: 'Win a lane with an element edge', goal: 1, reward: { sparks: 350, xp: 60, passXp: 40 } },
];

/** Three quests a day, same for everyone, rotated by date. */
export function dailyQuests(day: string): QuestDef[] {
  const rng = createRng(`quests:${day}`);
  const fixed = QUEST_POOL.find((q) => q.id === 'battle3')!;
  const rest = rng.shuffle(QUEST_POOL.filter((q) => q.id !== 'battle3')).slice(0, 2);
  return [fixed, ...rest];
}

// ------------------------------------------------------------------ check-in streak

export const STREAK_REWARDS = [200, 300, 450, 650, 900, 1200, 2000];

export function nextStreak(lastDay: string | null, streak: number, today: string): { streak: number; reward: number; already: boolean } {
  if (lastDay === today) return { streak, reward: 0, already: true };
  const y = new Date(`${today}T00:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  const continued = lastDay === y.toISOString().slice(0, 10);
  const s = continued ? streak + 1 : 1;
  return { streak: s, reward: STREAK_REWARDS[Math.min(s, STREAK_REWARDS.length) - 1], already: false };
}

// ------------------------------------------------------------------ daily combo

/** The nine symbols of the daily combo board. */
export const COMBO_SYMBOLS = ['quill', 'coin', 'bolt', 'leaf', 'drop', 'flame', 'star', 'moon', 'gem'] as const;
export type ComboSymbol = (typeof COMBO_SYMBOLS)[number];
export const COMBO_TRIES = 4;
export const COMBO_REWARD = 5000;

/** Today's secret ordered combo of 3 distinct symbols. */
export function dailyCombo(day: string): ComboSymbol[] {
  return createRng(`combo:${day}`).shuffle(COMBO_SYMBOLS).slice(0, 3);
}

export type ComboMark = 'hit' | 'near' | 'miss';

/** Wordle-style feedback: hit = right symbol right slot, near = in combo but wrong slot. */
export function scoreCombo(answer: ComboSymbol[], guess: ComboSymbol[]): ComboMark[] {
  return guess.map((g, i) => (answer[i] === g ? 'hit' : answer.includes(g) ? 'near' : 'miss'));
}
