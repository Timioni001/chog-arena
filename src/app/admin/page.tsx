'use client';

import { useCallback, useEffect, useState } from 'react';

interface Day { day: string; dau: number; newDevices: number; d1: number; d7: number; events: Record<string, number>; economy: Record<string, number> }
interface Stats { store: string; days: Day[]; flags: { tokenId: number; reason: string; at: number; until: number | null }[] }

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');

/** Ops dashboard: retention, events, Spark sources and sinks, flags. Needs the ADMIN_TOKEN secret. */
export default function Admin() {
  const [token, setToken] = useState('');
  const [data, setData] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [flagForm, setFlagForm] = useState({ tokenId: '', reason: '', days: '' });

  const load = useCallback(async (t: string) => {
    setErr(null);
    const r = await fetch('/api/admin/stats', { headers: { authorization: `Bearer ${t}` } });
    if (!r.ok) return setErr((await r.json().catch(() => ({}))).error ?? `Error ${r.status}`);
    setData(await r.json());
    try { sessionStorage.setItem('ca_admin', t); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      const t = sessionStorage.getItem('ca_admin');
      if (t) { setToken(t); void load(t); }
    } catch { /* ignore */ }
  }, [load]);

  const flag = async (method: 'POST' | 'DELETE') => {
    const r = await fetch('/api/admin/flags', { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ tokenId: Number(flagForm.tokenId), reason: flagForm.reason, days: flagForm.days ? Number(flagForm.days) : null }) });
    if (!r.ok) setErr((await r.json().catch(() => ({}))).error ?? `Error ${r.status}`);
    else void load(token);
  };

  if (!data) {
    return (
      <main className="mx-auto max-w-sm px-5 py-20">
        <h1 className="font-display text-3xl font-semibold">Arena ops</h1>
        <form className="mt-6 space-y-3" onSubmit={(e) => { e.preventDefault(); void load(token); }}>
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ADMIN_TOKEN" className="w-full rounded-xl border border-line bg-panel-2 px-3 py-2.5" />
          <button className="w-full rounded-full bg-ink py-2.5 font-semibold text-bg">Open dashboard</button>
          {err && <p className="text-sm text-danger">{err}</p>}
        </form>
      </main>
    );
  }

  const days = data.days;
  const eventNames = Object.keys(days[0]?.events ?? {});
  const ledger = Object.keys(days[0]?.economy ?? {});
  const totals = (k: string) => days.reduce((a, d) => a + (d.economy[k] ?? 0), 0);
  const sources = ledger.filter((k) => totals(k) > 0), sinks = ledger.filter((k) => totals(k) < 0);
  const sum = (ks: string[]) => ks.reduce((a, k) => a + totals(k), 0);

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-5 py-10 text-sm">
      <header className="flex items-end justify-between">
        <div>
          <div className="eyebrow">Last 14 days · store: {data.store}</div>
          <h1 className="font-display text-3xl font-semibold">Arena ops</h1>
        </div>
        <button onClick={() => void load(token)} className="rounded-full border border-line px-4 py-2">Refresh</button>
      </header>
      {err && <p className="text-danger">{err}</p>}

      <section className="glass overflow-x-auto rounded-3xl p-5">
        <h2 className="mb-3 font-display text-xl font-semibold">Players & retention</h2>
        <table className="w-full tabular-nums">
          <thead className="text-left text-dim"><tr><th className="py-1">Day</th><th>DAU</th><th>New</th><th>D1 (of that day’s new)</th><th>D7</th></tr></thead>
          <tbody>{days.map((d) => <tr key={d.day} className="border-t border-line"><td className="py-1.5">{d.day}</td><td>{d.dau}</td><td>{d.newDevices}</td><td>{d.d1} · {pct(d.d1, d.newDevices)}</td><td>{d.d7} · {pct(d.d7, d.newDevices)}</td></tr>)}</tbody>
        </table>
        <p className="mt-2 text-xs text-dim">D1/D7 on a row = devices first seen that day who came back 1 / 7 days later. Launch gates people use: D1 ≥ 35–40%, D7 ≥ 15%.</p>
      </section>

      <section className="glass overflow-x-auto rounded-3xl p-5">
        <h2 className="mb-3 font-display text-xl font-semibold">Events</h2>
        <table className="w-full tabular-nums">
          <thead className="text-left text-dim"><tr><th className="py-1">Day</th>{eventNames.map((n) => <th key={n} className="px-2">{n.replace(/_/g, ' ')}</th>)}</tr></thead>
          <tbody>{days.map((d) => <tr key={d.day} className="border-t border-line"><td className="py-1.5">{d.day.slice(5)}</td>{eventNames.map((n) => <td key={n} className="px-2">{d.events[n] || ''}</td>)}</tr>)}</tbody>
        </table>
      </section>

      <section className="glass rounded-3xl p-5">
        <h2 className="mb-1 font-display text-xl font-semibold">Spark economy (from cloud saves)</h2>
        <p className="mb-3 text-dim">Sources {sum(sources).toLocaleString()} · sinks {sum(sinks).toLocaleString()} · net {(sum(sources) + sum(sinks)).toLocaleString()}. Sinks should catch up with sources over a season.</p>
        <div className="grid gap-6 sm:grid-cols-2">
          {[['Sources', sources], ['Sinks', sinks]].map(([label, ks]) => (
            <table key={label as string} className="w-full tabular-nums">
              <thead className="text-left text-dim"><tr><th className="py-1">{label as string}</th><th className="text-right">14 days</th></tr></thead>
              <tbody>{(ks as string[]).sort((a, b) => Math.abs(totals(b)) - Math.abs(totals(a))).map((k) => <tr key={k} className="border-t border-line"><td className="py-1.5">{k}</td><td className="text-right">{totals(k).toLocaleString()}</td></tr>)}</tbody>
            </table>
          ))}
        </div>
      </section>

      <section className="glass rounded-3xl p-5">
        <h2 className="mb-3 font-display text-xl font-semibold">Flags ({data.flags.length})</h2>
        <div className="mb-4 flex flex-wrap gap-2">
          <input value={flagForm.tokenId} onChange={(e) => setFlagForm({ ...flagForm, tokenId: e.target.value })} placeholder="Token id" className="w-28 rounded-xl border border-line bg-panel-2 px-3 py-2" />
          <input value={flagForm.reason} onChange={(e) => setFlagForm({ ...flagForm, reason: e.target.value })} placeholder="Public reason" className="min-w-60 flex-1 rounded-xl border border-line bg-panel-2 px-3 py-2" />
          <input value={flagForm.days} onChange={(e) => setFlagForm({ ...flagForm, days: e.target.value })} placeholder="Days (blank = until reviewed)" className="w-56 rounded-xl border border-line bg-panel-2 px-3 py-2" />
          <button onClick={() => void flag('POST')} className="rounded-full bg-danger px-4 py-2 font-semibold text-white">Flag</button>
          <button onClick={() => void flag('DELETE')} className="rounded-full border border-line px-4 py-2">Clear</button>
        </div>
        <ul className="divide-y divide-line">{data.flags.map((f) => <li key={f.tokenId} className="py-1.5">#{f.tokenId}: {f.reason}</li>)}</ul>
      </section>
    </main>
  );
}
