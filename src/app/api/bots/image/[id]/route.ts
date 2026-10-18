import { BOT_SPECIES } from '@/game/bots';
import { botSvg } from '@/game/botSvg';

/** Image for ChogBots ERC-1155 token n (species n-1). Served as SVG so marketplaces render it crisply. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const n = Number((await params).id.replace(/\.svg$/, ''));
  const s = BOT_SPECIES[n - 1];
  if (!s) return new Response('unknown bot', { status: 404 });
  return new Response(botSvg(s, { size: 512, background: true }), {
    headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' },
  });
}
