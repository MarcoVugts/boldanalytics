"use client";

import { useState } from "react";
import { useWidth } from "../useWidth";
import { trackEvent } from "@/lib/tracking";

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
  // nudge labels apart when they would overlap (alternately down and up)
  const placed: typeof labels = [];
  for (const l of [...labels].sort((a, b) => a.y - b.y)) {
    let k = 0;
    const base = l.y;
    while (placed.some((p) => Math.abs(p.y - l.y) < 16 && Math.abs(p.x - l.x) < (p.n.length + l.n.length) * 3.6 + 6) && k < 12) {
      k++;
      l.y = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 16;
    }
    placed.push(l);
  }
  // jump to the type's description card below, with a short highlight
  const open = (i: number) => {
    trackEvent("click", "trader-types-map", names[i]);
    const el = document.getElementById(`type-${i}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.animate([{ boxShadow: `0 0 0 3px var(--cat-${i + 1})` }, { boxShadow: "0 0 0 3px transparent" }], { duration: 1800, delay: 400, easing: "ease-out" });
  };
  const types = [...new Set(points.map((p) => p[2]))];
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
          {/* soft shape behind each type: big circles around its dots, blurred and cut at a threshold so they merge into one contour */}
          <defs>
            <filter id="type-blob" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="7" />
              <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -9" />
            </filter>
          </defs>
          {types.map((c) => (
            <g
              key={c}
              opacity={focus === null ? 0.16 : focus === c ? 0.3 : 0.05}
              className="cursor-pointer"
              onMouseEnter={() => setFocus(c)}
              onMouseLeave={() => setFocus(null)}
              onClick={() => open(c)}
            >
              <title>{`${names[c]}: click for the description`}</title>
              <g filter="url(#type-blob)" fill={`var(--cat-${c + 1})`}>
                {points.map(([px, py, k], i) => (k === c ? <circle key={i} cx={x(px)} cy={y(py)} r={13} /> : null))}
              </g>
            </g>
          ))}
          {points.map(([px, py, c], i) => (
            <circle key={i} cx={x(px)} cy={y(py)} r={3} fill={`var(--cat-${c + 1})`} opacity={focus === null ? 0.7 : focus === c ? 0.95 : 0.07} pointerEvents="none" />
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
        forms its own island; the position and the axes themselves have no meaning (t-SNE map).
        <span data-no-export> Hover a type to highlight it; click its area to jump to its description.</span>
      </p>
    </div>
  );
}
