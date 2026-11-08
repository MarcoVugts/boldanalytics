"use client";

import { useMemo, useState } from "react";
import { int, num, usd } from "@/lib/format";
import { BUCKETS, type Dimension, type SegmentRow } from "@/lib/segments-shared";
import { useExport } from "./ExportContext";

const DIMS: { key: Dimension; label: string; unit: string }[] = [
  { key: "volume", label: "By volume", unit: "USD traded by the wallet that day" },
  { key: "trades", label: "By trades", unit: "trades by the wallet that day" },
  { key: "stocks", label: "By stocks", unit: "different stocks traded that day" },
];

// ordinal ramp slots per bucket count (validated steps, light -> dark)
const RAMP: Record<number, number[]> = { 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4] };
const color = (i: number, n: number) => `var(--seq-${(RAMP[n] ?? RAMP[5])[i]})`;
const pct = (v: number) => (v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v > 0 ? "<1" : "0") + "%";

/**
 * Trader segmentation: the unit is a trader-day (one wallet on one day). Each bucket shows
 * its share of traders next to its share of volume, so concentration is visible at a glance.
 */
export function SegmentChart({ rows }: { rows: SegmentRow[] }) {
  const exp = useExport();
  const [dim, setDim] = useState<Dimension>("volume");
  const days = useMemo(() => [...new Set(rows.map((r) => r.day))].sort(), [rows]);
  const [day, setDay] = useState<string>("all");
  const [hover, setHover] = useState<number | null>(null);
  const labels = BUCKETS[dim];
  const n = labels.length;

  const buckets = useMemo(() => {
    const out = labels.map((label, i) => ({ i, label, wallets: 0, volume: 0, trades: 0 }));
    for (const r of rows) {
      if (r.dim !== dim || (day !== "all" && r.day !== day)) continue;
      const b = out[r.bucket];
      if (!b) continue;
      b.wallets += r.wallets;
      b.volume += r.volume;
      b.trades += r.trades;
    }
    return out;
  }, [rows, dim, day, labels]);

  const tw = buckets.reduce((s, b) => s + b.wallets, 0) || 1;
  const tv = buckets.reduce((s, b) => s + b.volume, 0) || 1;
  const top = buckets[n - 1];

  const perDay = useMemo(
    () =>
      days.map((d) => {
        const bs = labels.map(() => ({ wallets: 0, volume: 0 }));
        for (const r of rows) if (r.dim === dim && r.day === d && bs[r.bucket]) {
          bs[r.bucket].wallets += r.wallets;
          bs[r.bucket].volume += r.volume;
        }
        return { day: d, bs };
      }),
    [rows, dim, days, labels],
  );

  if (!rows.length) return <div className="py-12 text-center text-sm text-ink-3">No data yet</div>;

  // Tell ShareCard which period this view covers when a single day is selected.
  const periodAttrs = day === "all" ? {} : { "data-period-from": day, "data-period-to": day };

  return (
    <div className="space-y-5" {...periodAttrs}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border border-border p-0.5 text-xs" role="tablist">
          {DIMS.map((d) => (
            <button key={d.key} role="tab" aria-selected={dim === d.key} onClick={() => setDim(d.key)}
              className={`rounded px-2.5 py-1 ${dim === d.key ? "bg-surface-0 font-medium text-ink" : "text-ink-2 hover:text-ink"}`}>
              {d.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-ink-2">
          Day
          <select value={day} onChange={(e) => setDay(e.target.value)}
            className="rounded-md border border-border bg-surface-1 px-2 py-1 text-xs text-ink">
            <option value="all">All {days.length} days</option>
            {[...days].reverse().map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
      </div>

      {top && top.wallets > 0 && (
        <p className="text-sm text-ink-2">
          <span className="font-semibold text-ink">{pct((top.wallets / tw) * 100)}</span> of trader-days are in the top bucket ({labels[n - 1]}) and account for{" "}
          <span className="font-semibold text-ink">{pct((top.volume / tv) * 100)}</span> of volume.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm" onMouseLeave={() => setHover(null)}>
          <thead className="text-left text-xs text-ink-3">
            <tr>
              <th className="py-1.5 pr-3 font-normal">{DIMS.find((d) => d.key === dim)!.unit}</th>
              <th className="w-[34%] py-1.5 pr-3 font-normal sm:w-[30%]">Share of traders</th>
              <th className="w-[34%] py-1.5 pr-3 font-normal sm:w-[30%]">Share of volume</th>
              <th className="hidden py-1.5 pr-3 text-right font-normal sm:table-cell">Traders</th>
              <th className="hidden py-1.5 text-right font-normal sm:table-cell">Avg volume</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => {
              const sw = (b.wallets / tw) * 100;
              const sv = (b.volume / tv) * 100;
              return (
                <tr key={b.label} onMouseEnter={() => setHover(b.i)}
                  className={`border-t border-border ${hover !== null && hover !== b.i ? "opacity-50" : ""}`}>
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color(b.i, n) }} />
                      {b.label}
                    </span>
                  </td>
                  <td className="py-2 pr-3"><ShareBar v={sw} fill={color(b.i, n)} /></td>
                  <td className="py-2 pr-3"><ShareBar v={sv} fill={color(b.i, n)} /></td>
                  <td className="hidden py-2 pr-3 text-right sm:table-cell">{int(b.wallets)}</td>
                  <td className="hidden py-2 text-right sm:table-cell">{b.wallets ? usd(b.volume / b.wallets) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* All-days breakdown; left out of a shared image when a single day is selected */}
      {/* left out of the portrait image too: one row per day is too long for a shared picture */}
      <div
        className="space-y-2"
        style={exp.exporting && exp.format === "portrait" ? { display: "none" } : undefined}
        {...(day === "all" ? {} : { "data-no-export": "" })}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-ink-3">Per day: share of traders (top bar) vs share of volume (bottom bar)</div>
          <div className="flex flex-wrap gap-3 text-xs text-ink-2">
            {labels.map((l, i) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color(i, n) }} />{l}
              </span>
            ))}
          </div>
        </div>
        {perDay.map(({ day: d, bs }) => {
          const w = bs.reduce((s, b) => s + b.wallets, 0) || 1;
          const v = bs.reduce((s, b) => s + b.volume, 0) || 1;
          return (
            <div key={d} className="grid grid-cols-[72px_1fr] items-center gap-2" onMouseLeave={() => setHover(null)}>
              <div className="text-xs text-ink-3">{d.slice(5)}</div>
              <div className="space-y-1">
                <Stacked parts={bs.map((b) => b.wallets / w)} n={n} hover={hover} setHover={setHover}
                  title={(i) => `${labels[i]}: ${pct((bs[i].wallets / w) * 100)} of traders (${int(bs[i].wallets)})`} />
                <Stacked parts={bs.map((b) => b.volume / v)} n={n} hover={hover} setHover={setHover}
                  title={(i) => `${labels[i]}: ${pct((bs[i].volume / v) * 100)} of volume (${usd(bs[i].volume)})`} />
              </div>
            </div>
          );
        })}
        <p className="text-xs text-ink-3">
          A trader-day is one wallet on one day; a wallet active on {num(days.length)} days counts up to {num(days.length)} times.
        </p>
      </div>
    </div>
  );
}

function ShareBar({ v, fill }: { v: number; fill: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 flex-1 rounded-sm bg-surface-0">
        <div className="h-2.5 rounded-sm" style={{ width: `${Math.max(0, Math.min(100, v))}%`, background: fill }} />
      </div>
      <span className="w-9 text-right text-xs text-ink-2">{pct(v)}</span>
    </div>
  );
}

function Stacked({ parts, n, hover, setHover, title }: {
  parts: number[]; n: number; hover: number | null; setHover: (i: number | null) => void; title: (i: number) => string;
}) {
  return (
    <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-sm">
      {parts.map((p, i) =>
        p > 0 ? (
          <div key={i} title={title(i)} onMouseEnter={() => setHover(i)}
            style={{ width: `${p * 100}%`, background: color(i, n), opacity: hover === null || hover === i ? 1 : 0.35 }} />
        ) : null,
      )}
    </div>
  );
}
