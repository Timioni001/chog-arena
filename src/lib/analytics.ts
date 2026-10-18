'use client';

/** First-party, cookie-less analytics: anonymous device id + batched event names. No third parties. */
const KEY = 'ca_device';
let queue: { n: string; p?: Record<string, string | number | boolean> }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

export function deviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

function flush(useBeacon = false) {
  if (!queue.length) return;
  const body = JSON.stringify({ device: deviceId(), events: queue.slice(0, 50) });
  queue = queue.slice(50);
  try {
    if (useBeacon && navigator.sendBeacon) navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }));
    else void fetch('/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
  } catch {
    /* analytics must never break the game */
  }
}

export function track(name: string, props?: Record<string, string | number | boolean>) {
  if (typeof window === 'undefined') return;
  queue.push({ n: name, p: props });
  if (!timer) timer = setTimeout(() => { timer = null; flush(); }, 8000);
}

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(true); });
}
