import { handle, json, requireAdmin } from '@/server/http';
import { audit, auditLog } from '@/server/admin';
import { getOps, setOps, type Announcement } from '@/server/ops';
import { ArenaError } from '@/server/arena';

export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    return json({ ops: await getOps(), log: await auditLog(40) }, { headers: { 'cache-control': 'no-store' } });
  });
}

/** POST { announcement: { text, tone, hours } | null } and/or { rankedPaused: boolean }. */
export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin(req);
    const body = (await req.json()) as { announcement?: { text: string; tone?: string; hours?: number } | null; rankedPaused?: boolean };
    const patch: { announcement?: Announcement | null; rankedPaused?: boolean } = {};
    if ('announcement' in body) {
      const a = body.announcement;
      if (a) {
        const text = String(a.text ?? '').trim().slice(0, 160);
        if (!text) throw new ArenaError(400, 'Write the announcement first.');
        const tone = a.tone === 'event' || a.tone === 'warn' ? a.tone : 'info';
        patch.announcement = { text, tone, until: a.hours ? Date.now() + Math.min(24 * 30, a.hours) * 3_600_000 : null, at: Date.now() };
        await audit(req, 'announce', text);
      } else {
        patch.announcement = null;
        await audit(req, 'announce_clear');
      }
    }
    if (typeof body.rankedPaused === 'boolean') {
      patch.rankedPaused = body.rankedPaused;
      await audit(req, body.rankedPaused ? 'ranked_pause' : 'ranked_resume');
    }
    return json({ ops: await setOps(patch) });
  });
}
