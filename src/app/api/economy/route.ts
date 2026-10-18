import { json } from '@/server/http';
import { BOT_SPECIES } from '@/game/bots';

/** Public description of every Spark source and sink, used by the economy dashboard. */
export async function GET() {
  return json({
    sources: [
      { id: 'taps', label: 'Tapping', note: 'Energy-gated: cap and regen limit daily output.' },
      { id: 'bots', label: 'Bots (passive + offline)', note: 'Offline earnings capped at 3h (+skills).' },
      { id: 'battle:*', label: 'Battles', note: 'Wins 400, draws 200, losses 120; practice pays 25%.' },
      { id: 'quests', label: 'Daily quests', note: '3 per day.' },
      { id: 'checkin', label: 'Check-in streak', note: '200 → 2,000 over 7 days.' },
      { id: 'combo', label: 'Daily combo', note: 'Up to 5,000 once per day.' },
      { id: 'pass', label: 'Season pass', note: 'Fixed per tier.' },
      { id: 'scrap', label: 'Scrapping bots', note: 'Refunds 30% of list price.' },
    ],
    sinks: [
      { id: 'shop:bots', label: 'Bot shop', prices: BOT_SPECIES.map((b) => ({ bot: b.name, price: b.price })) },
      { id: 'merge', label: 'Bot merges', note: '150 × 1.6^(level−1) per merge.' },
      { id: 'respec', label: 'Skill respec', note: '1,000 + 100 × level.' },
    ],
    chog: {
      note: '$CHOG is never emitted by the game. It only flows in via ChogShop purchases (split burn / prize vault / treasury) and out via season prize claims backed by that vault.',
    },
  });
}
