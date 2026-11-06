"use client";

import { useMemo, useState } from "react";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationNodeDatum } from "d3-force";
import { int, usd } from "@/lib/format";
import type { NetEdge, NetToken, NetWallet } from "@/lib/queries/flows";
import { shortAddr, useWidth } from "./useWidth";

type Node = SimulationNodeDatum & {
  id: string;
  kind: "token" | "wallet";
  label: string;
  volume: number;
  r: number;
  hf?: boolean;
  trades?: number;
  tokens?: number;
};
type Link = { source: string | Node; target: string | Node; volume: number; buy: number; sell: number };

const H = 560;

/** Bipartite network: biggest wallets ↔ the stocks they trade, edge width = volume. */
export function NetworkGraph({ wallets, tokens, edges }: { wallets: NetWallet[]; tokens: NetToken[]; edges: NetEdge[] }) {
  const [ref, width] = useWidth<HTMLDivElement>(800);
  const [hover, setHover] = useState<string | null>(null);
  const W = Math.max(320, width);

  const { nodes, links } = useMemo(() => {
    const maxT = Math.max(1, ...tokens.map((t) => t.volume));
    const maxW = Math.max(1, ...wallets.map((w) => w.volume));
    const nodes: Node[] = [
      ...tokens.map((t) => ({ id: `t:${t.symbol}`, kind: "token" as const, label: t.symbol, volume: t.volume, r: 8 + 18 * Math.sqrt(t.volume / maxT) })),
      ...wallets.map((w) => ({
        id: `w:${w.wallet}`, kind: "wallet" as const, label: w.wallet, volume: w.volume,
        r: 3 + 9 * Math.sqrt(w.volume / maxW), hf: w.hf, trades: w.trades, tokens: w.tokens,
      })),
    ];
    const ids = new Set(nodes.map((n) => n.id));
    const links: Link[] = edges
      .map((e) => ({ source: `w:${e.wallet}`, target: `t:${e.symbol}`, volume: e.volume, buy: e.buy, sell: e.sell }))
      .filter((l) => ids.has(l.source as string) && ids.has(l.target as string));
    const maxE = Math.max(1, ...links.map((l) => l.volume));

    const sim = forceSimulation<Node>(nodes)
      .force("link", forceLink<Node, Link>(links).id((n) => n.id).distance((l) => 60 + 60 * (1 - Math.sqrt(l.volume / maxE))).strength((l) => 0.05 + 0.5 * Math.sqrt(l.volume / maxE)))
      .force("charge", forceManyBody<Node>().strength((n) => (n.kind === "token" ? -1400 : -160)))
      .force("collide", forceCollide<Node>().radius((n) => n.r + (n.kind === "token" ? 14 : 3)))
      .force("x", forceX<Node>(W / 2).strength(0.03))
      .force("y", forceY<Node>(H / 2).strength(0.05))
      .force("center", forceCenter(W / 2, H / 2))
      .stop();
    for (let i = 0; i < 300; i++) sim.tick();
    // Fit the layout into the box, then round so server and browser render identical
    // attributes (float noise between engines otherwise breaks hydration).
    const xs = nodes.map((n) => n.x ?? 0), ys = nodes.map((n) => n.y ?? 0);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const pad = 34;
    const k = Math.min((W - 2 * pad) / Math.max(1, x1 - x0), (H - 2 * pad) / Math.max(1, y1 - y0), 1.6);
    for (const n of nodes) {
      n.x = Math.round((W / 2 + ((n.x ?? 0) - (x0 + x1) / 2) * k) * 10) / 10;
      n.y = Math.round((H / 2 + ((n.y ?? 0) - (y0 + y1) / 2) * k) * 10) / 10;
    }
    return { nodes, links: links as (Link & { source: Node; target: Node })[] };
  }, [wallets, tokens, edges, W]);

  if (!nodes.length) return <div className="py-12 text-center text-sm text-ink-3">No data yet</div>;

  const maxE = Math.max(1, ...links.map((l) => l.volume));
  const neighbors = new Set<string>();
  if (hover) {
    neighbors.add(hover);
    for (const l of links) {
      if (l.source.id === hover) neighbors.add(l.target.id);
      if (l.target.id === hover) neighbors.add(l.source.id);
    }
  }
  const h = hover ? nodes.find((n) => n.id === hover) : null;
  const hEdges = h ? links.filter((l) => l.source.id === h.id || l.target.id === h.id).sort((a, b) => b.volume - a.volume) : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-xs text-ink-2">
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-series-2" /> Stock</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-series-1" /> Wallet</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-neutral-mark" /> High-frequency wallet</span>
        <span className="text-ink-3">Size = volume · line = traded together</span>
      </div>
      <div ref={ref} className="relative w-full min-w-0" onMouseLeave={() => setHover(null)}>
        <svg width={W} height={H} role="img" aria-label="Network of the largest wallets and the stocks they trade">
          <g>
            {links.map((l, i) => {
              const on = !hover || l.source.id === hover || l.target.id === hover;
              return (
                <line key={i} x1={l.source.x} y1={l.source.y} x2={l.target.x} y2={l.target.y}
                  stroke={hover && on ? "var(--series-1)" : "var(--link)"}
                  strokeOpacity={hover ? (on ? 0.7 : 0.05) : 0.25}
                  strokeWidth={0.5 + 4 * Math.sqrt(l.volume / maxE)} />
              );
            })}
          </g>
          {nodes.map((n) => {
            const dim = hover && !neighbors.has(n.id);
            const fill = n.kind === "token" ? "var(--series-2)" : n.hf ? "var(--neutral-mark)" : "var(--series-1)";
            return (
              <g key={n.id} opacity={dim ? 0.2 : 1} onMouseEnter={() => setHover(n.id)} style={{ cursor: "default" }}>
                <circle cx={n.x} cy={n.y} r={n.r + 6} fill="transparent" />
                <circle cx={n.x} cy={n.y} r={n.r} fill={fill} stroke="var(--surface-1)" strokeWidth={2} />
                {n.kind === "token" && (
                  <text x={n.x} y={(n.y ?? 0) + n.r + 12} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text-primary)"
                    stroke="var(--surface-1)" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">
                    {n.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {h && (
          <div className="pointer-events-none absolute z-10 w-56 rounded-md border border-border bg-surface-1 px-2.5 py-2 text-xs shadow-sm"
            style={{ left: Math.min((h.x ?? 0) + 14, W - 236), top: Math.min((h.y ?? 0) + 14, H - 140) }}>
            <div className={`font-medium text-ink ${h.kind === "wallet" ? "font-mono" : ""}`}>{h.kind === "wallet" ? shortAddr(h.label) : h.label}</div>
            <div className="text-ink-2">
              {usd(h.volume)} volume
              {h.kind === "wallet" && <> · {int(h.trades ?? 0)} trades{h.hf ? " · high-frequency" : ""}</>}
            </div>
            <div className="mt-1 space-y-0.5 text-ink-3">
              {hEdges.slice(0, 5).map((l) => {
                const other = l.source.id === h.id ? l.target : l.source;
                return (
                  <div key={other.id} className="flex justify-between gap-2">
                    <span className={other.kind === "wallet" ? "font-mono" : ""}>{other.kind === "wallet" ? shortAddr(other.label) : other.label}</span>
                    <span>{usd(l.volume)}</span>
                  </div>
                );
              })}
              {hEdges.length > 5 && <div>+{hEdges.length - 5} more</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
