"use client";

import { useState } from "react";
import { useWidth } from "../useWidth";

/** Wallets by number of trades (x) and volume (y), both on a log scale, coloured by trader type. A sample per type. */
export function TypeScatter({ points, names }: { points: [number, number, number][]; names: string[] }) {
  const [ref, width] = useWidth<HTMLDivElement>(720);
  const [focus, setFocus] = useState<number | null>(null);
  const W = Math.max(320, width), H = Math.round(Math.min(460, Math.max(300, W * 0.55)));
  const M = { l: 52, r: 12, t: 10, b: 36 };
  const xMax = Math.ceil(Math.max(1, ...points.map((p) => p[0]))), yMin = Math.floor(Math.min(...points.map((p) => p[1]))), yMax = Math.ceil(Math.max(...points.map((p) => p[1])));
  const x = (v: number) => M.l + (v / xMax) * (W - M.l - M.r);
  const y = (v: number) => H - M.b - ((v - yMin) / Math.max(1, yMax - yMin)) * (H - M.t - M.b);
  const usd = (e: number) => (e >= 9 ? `$${10 ** (e - 9)}B` : e >= 6 ? `$${10 ** (e - 6)}M` : e >= 3 ? `$${10 ** (e - 3)}K` : `$${10 ** e}`);
  const cnt = (e: number) => (e >= 6 ? `${10 ** (e - 6)}M` : e >= 3 ? `${10 ** (e - 3)}K` : `${10 ** e}`);
  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {names.map((n, i) => (
          <li key={n}>
            <button
              type="button"
              onMouseEnter={() => setFocus(i)}
              onMouseLeave={() => setFocus(null)}
              onClick={() => setFocus((f) => (f === i ? null : i))}
              className={`flex items-center gap-1.5 ${focus === null || focus === i ? "text-ink-2" : "text-ink-3"}`}
            >
              <span className="size-2.5 rounded-full" style={{ background: `var(--cat-${i + 1})` }} />
              {n}
            </button>
          </li>
        ))}
      </ul>
      <div ref={ref} className="w-full">
        <svg width={W} height={H} role="img" aria-label="Wallets by number of trades and volume, coloured by trader type" className="block">
          {Array.from({ length: yMax - yMin + 1 }, (_, i) => yMin + i).map((e) => (
            <g key={`y${e}`}>
              <line x1={M.l} x2={W - M.r} y1={y(e)} y2={y(e)} stroke="var(--grid)" />
              <text x={M.l - 8} y={y(e)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--text-muted)">{usd(e)}</text>
            </g>
          ))}
          {Array.from({ length: xMax + 1 }, (_, e) => e).map((e) => (
            <text key={`x${e}`} x={x(e)} y={H - M.b + 16} textAnchor="middle" fontSize={11} fill="var(--text-muted)">{cnt(e)}</text>
          ))}
          <text x={W - M.r} y={H - 4} textAnchor="end" fontSize={11} fill="var(--text-muted)">trades per wallet →</text>
          <text x={M.l} y={M.t + 2} dy="0.7em" fontSize={11} fill="var(--text-muted)">↑ volume per wallet</text>
          {points.map(([px, py, c], i) => {
            // jitter wallets with the same trade count so the columns read as clouds
            const j = ((i * 7919) % 97) / 97 - 0.5;
            return (
              <circle
                key={i}
                cx={x(px) + j * (px < 1.2 ? 14 : 4)}
                cy={y(py)}
                r={2.6}
                fill={`var(--cat-${c + 1})`}
                opacity={focus === null ? 0.55 : focus === c ? 0.85 : 0.06}
              />
            );
          })}
        </svg>
      </div>
      <p className="text-xs text-ink-3">Both axes on a log scale. A random sample of up to 400 wallets per type; hover or tap a type to highlight it.</p>
    </div>
  );
}
