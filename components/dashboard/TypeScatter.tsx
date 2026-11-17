"use client";

import { useState } from "react";
import { useWidth } from "../useWidth";
import type { MapAxis } from "@/lib/queries/clusters";

/** Map of trader types: every dot is a wallet placed by the two main directions in which wallets differ across all
 *  clustering features (PCA). Axis labels name the features that drive each direction. A sample per type. */
export function TypeScatter({ points, names, axes }: { points: [number, number, number][]; names: string[]; axes: [MapAxis, MapAxis] }) {
  const [ref, width] = useWidth<HTMLDivElement>(720);
  const [focus, setFocus] = useState<number | null>(null);
  const W = Math.max(320, width), H = Math.round(Math.min(480, Math.max(320, W * 0.58)));
  const M = { l: 18, r: 18, t: 26, b: 30 };
  // robust range: ignore the 1% most extreme points on each side so a few outliers don't squash the map
  const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))]; };
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const [x0, x1] = [q(xs, 0.01), q(xs, 0.99)], [y0, y1] = [q(ys, 0.01), q(ys, 0.99)];
  const padX = (x1 - x0) * 0.06 || 1, padY = (y1 - y0) * 0.08 || 1;
  const x = (v: number) => M.l + ((Math.min(x1 + padX, Math.max(x0 - padX, v)) - (x0 - padX)) / (x1 - x0 + 2 * padX)) * (W - M.l - M.r);
  const y = (v: number) => H - M.b - ((Math.min(y1 + padY, Math.max(y0 - padY, v)) - (y0 - padY)) / (y1 - y0 + 2 * padY)) * (H - M.t - M.b);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
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
        <svg width={W} height={H} role="img" aria-label="Map of trader types based on all clustering features" className="block">
          <rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} fill="none" stroke="var(--grid)" />
          <line x1={x(0)} x2={x(0)} y1={M.t} y2={H - M.b} stroke="var(--grid)" strokeDasharray="3 4" />
          <line x1={M.l} x2={W - M.r} y1={y(0)} y2={y(0)} stroke="var(--grid)" strokeDasharray="3 4" />
          {points.map(([px, py, c], i) => (
            <circle key={i} cx={x(px)} cy={y(py)} r={2.6} fill={`var(--cat-${c + 1})`} opacity={focus === null ? 0.55 : focus === c ? 0.9 : 0.05} />
          ))}
          {/* axis ends in words */}
          <text x={M.l} y={H - 10} fontSize={11} fill="var(--text-muted)">← {axes[0].low}</text>
          <text x={W - M.r} y={H - 10} textAnchor="end" fontSize={11} fill="var(--text-muted)">{axes[0].high} →</text>
          <text x={M.l + 4} y={M.t - 10} fontSize={11} fill="var(--text-muted)">↑ {axes[1].high}</text>
          <text x={M.l + 4} y={H - M.b - 6} fontSize={11} fill="var(--text-muted)">↓ {axes[1].low}</text>
        </svg>
      </div>
      <p className="text-xs text-ink-3">
        Wallets close together trade alike. The map summarises all ten clustering features in two directions (principal components): left–right
        explains {pct(axes[0].explained)} and up–down {pct(axes[1].explained)} of the differences between wallets; the labels name the features that
        weigh most. A random sample of up to 400 wallets per type; hover or tap a type to highlight it.
      </p>
    </div>
  );
}
