import { BOT_SPECIES } from '@/game/bots';
import { json } from '@/server/http';

/** ERC-1155 metadata for ChogBots. Token id n maps to species n-1 (1-based). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const raw = (await params).id.replace(/\.json$/, '');
  const n = raw.length === 64 ? parseInt(raw, 16) : Number(raw);
  const s = BOT_SPECIES[n - 1];
  if (!s) return json({ error: 'unknown bot' }, 404);
  const origin = new URL(req.url).origin;
  return json({
    name: s.name,
    description: s.blurb,
    image: `${origin}/api/bots/image/${n}`,
    external_url: origin,
    attributes: [
      { trait_type: 'Rarity', value: s.rarity },
      { trait_type: 'Element', value: s.element },
      { trait_type: 'Base yield / h', value: s.yield },
      { trait_type: 'Card', value: s.card.name },
    ],
  });
}
