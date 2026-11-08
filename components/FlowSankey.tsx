"use client";

import { useMemo, useState } from "react";
import { sankey, sankeyLinkHorizontal, sankeyJustify, type SankeyGraph } from "d3-sankey";
import { usd } from "@/lib/format";
import type { FlowRow } from "@/lib/queries/flows";
import { shortAddr, useWidth } from "./useWidth";
import { useExport } from "./ExportContext";

type N = { id: string; stage: number; label: string };
type L = { source: string; target: string; value: number; segment: string };

const STAGES = ["Wallet type", "App / operator", "DEX", "Stock"];

/** Volume flow: wallet type → contract called (app/router) → DEX venue → stock. */
export function FlowSankey({ rows }: { rows: FlowRow[] }) {
  const [ref, width] = useWidth<HTMLDivElement>(720);
  const [hover, setHover] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string; sub: string } | null>(null);

  const exp = useExport();
  // Image export: use the card width as is (no horizontal scroll) and more height for the labels.
  const W = exp.exporting ? Math.max(420, width) : Math.max(640, width);
  const H = exp.exporting ? 720 : 480;
  // Stock labels sit to the right of the last column, so every gap holds one column of labels.
  const RIGHT = exp.exporting ? 150 : 170;
  const fs = exp.exporting ? 13 : 11;

  const graph = useMemo(() => {
    const nodes = new Map<string, N>();
    const links = new Map<string, L>();
    const node = (stage: number, label: string) => {
      const id = `${stage}:${label}`;
      if (!nodes.has(id)) nodes.set(id, { id, stage, label });
      return id;
    };
    // Links are kept per starting segment, so the colour of the wallet type runs through to the stock.
    const link = (a: string, b: string, v: number, segment: string) => {
      const k = `${a}→${b}|${segment}`;
      const cur = links.get(k) ?? { source: a, target: b, value: 0, segment };
      cur.value += v;
      links.set(k, cur);
    };
    for (const r of rows) {
      const s = node(0, r.segment);
      const e = node(1, r.entry);
      const d = node(2, r.dex);
      const t = node(3, r.symbol);
      link(s, e, r.volume, r.segment);
      link(e, d, r.volume, r.segment);
      link(d, t, r.volume, r.segment);
    }
    if (!nodes.size) return null;
    const layout = sankey<N, L>()
      .nodeId((n) => n.id)
      .nodeAlign(sankeyJustify)
      .nodeWidth(10)
      .nodePadding(10)
      .nodeSort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      // Same segment order in every bundle: high-frequency on top, then regular.
      .linkSort((a, b) => (a.segment === b.segment ? 0 : a.segment === "High-frequency" ? -1 : 1))
      .extent([
        [8, 24],
        [W - RIGHT, H - 8],
      ]);
    return layout({ nodes: [...nodes.values()].map((n) => ({ ...n })), links: [...links.values()].map((l) => ({ ...l })) } as SankeyGraph<N, L>);
  }, [rows, W]);

  if (!graph) return <div className="py-12 text-center text-sm text-ink-3">No data yet</div>;

  const path = sankeyLinkHorizontal();
  const segColor = (seg: string) => (seg === "High-frequency" ? "var(--series-2)" : "var(--series-1)");
  const pct = (v: number) => {
    const p = (v / total) * 100;
    return p < 1 ? "<1%" : `${Math.round(p)}%`;
  };
  const total = graph.nodes.filter((n) => n.stage === 0).reduce((s, n) => s + (n.value ?? 0), 0) || 1;
  const touches = (l: (typeof graph.links)[number]) => {
    if (!hover) return true;
    const s = l.source as N & { id: string };
    const t = l.target as N & { id: string };
    return s.id === hover || t.id === hover;
  };
  const stageX = [0, 1, 2, 3].map((s) => graph.nodes.find((n) => n.stage === s)?.x0 ?? 0);

  return (
    <div className={exp.exporting ? "" : "overflow-x-auto"}>
      <div ref={ref} className={`relative ${exp.exporting ? "" : "min-w-[640px]"}`} onMouseLeave={() => { setHover(null); setTip(null); }}>
        <svg width={W} height={H} role="img" aria-label="Volume flow from wallet type through app and DEX to stock">
          {STAGES.map((s, i) => (
            <text key={s} x={stageX[i]} y={12} textAnchor="start" fontSize={fs} fontWeight={600} fill="var(--text-muted)">
              {s}
            </text>
          ))}
          <g fill="none">
            {graph.links.map((l, i) => {
              const on = touches(l);
              const s = l.source as N;
              const t = l.target as N;
              return (
                <path
                  key={i}
                  d={path(l) ?? undefined}
                  stroke={segColor(l.segment)}
                  strokeOpacity={hover ? (on ? 0.6 : 0.06) : 0.32}
                  strokeWidth={Math.max(1, l.width ?? 1)}
                  onMouseMove={(e) => {
                    const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                    setTip({
                      x: e.clientX - box.left,
                      y: e.clientY - box.top,
                      text: `${shortAddr(s.label)} → ${shortAddr(t.label)}`,
                      sub: `${l.segment} · ${usd(l.value)} · ${((l.value / total) * 100).toFixed(1)}%`,
                    });
                  }}
                  onMouseLeave={() => setTip(null)}
                />
              );
            })}
          </g>
          {graph.nodes.map((n) => {
            const h = Math.max(1, (n.y1 ?? 0) - (n.y0 ?? 0));
            const dim = hover && hover !== n.id && !graph.links.some((l) => touches(l) && ((l.source as N).id === n.id || (l.target as N).id === n.id));
            return (
              <g key={n.id} opacity={dim ? 0.35 : 1} onMouseEnter={() => setHover(n.id)}>
                <rect x={n.x0} y={n.y0} width={(n.x1 ?? 0) - (n.x0 ?? 0)} height={h} rx={2}
                  fill={
                    n.stage === 0
                      ? segColor(n.label)
                      : n.label.startsWith("Other") || n.label === "unknown" || n.label.startsWith("Unlabeled") || n.label === "Unknown"
                        ? "var(--neutral-mark)"
                        : "var(--text-secondary)"
                  } />
                {h > 9 && (() => {
                  // Name on one line, "$value · share" below it when the block is tall enough.
                  const x = (n.x1 ?? 0) + 6;
                  const cy = ((n.y0 ?? 0) + (n.y1 ?? 0)) / 2;
                  const two = h >= fs * 2.2;
                  const halo = { stroke: "var(--surface-1)", strokeWidth: 3, paintOrder: "stroke" as const, strokeLinejoin: "round" as const };
                  const mono = n.label.startsWith("0x") ? "var(--font-geist-mono)" : undefined;
                  return two ? (
                    <text x={x} y={cy} fontSize={fs} fontFamily={mono} {...halo}>
                      <tspan x={x} dy="-0.15em" fill="var(--text-primary)" fontWeight={600}>{shortAddr(n.label)}</tspan>
                      <tspan x={x} dy="1.2em" fill="var(--text-muted)">{usd(n.value ?? 0)} · {pct(n.value ?? 0)}</tspan>
                    </text>
                  ) : (
                    <text x={x} y={cy} dy="0.32em" fontSize={fs} fontFamily={mono} {...halo}>
                      <tspan fill="var(--text-primary)" fontWeight={600}>{shortAddr(n.label)}</tspan>
                      <tspan fill="var(--text-muted)"> {pct(n.value ?? 0)}</tspan>
                    </text>
                  );
                })()}
              </g>
            );
          })}
        </svg>
        {tip && (
          <div className="pointer-events-none absolute z-10 rounded-md border border-border bg-surface-1 px-2.5 py-1.5 text-xs shadow-sm"
            style={{ left: Math.min(tip.x + 12, W - 220), top: tip.y + 12 }}>
            <div className="font-medium text-ink">{tip.text}</div>
            <div className="text-ink-2">{tip.sub}</div>
          </div>
        )}
      </div>
    </div>
  );
}
