'use client';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      method: init?.method ?? (init?.json !== undefined ? 'POST' : 'GET'),
      headers: { ...(init?.json !== undefined ? { 'content-type': 'application/json' } : {}), ...init?.headers },
      body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, 'Offline: could not reach the arena server.');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  return data;
}

/** Lets the server log a landed purchase for the revenue feed (it re-reads the receipt itself). */
export function reportTx(hash: string) {
  void fetch('/api/receipt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ hash }), keepalive: true }).catch(() => undefined);
}
