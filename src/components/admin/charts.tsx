'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Small SVG charts for the console. Series colours are a validated 4-slot palette on the dark
 * panel (lightness band, CVD separation, 3:1 contrast all pass); text always uses ink tokens.
 */
export const SERIES = ['#9b7fd8', '#e04f8c', '#b8821c', '#2b9fd0'] as const;

const fmtN = (v: number, d = 0) => v.toLocaleString('en-US', { maximumFractionDigits: d });
const short = (day: string) => day.slice(5).replace('-', '/');

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v)!;
}

interface Series { name: string; values: number[] }

/** Area (one series) or stacked bars (up to 4), with a shared x hover and tooltip. */
export function TimeChart({ days, series, kind = 'area', unit = '', digits = 0, height = 180 }: { days: string[]; series: Series[]; kind?: 'area' | 'bars'; unit?: string; digits?: number; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  // Draw in real pixels so axis text stays 10px on a phone instead of shrinking with the viewBox.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = height, L = 36, R = 8, T = 10, B = 22;
  const n = days.length;
  const totals = days.map((_, i) => series.reduce((a, s) => a + (s.values[i] ?? 0), 0));
  const max = niceMax(Math.max(...totals, 0));
  const x = (i: number) => L + ((W - L - R) * (i + 0.5)) / n;
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const bw = Math.max(3, ((W - L - R) / n) * 0.62);
  const ticks = [0, max / 2, max];
  const labelEvery = Math.ceil(n / Math.max(3, Math.floor(W / 100)));
  const empty = totals.every((t) => t === 0);
  const s0 = series[0];
  const line = s0 ? s0.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('') : '';

  return (
    <div ref={box} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={`${series.map((s) => s.name).join(', ')} over ${n} days`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t ? '2 4' : undefined} />
            <text x={L - 6} y={y(t) + 3.5} textAnchor="end" className="fill-dim text-[10px] tabular-nums">{fmtN(t, t < 10 ? 1 : 0)}</text>
          </g>
        ))}
        {days.map((d, i) => (i % labelEvery === (n - 1) % labelEvery ? <text key={d} x={x(i)} y={H - 6} textAnchor="middle" className="fill-dim text-[10px]">{short(d)}</text> : null))}
        {kind === 'area' && s0 && !empty && (
          <>
            <path d={`${line}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill={SERIES[0]} opacity={0.16} />
            <path d={line} fill="none" stroke={SERIES[0]} strokeWidth={2} strokeLinejoin="round" />
            {hover !== null && <circle cx={x(hover)} cy={y(s0.values[hover] ?? 0)} r={4.5} fill={SERIES[0]} stroke="var(--panel-solid)" strokeWidth={2} />}
          </>
        )}
        {kind === 'bars' && days.map((_, i) => {
          let acc = 0;
          return (
            <g key={i}>
              {series.map((s, si) => {
                const v = s.values[i] ?? 0;
                if (!v) return null;
                const y0 = y(acc), y1 = y(acc + v);
                acc += v;
                const top = si === series.length - 1 || series.slice(si + 1).every((o) => !(o.values[i] ?? 0));
                const h = Math.max(1, y0 - y1 - (top ? 0 : 2));
                return <rect key={si} x={x(i) - bw / 2} y={y1} width={bw} height={h} rx={top ? Math.min(4, bw / 2) : 0} fill={SERIES[si]} opacity={hover === null || hover === i ? 1 : 0.45} />;
              })}
            </g>
          );
        })}
        {hover !== null && kind === 'area' && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--dim)" strokeOpacity={0.5} />}
        {days.map((_, i) => (
          <rect key={i} x={L + ((W - L - R) * i) / n} y={T} width={(W - L - R) / n} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
        ))}
        {empty && <text x={(L + W) / 2} y={H / 2} textAnchor="middle" className="fill-dim text-[12px]">No data yet</text>}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-0 z-10 min-w-36 -translate-x-1/2 rounded-xl border border-line bg-[var(--panel-solid)] px-3 py-2 text-xs shadow-xl" style={{ left: `${Math.min(88, Math.max(12, (x(hover) / W) * 100))}%` }}>
          <div className="mb-1 text-dim">{days[hover]}</div>
          {series.map((s, si) => (
            <div key={s.name} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">{series.length > 1 && <i className="size-2 rounded-sm" style={{ background: SERIES[si] }} />}{s.name}</span>
              <b className="tabular-nums">{fmtN(s.values[hover] ?? 0, digits)}{unit}</b>
            </div>
          ))}
          {series.length > 1 && <div className="mt-1 flex justify-between border-t border-line pt-1 text-dim"><span>Total</span><b className="tabular-nums text-ink">{fmtN(totals[hover], digits)}{unit}</b></div>}
        </div>
      )}
      {series.length > 1 && <Legend items={series.map((s) => s.name)} />}
    </div>
  );
}

export function Legend({ items }: { items: string[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dim">
      {items.map((name, i) => <span key={name} className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm" style={{ background: SERIES[i] }} />{name}</span>)}
    </div>
  );
}

/** A 100% bar showing how a total splits (e.g. burn / prize / treasury), labelled under it. */
export function SplitBar({ parts, unit }: { parts: { name: string; value: number }[]; unit: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-panel-2">
        {total > 0 && parts.map((p, i) => p.value > 0 && <div key={p.name} title={`${p.name}: ${fmtN(p.value, 2)} ${unit}`} style={{ width: `${(p.value / total) * 100}%`, background: SERIES[i] }} />)}
      </div>
      <div className="mt-2 grid gap-1 text-xs sm:grid-cols-3">
        {parts.map((p, i) => (
          <div key={p.name} className="flex items-center gap-1.5 text-dim">
            <i className="size-2.5 shrink-0 rounded-sm" style={{ background: SERIES[i] }} />
            {p.name} <b className="ml-auto tabular-nums text-ink sm:ml-1">{fmtN(p.value, 2)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Horizontal bars for a funnel or a ranked list; each row shows its value and share of the first. */
export function HBars({ rows, unit = '' }: { rows: { name: string; value: number; hint?: string }[]; unit?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  const first = rows[0]?.value || 0;
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={r.name}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{r.name}</span>
            <span className="shrink-0 tabular-nums"><b>{fmtN(r.value)}{unit}</b>{i > 0 && first > 0 && <span className="ml-2 text-xs text-dim">{Math.round((r.value / first) * 100)}%</span>}</span>
          </div>
          <div className="h-2 rounded-full bg-panel-2"><div className="h-2 rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: SERIES[0] }} /></div>
        </li>
      ))}
    </ul>
  );
}

/** KPI tile: label, hero number, optional change vs the previous period and a tiny trend line. */
export function Kpi({ label, value, sub, delta, trend, icon }: { label: string; value: ReactNode; sub?: ReactNode; delta?: number | null; trend?: number[]; icon?: ReactNode }) {
  const pts = trend && trend.length > 1 ? trend : null;
  const tmax = pts ? Math.max(...pts, 1) : 1;
  return (
    <div className="surface relative overflow-hidden rounded-3xl p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-dim">{icon}{label}</div>
      <div className="mt-2 font-display text-2xl font-semibold leading-none tabular-nums sm:text-[28px]">{value}</div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-dim">
        {delta !== undefined && delta !== null && Number.isFinite(delta) && (
          <span className={`font-semibold ${delta >= 0 ? 'text-lime' : 'text-danger'}`}>{delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta * 100))}%</span>
        )}
        {sub}
      </div>
      {pts && (
        <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="absolute right-4 top-4 hidden h-7 w-20 opacity-80 sm:block" aria-hidden>
          <polyline fill="none" stroke={SERIES[0]} strokeWidth={2} vectorEffect="non-scaling-stroke" points={pts.map((v, i) => `${(i / (pts.length - 1)) * 100},${26 - (v / tmax) * 24}`).join(' ')} />
        </svg>
      )}
    </div>
  );
}

/** Status pill: icon + label, never colour alone. */
export function Status({ ok, warn, children }: { ok: boolean; warn?: boolean; children: ReactNode }) {
  const tone = ok ? 'border-lime/30 bg-lime/10 text-lime' : warn ? 'border-gold/30 bg-gold/10 text-gold' : 'border-danger/30 bg-danger/10 text-danger';
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}>{ok ? '✓' : warn ? '!' : '✕'} {children}</span>;
}
