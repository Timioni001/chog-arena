import { issueNonce } from '@/server/session';
import { json } from '@/server/http';

export async function GET() {
  return json({ nonce: await issueNonce() });
}
