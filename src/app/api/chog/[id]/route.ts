import { profileForToken } from '@/game/chog';
import { buildDeck } from '@/game/chog';
import { isValidTokenId, marketLinks } from '@/game/collection';
import { handle, json } from '@/server/http';
import { ArenaError, getPlayer } from '@/server/arena';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = Number((await params).id);
    if (!isValidTokenId(id)) throw new ArenaError(404, 'No such Chog');
    const profile = profileForToken(id);
    const rec = await getPlayer(id);
    return json({ profile, deck: buildDeck(profile, []), record: { mmr: rec.mmr, games: rec.games, wins: rec.wins, seasonPoints: rec.seasonPoints }, links: marketLinks(id) });
  });
}
