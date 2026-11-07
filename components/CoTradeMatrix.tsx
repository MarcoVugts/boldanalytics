"use client";

import { useMemo, useState } from "react";
import { int } from "@/lib/format";
import type { CoTradeData } from "@/lib/queries/segments";

type Mode = "overlap" | "lift";

/**
 * Co-trading matrix over regular traders. Row = stock X, column = stock Y.
 *  overlap: share of X's traders who also traded Y   (sequential, one hue)
 *  lift:    overlap / share of all traders who traded Y (diverging around 1×)
 */
export function CoTradeMatrix({ data }: { data: CoTradeData }) {
  const [mode, setMode] = useState<Mode>("lift");
  const [hover, setHover] = useState<{ x: string; y: string } | null>(null);
  const syms = data.symbols.map((s) => s.symbol);
  const nOf = useMemo(() => new Map(data.symbols.map((s) => [s.symbol, s.wallets])), [data.symbols]);
  const both = useMemo(() => new Map(data.pairs.map((p) => [`${p.x}|${p.y}`, p.both])), [data.pairs]);

  if (syms.length < 2) return <div className="py-12 text-center text-sm text-ink-3">Not enough data yet</div>;

  const cell = (x: string, y: string) => {
    const nx = nOf.get(x) ?? 0;
    const ny = nOf.get(y) ?? 0;
    const b = both.get(`${x}|${y}`) ?? 0;
    const overlap = nx ? b / nx : 0;
    const base = data.total ? ny / data.total : 0;
    const lift = base ? overlap / base : 0;
    return { nx, ny, b, overlap, lift };
  };

  const maxOverlap = Math.max(0.01, ...syms.flatMap((x) => syms.filter((y) => y !== x).map((y) => cell(x, y).overlap)));

  // Background + matching ink for legibility on dark cells.
  const style = (x: string, y: string) => {
    if (x === y) return { background: "var(--surface-0)", color: "var(--text-muted)" };
    const c = cell(x, y);
    if (mode === "overlap") {
      const t = Math.min(1, c.overlap / maxOverlap);
      return { background: `color-mix(in oklab, var(--series-1) ${Math.round(8 + t * 82)}%, var(--surface-1))`, color: t > 0.55 ? "var(--surface-1)" : "var(--text-primary)" };
    }
    // lift: log2 scale, capped at 4x either way; blue = together more than chance, red = less
    const l = Math.max(-2, Math.min(2, Math.log2(c.lift || 0.25))) / 2;
    const hue = l >= 0 ? "var(--buy)" : "var(--sell)";
    const t = Math.abs(l);
    return { background: `color-mix(in oklab, ${hue} ${Math.round(t * 85)}%, var(--surface-0))`, color: t > 0.6 ? "var(--surface-1)" : "var(--text-primary)" };
  };

  const fmt = (x: string, y: string) => {
    if (x === y) return int(nOf.get(x) ?? 0);
    const c = cell(x, y);
    return mode === "overlap" ? `${Math.round(c.overlap * 100)}%` : `${c.lift.toFixed(1)}×`;
  };

  const h = hover && hover.x !== hover.y ? cell(hover.x, hover.y) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-border p-0.5 text-xs" role="tablist">
          {(["lift", "overlap"] as Mode[]).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
              className={`rounded px-2.5 py-1 ${mode === m ? "bg-surface-0 font-medium text-ink" : "text-ink-2 hover:text-ink"}`}>
              {m === "lift" ? "Affinity (vs chance)" : "Overlap %"}
            </button>
          ))}
        </div>
        {mode === "lift" ? (
          <div className="flex items-center gap-2 text-xs text-ink-2">
            <span>less than chance</span>
            <span className="h-2.5 w-24 rounded-sm" style={{ background: "linear-gradient(90deg, var(--sell), var(--surface-0), var(--buy))" }} />
            <span>more</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-ink-2">
            <span>0%</span>
            <span className="h-2.5 w-24 rounded-sm" style={{ background: "linear-gradient(90deg, var(--surface-1), var(--series-1))" }} />
            <span>{Math.round(maxOverlap * 100)}%</span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-[2px] text-xs" onMouseLeave={() => setHover(null)}>
          <thead>
            <tr>
              <th className="sticky left-0 bg-surface-1 px-1 text-left font-normal text-ink-3">traded ↓ · also ↦</th>
              {syms.map((y) => (
                <th key={y} className={`px-1 pb-1 font-medium ${hover?.y === y ? "text-ink" : "text-ink-2"}`}>{y}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {syms.map((x) => (
              <tr key={x}>
                <th className={`sticky left-0 bg-surface-1 pr-2 text-right font-medium ${hover?.x === x ? "text-ink" : "text-ink-2"}`}>{x}</th>
                {syms.map((y) => (
                  <td key={y} onMouseEnter={() => setHover({ x, y })}
                    className={`h-8 min-w-[52px] rounded-sm text-center tabular-nums ${hover && hover.x === x && hover.y === y ? "outline outline-2 outline-[var(--text-primary)]" : ""}`}
                    style={style(x, y)}>
                    {fmt(x, y)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="min-h-[2.5em] text-sm text-ink-2">
        {h && hover ? (
          <>
            Of <b className="text-ink">{int(h.nx)}</b> {hover.x} traders, <b className="text-ink">{Math.round(h.overlap * 100)}%</b> ({int(h.b)}) also traded {hover.y}:{" "}
            <b className="text-ink">{h.lift.toFixed(1)}×</b> the share of all traders who trade {hover.y} ({Math.round((h.ny / (data.total || 1)) * 100)}%).
          </>
        ) : (
          <span className="text-ink-3">Hover a cell. Diagonal = number of traders of that stock. Regular traders only ({int(data.total)} wallets); high-frequency wallets excluded.</span>
        )}
      </p>
    </div>
  );
}
