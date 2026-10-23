'use client';

import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Exchanges ADMIN_TOKEN for an httpOnly session cookie. The token is never stored in the browser. */
export function AdminLogin() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await fetch('/api/admin/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) }).catch(() => null);
    setBusy(false);
    if (r?.ok) { setToken(''); router.refresh(); return; }
    setErr(((await r?.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Could not reach the server.');
  };
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <form onSubmit={submit} className="surface w-full max-w-sm rounded-[28px] p-6">
        <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-chog/25 text-chog-3"><ShieldCheck size={24} /></div>
        <div className="eyebrow">Owner only</div>
        <h1 className="font-display text-3xl font-semibold">Arena console</h1>
        <p className="mt-2 text-sm text-dim">Enter your admin token. This browser stays signed in for 8 hours; five wrong tries lock this address out for 15 minutes.</p>
        <label className="mt-5 block text-xs font-semibold uppercase tracking-wider text-dim" htmlFor="tok">Admin token</label>
        <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-line bg-panel-2 px-3 focus-within:border-chog-2">
          <KeyRound size={16} className="text-dim" />
          <input id="tok" type="password" autoComplete="current-password" value={token} onChange={(e) => setToken(e.target.value)} className="min-w-0 flex-1 bg-transparent py-3 outline-none" />
        </div>
        {err && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
        <button disabled={busy || token.length < 8} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-chog py-3 font-semibold text-white transition hover:bg-grape disabled:opacity-50">
          {busy && <Loader2 size={16} className="animate-spin" />} Open console
        </button>
        <p className="mt-4 text-xs text-dim">If the wallet allowlist is on, sign in with your admin wallet in the game first (Profile, then Sign in).</p>
      </form>
    </main>
  );
}
