"use client";

import { useState } from "react";
import { useWidth } from "../useWidth";
import { int, usd } from "@/lib/format";
import type { TraderType } from "@/lib/queries/clusters";

/** One bubble per trader type: typical trades (x) and typical volume (y) per wallet, log scales; area = number of wallets. */
export function TypeBubbles({ types }: { types: TraderType[] }) {
  const [ref, width] = useWidth<HTMLDivElement>(720);
  const [hover, setHover] = useState<number | null>(null);
  const W = Math.max(320, width), H = Math.round(Math.min(440, Math.max(300, W * 0.5)));
  const M = { l: 56, r: 24, t: 24, b: 40 };
  const lx = types.map((t) => Math.log10(Math.max(1, t.med.trades))), ly = types.map((t) => Math.log10(Math.max(1, t.med.volume)));
  const x0 = 0, x1 = Math.max(1, Math.ceil(Math.max(...lx) + 0.3)), y0 = Math.max(0, Math.floor(Math.min(...ly) - 0.3)), y1 = Math.ceil(Math.max(...ly) + 0.3);
  const r1 = (v: number) => Math.round(v * 10) / 10; // same numbers on server and client (no hydration mismatch)
  const x = (v: number) => r1(M.l + ((v - x0) / (x1 - x0)) * (W - M.l - M.r));
  const y = (v: number) => r1(H - M.b - ((v - y0) / (y1 - y0)) * (H - M.t - M.b));
  const maxW = Math.max(...types.map((t) => t.wallets));
  const r = (n: number) => r1(6 + Math.sqrt(n / maxW) * Math.min(56, W / 14));
  const tickUsd = (e: number) => (e >= 9 ? `$${10 ** (e - 9)}B` : e >= 6 ? `$${10 ** (e - 6)}M` : e >= 3 ? `$${10 ** (e - 3)}K` : `$${10 ** e}`);
  const tickN = (e: number) => (e >= 6 ? `${10 ** (e - 6)}M` : e >= 3 ? `${10 ** (e - 3)}K` : `${10 ** e}`);
  const order = types.map((t, i) => i).sort((a, b) => types[b].wallets - types[a].wallets); // big bubbles first, small on top
  const h = hover !== null ? types[hover] : null;
  // labels under each bubble; nudge down when two labels would overlap
  const labels = types.map((t, i) => ({ i, x: x(lx[i]), y: y(ly[i]) + r(t.wallets) + 13, w: t.name.length * 6.4 }));
  const placed: typeof labels = [];
  for (const l of [...labels].sort((a, b) => a.y - b.y)) {
    while (placed.some((p) => Math.abs(p.y - l.y) < 14 && Math.abs(p.x - l.x) < (p.w + l.w) / 2 + 4)) l.y += 14;
    placed.push(l);
  }
  const labelY = new Map(placed.map((l) => [l.i, Math.min(H - M.b - 2, l.y)]));
  return (
    <div ref={ref} className="relative w-full">
      <svg width={W} height={H} role="img" aria-label="Trader types by typical trades and volume per wallet" className="block">
        {Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i).map((e) => (
          <g key={`y${e}`}>
            <line x1={M.l} x2={W - M.r} y1={y(e)} y2={y(e)} stroke="var(--grid)" />
            <text x={M.l - 8} y={y(e)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--text-muted)">{tickUsd(e)}</text>
          </g>
        ))}
        {Array.from({ length: x1 - x0 + 1 }, (_, i) => x0 + i).map((e) => (
          <text key={`x${e}`} x={x(e)} y={H - M.b + 16} textAnchor="middle" fontSize={11} fill="var(--text-muted)">{tickN(e)}</text>
        ))}
        <text x={W - M.r} y={H - 6} textAnchor="end" fontSize={11} fill="var(--text-muted)">typical trades per wallet →</text>
        <text x={M.l} y={M.t - 10} fontSize={11} fill="var(--text-muted)">↑ typical volume per wallet</text>
        {order.map((i) => {
          const t = types[i];
          return (
            <g key={t.id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="cursor-default">
              <circle cx={x(lx[i])} cy={y(ly[i])} r={r(t.wallets)} fill={`var(--cat-${t.id + 1})`} fillOpacity={hover === null || hover === i ? 0.75 : 0.25} stroke="var(--surface-1)" strokeWidth={2} />
            </g>
          );
        })}
        {types.map((t, i) => (
          <text key={`l${t.id}`} x={x(lx[i])} y={labelY.get(i)} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="var(--text-primary)" stroke="var(--surface-1)" strokeWidth={3} paintOrder="stroke" pointerEvents="none">
            {t.name}
          </text>
        ))}
      </svg>
      {h && hover !== null && (
        <div className="pointer-events-none absolute z-10 rounded-md border border-border bg-surface-1 px-2.5 py-1.5 text-xs shadow-md" style={{ left: Math.min(W - 200, Math.max(0, x(lx[hover]) + r(h.wallets) + 8)), top: Math.max(0, y(ly[hover]) - 30) }}>
          <div className="font-medium text-ink">{h.name}</div>
          <div className="text-ink-2">{int(h.wallets)} wallets · {usd(h.volume)} volume</div>
          <div className="text-ink-3">typical: {int(h.med.trades)} trades, {usd(h.med.volume)}</div>
        </div>
      )}
      <p className="mt-2 text-xs text-ink-3">Bubble position = the typical (median) wallet of each type; bubble size = number of wallets. Log scales.</p>
    </div>
  );
}
