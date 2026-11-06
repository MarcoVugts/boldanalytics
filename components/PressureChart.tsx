"use client";

import { useMemo, useState } from "react";
import { usd } from "@/lib/format";
import type { PressureDay, PressureRow } from "@/lib/queries/flows";
import { useWidth } from "./useWidth";

type Segment = "all" | "regular" | "hf";
const SEGMENTS: { key: Segment; label: string }[] = [
  { key: "all", label: "All wallets" },
  { key: "regular", label: "Regular" },
  { key: "hf", label: "High-frequency" },
];

/**
 * Buy/sell pressure per token: sells extend left, buys right, from a shared zero line.
 * Net (buy − sell) is printed at the end of each row. A segment toggle separates
 * regular wallets from high-frequency ones (bots / market makers).
 */
export function PressureChart({ tokens, days }: { tokens: PressureRow[]; days: PressureDay[] }) {
  const [segment, setSegment] = useState<Segment>("regular");
  const [hover, setHover] = useState<string | null>(null);
  const [ref, width] = useWidth<HTMLDivElement>();

  const rows = useMemo(() => {
    const m = new Map<string, { symbol: string; buy: number; sell: number; wallets: number }>();
    for (const r of tokens) {
      if (segment !== "all" && r.segment !== segment) continue;
      const cur = m.get(r.symbol) ?? { symbol: r.symbol, buy: 0, sell: 0, wallets: 0 };
      cur.buy += r.buy;
      cur.sell += r.sell;
      cur.wallets += r.wallets;
      m.set(r.symbol, cur);
    }
    const list = [...m.values()].sort((a, b) => b.buy + b.sell - (a.buy + a.sell));
    // keep "Other" last
    return [...list.filter((r) => r.symbol !== "Other"), ...list.filter((r) => r.symbol === "Other")];
  }, [tokens, segment]);

  const dayRows = useMemo(() => {
    const m = new Map<string, { day: string; buy: number; sell: number }>();
    for (const d of days) {
      if (segment !== "all" && d.segment !== segment) continue;
      const cur = m.get(d.day) ?? { day: d.day, buy: 0, sell: 0 };
      cur.buy += d.buy;
      cur.sell += d.sell;
      m.set(d.day, cur);
    }
    return [...m.values()].sort((a, b) => a.day.localeCompare(b.day));
  }, [days, segment]);

  const totalBuy = rows.reduce((s, r) => s + r.buy, 0);
  const totalSell = rows.reduce((s, r) => s + r.sell, 0);

  const labelW = 64;
  const netW = 76;
  const rowH = 26;
  const plotW = Math.max(120, width - labelW - netW);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.buy, r.sell)));
  const half = plotW / 2;
  const zero = labelW + half;
  const scale = (v: number) => (v / max) * (half - 4);
  const height = rows.length * rowH + 24;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-border p-0.5 text-xs" role="tablist">
          {SEGMENTS.map((s) => (
            <button
              key={s.key}
              role="tab"
              aria-selected={segment === s.key}
              onClick={() => setSegment(s.key)}
              className={`rounded px-2.5 py-1 ${segment === s.key ? "bg-surface-0 font-medium text-ink" : "text-ink-2 hover:text-ink"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Legend />
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <Kpi label="Bought" value={usd(totalBuy)} />
        <Kpi label="Sold" value={usd(totalSell)} />
        <Kpi
          label="Net flow"
          value={`${totalBuy - totalSell >= 0 ? "+" : "−"}${usd(Math.abs(totalBuy - totalSell))}`}
          note={totalBuy + totalSell > 0 ? `${((totalBuy / (totalBuy + totalSell)) * 100).toFixed(1)}% buys` : undefined}
        />
      </div>

      <div ref={ref} className="relative w-full min-w-0" onMouseLeave={() => setHover(null)}>
        <svg width={width} height={height} role="img" aria-label="Buy and sell volume per token">
          <text x={zero - 6} y={12} textAnchor="end" fontSize={11} fill="var(--text-muted)">← sold</text>
          <text x={zero + 6} y={12} fontSize={11} fill="var(--text-muted)">bought →</text>
          <line x1={zero} x2={zero} y1={18} y2={height} stroke="var(--border)" />
          {rows.map((r, i) => {
            const y = 22 + i * rowH;
            const net = r.buy - r.sell;
            const dim = hover && hover !== r.symbol ? 0.35 : 1;
            return (
              <g key={r.symbol} opacity={dim} onMouseEnter={() => setHover(r.symbol)}>
                <rect x={0} y={y - 2} width={width} height={rowH} fill="transparent" />
                <text x={labelW - 8} y={y + 11} textAnchor="end" fontSize={12} fill="var(--text-primary)">
                  {r.symbol}
                </text>
                <Bar x={zero - 1 - scale(r.sell)} w={scale(r.sell)} y={y + 2} h={rowH - 8} fill="var(--sell)" side="left" />
                <Bar x={zero + 1} w={scale(r.buy)} y={y + 2} h={rowH - 8} fill="var(--buy)" side="right" />
                <text x={width - 4} y={y + 11} textAnchor="end" fontSize={11} fill="var(--text-secondary)">
                  {net >= 0 ? "+" : "−"}
                  {usd(Math.abs(net))}
                </text>
              </g>
            );
          })}
        </svg>
        {hover && (() => {
          const r = rows.find((x) => x.symbol === hover);
          if (!r) return null;
          const i = rows.indexOf(r);
          return (
            <div
              className="pointer-events-none absolute z-10 rounded-md border border-border bg-surface-1 px-2.5 py-1.5 text-xs shadow-sm"
              style={{ left: Math.min(zero + 12, width - 170), top: 22 + (i + 1) * rowH }}
            >
              <div className="font-medium text-ink">{r.symbol}</div>
              <div className="text-ink-2">Bought {usd(r.buy)} · Sold {usd(r.sell)}</div>
              <div className="text-ink-3">{Math.round(r.wallets).toLocaleString("en-US")} wallets</div>
            </div>
          );
        })()}
      </div>

      {dayRows.length > 1 ? (
        <NetFlowDays rows={dayRows} />
      ) : (
        <p className="text-xs text-ink-3">Daily net flow appears here once more than one day is loaded.</p>
      )}
    </div>
  );
}

function Bar({ x, w, y, h, fill, side }: { x: number; w: number; y: number; h: number; fill: string; side: "left" | "right" }) {
  if (w <= 0) return null;
  const r = Math.min(4, w, h / 2);
  // round only the outer end, keep the baseline end square
  const d =
    side === "right"
      ? `M${x},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x} Z`
      : `M${x + w},${y} H${x + r} Q${x},${y} ${x},${y + r} V${y + h - r} Q${x},${y + h} ${x + r},${y + h} H${x + w} Z`;
  return <path d={d} fill={fill} />;
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-xs text-ink-2">
      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-buy" /> Buy</span>
      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-sell" /> Sell</span>
    </div>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-md bg-surface-0 px-3 py-2">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="font-semibold text-ink">{value}</div>
      {note && <div className="text-xs text-ink-3">{note}</div>}
    </div>
  );
}

/** Net flow per day as diverging columns: net buying up (blue), net selling down (red). */
function NetFlowDays({ rows }: { rows: { day: string; buy: number; sell: number }[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = 160;
  const M = { l: 56, r: 8, t: 8, b: 22 };
  const nets = rows.map((r) => r.buy - r.sell);
  const max = Math.max(1, ...nets.map(Math.abs));
  const innerH = H - M.t - M.b;
  const mid = M.t + innerH / 2;
  const slot = (width - M.l - M.r) / rows.length;
  const bw = Math.max(1, slot - (slot > 6 ? 2 : 0));
  const y = (v: number) => (v / max) * (innerH / 2);
  const every = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor((width - M.l) / 70))));
  return (
    <div ref={ref} className="relative w-full min-w-0" onMouseLeave={() => setHover(null)}>
      <div className="mb-1 text-xs text-ink-3">Net flow per day (buy − sell, USD)</div>
      <svg width={width} height={H} role="img" aria-label="Net flow per day">
        {[max, 0, -max].map((t) => (
          <g key={t}>
            <line x1={M.l} x2={width - M.r} y1={mid - y(t)} y2={mid - y(t)} stroke={t === 0 ? "var(--border)" : "var(--grid)"} />
            <text x={M.l - 8} y={mid - y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--text-muted)">
              {t === 0 ? "0" : `${t > 0 ? "+" : "−"}${usd(Math.abs(t))}`}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const v = nets[i];
          const x = M.l + i * slot;
          const h = Math.abs(y(v));
          return (
            <g key={r.day} onMouseEnter={() => setHover(i)}>
              <rect x={x} y={M.t} width={slot} height={innerH} fill="transparent" />
              <rect x={x + (slot - bw) / 2} y={v >= 0 ? mid - h : mid} width={bw} height={h} rx={Math.min(2, bw / 2)}
                fill={v >= 0 ? "var(--buy)" : "var(--sell)"} opacity={hover === null || hover === i ? 1 : 0.4} />
              {i % every === 0 && (
                <text x={x + slot / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--text-muted)">{r.day.slice(5)}</text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-4 z-10 rounded-md border border-border bg-surface-1 px-2.5 py-1.5 text-xs shadow-sm"
          style={{ left: Math.min(Math.max(0, M.l + hover * slot - 60), width - 160) }}>
          <div className="text-ink-3">{rows[hover].day} UTC</div>
          <div className="font-medium text-ink">Net {nets[hover] >= 0 ? "+" : "−"}{usd(Math.abs(nets[hover]))}</div>
          <div className="text-ink-2">Bought {usd(rows[hover].buy)} · Sold {usd(rows[hover].sell)}</div>
        </div>
      )}
    </div>
  );
}
