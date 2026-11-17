"use client";

import { useState } from "react";
import { useWidth } from "../useWidth";

/** t-SNE map: each dot is a wallet (a sample per type); wallets that trade alike sit close, so types form islands. */
export function TypeMap({ points, names }: { points: [number, number, number][]; names: string[] }) {
  const [ref, width] = useWidth<HTMLDivElement>(720);
  const [focus, setFocus] = useState<number | null>(null);
  const W = Math.max(320, width), H = Math.round(Math.min(520, Math.max(340, W * 0.6)));
  const pad = 24;
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = Math.min((W - 2 * pad) / (x1 - x0 || 1), (H - 2 * pad) / (y1 - y0 || 1));
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const x = (v: number) => r1(W / 2 + (v - (x0 + x1) / 2) * s);
  const y = (v: number) => r1(H / 2 + (v - (y0 + y1) / 2) * s);
  // label each type at the median of its dots
  const med = (a: number[]) => { const b = [...a].sort((p, q) => p - q); return b[Math.floor(b.length / 2)] ?? 0; };
  const labels = names.map((n, i) => {
    const mine = points.filter((p) => p[2] === i);
    return mine.length ? { i, n, x: x(med(mine.map((p) => p[0]))), y: y(med(mine.map((p) => p[1]))) } : null;
  }).filter(Boolean) as { i: number; n: string; x: number; y: number }[];
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
        <svg width={W} height={H} role="img" aria-label="Cluster map of wallets: similar wallets sit close together, coloured by trader type" className="block">
          {points.map(([px, py, c], i) => (
            <circle key={i} cx={x(px)} cy={y(py)} r={3} fill={`var(--cat-${c + 1})`} opacity={focus === null ? 0.7 : focus === c ? 0.95 : 0.07} />
          ))}
          {labels.map((l) => (
            <text
              key={l.i}
              x={l.x}
              y={l.y}
              textAnchor="middle"
              dy="0.35em"
              fontSize={12}
              fontWeight={700}
              fill="var(--text-primary)"
              stroke="var(--surface-1)"
              strokeWidth={4}
              paintOrder="stroke"
              opacity={focus === null || focus === l.i ? 1 : 0.25}
              pointerEvents="none"
            >
              {l.n}
            </text>
          ))}
        </svg>
      </div>
      <p className="text-xs text-ink-3">
        Each dot is a wallet (a random sample of up to 100 per type). Wallets that trade alike on all features sit close together, so each type
        forms its own island; the position and the axes themselves have no meaning (t-SNE map). Hover or tap a type to highlight it.
      </p>
    </div>
  );
}
