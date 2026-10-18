import { ingest } from '@/server/analytics';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { device: string; events: { n: string; p?: Record<string, unknown> }[] };
    if (Array.isArray(body.events)) await ingest(String(body.device ?? ''), body.events);
  } catch {
    /* never fail the client */
  }
  return new Response(null, { status: 204 });
}
