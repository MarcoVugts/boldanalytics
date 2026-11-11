"use client";

import { useEffect, useRef, useState } from "react";
import { num, usd } from "@/lib/format";
import { useExport } from "./ExportContext";

/** `parts`: per-series values for a stacked bar (sum = y). */
type Point = { x: string; y: number; parts?: Record<string, number> };
export type Series = { key: string; color: string };

const BASE_HEIGHT = 220;
const M = { top: 12, right: 8, bottom: 24, left: 56 };

function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0];
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step);
}

const fmtDay = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function BarChart({
  data,
  unit,
  label,
  markMax,
  series,
}: {
  data: Point[];
  unit: "usd" | "count";
  label: string;
  /** Stack each bar by these series (bottom → top), using Point.parts. */
  series?: Series[];
  /** Annotate the highest bar with its value and an arrow (e.g. "record day") */
  markMax?: string;
}) {
  const format = unit === "usd" ? usd : num;
  const exp = useExport();
  // Portrait image export: a taller chart, like the phone layout.
  const HEIGHT = exp.exporting && exp.format === "portrait" ? 330 : BASE_HEIGHT;
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!data.length) {
    return <div className="flex h-[220px] items-center justify-center text-sm text-ink-3">No data yet</div>;
  }

  const maxY = Math.max(...data.map((d) => d.y));
  // Axis ends just above the highest bar (not at the next round tick), so the bars fill the
  // plot; gridlines stay on round values below it.
  const yMax = maxY > 0 ? maxY * 1.06 : 1;
  const ticks = niceTicks(maxY).filter((t) => t <= yMax);
  // Room above the plot for the annotation label.
  const top0 = markMax ? 46 : M.top;
  const innerW = Math.max(10, width - M.left - M.right);
  const innerH = HEIGHT + (markMax ? top0 - M.top : 0) - top0 - M.bottom;
  const H = HEIGHT + (markMax ? top0 - M.top : 0);
  const maxI = data.findIndex((d) => d.y === maxY);
  const slot = innerW / data.length;
  const gap = slot > 6 ? 2 : 0;
  const barW = Math.max(1, slot - gap);
  const y = (v: number) => top0 + innerH - (v / yMax) * innerH;
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerW / 70))));
  const h = hover !== null ? data[hover] : null;

  return (
    <div ref={ref} className="relative w-full min-w-0 overflow-hidden" onMouseLeave={() => setHover(null)}>
      <svg width={width} height={H} role="img" aria-label={label} className="block">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
            <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--text-muted)">
              {format(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = M.left + i * slot + gap / 2;
          const top = y(d.y);
          const hgt = Math.max(0, top0 + innerH - top);
          const r = Math.min(4, barW / 2, hgt);
          const roundTop = (yt: number, hh: number, rr: number) =>
            `M${x},${yt + hh} V${yt + rr} Q${x},${yt} ${x + rr},${yt} H${x + barW - rr} Q${x + barW},${yt} ${x + barW},${yt + rr} V${yt + hh} Z`;
          const stacked = series && d.parts;
          // stacked: segments bottom → top with a 1px surface gap; only the top segment gets rounded corners
          let cum = 0;
          const segs = stacked
            ? series.flatMap((sr) => {
                const v = d.parts![sr.key] ?? 0;
                if (v <= 0) return [];
                const y0 = y(cum), y1 = y(cum + v);
                cum += v;
                return [{ key: sr.key, color: sr.color, y1, h: Math.max(0, y0 - y1) }];
              })
            : [];
          return (
            <g key={d.x} opacity={hover !== null && hover !== i && stacked ? 0.75 : 1}>
              {stacked ? (
                segs.map((sg, k) => {
                  const last = k === segs.length - 1;
                  const hh = Math.max(0, sg.h - (k > 0 && sg.h > 1.5 && barW >= 5 ? 1 : 0));
                  return last ? (
                    <path key={sg.key} d={roundTop(sg.y1, hh, Math.min(4, barW / 2, hh))} fill={sg.color} />
                  ) : (
                    <rect key={sg.key} x={x} y={sg.y1} width={barW} height={hh} fill={sg.color} />
                  );
                })
              ) : (
                <path d={roundTop(top, hgt, r)} fill={hover === i ? "var(--series-1-hover)" : "var(--series-1)"} />
              )}
              {/* hit target: full column height */}
              <rect x={M.left + i * slot} y={top0} width={slot} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} />
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
                  {d.x.slice(5)}
                </text>
              )}
            </g>
          );
        })}
        <line x1={M.left} x2={width - M.right} y1={top0 + innerH} y2={top0 + innerH} stroke="var(--border)" />
        {markMax && maxI >= 0 && (() => {
          // Label up and to the left of the peak bar (to the right if the bar is near the left edge),
          // with a curved arrow ending just above the bar.
          const bx = M.left + maxI * slot + slot / 2;
          const by = y(maxY) - 4;
          const left = bx > M.left + 150;
          const lx = left ? bx - 34 : bx + 34;
          const ly = 16;
          const anchor = left ? "end" : "start";
          const sx = left ? lx + 4 : lx - 4;
          return (
            <g pointerEvents="none">
              <defs>
                <marker id="bc-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L8,4 L0,8 Z" fill="var(--text-primary)" />
                </marker>
              </defs>
              <text x={lx} y={ly} textAnchor={anchor} fontSize={15} fontWeight={700} fill="var(--text-primary)">
                {format(maxY)}
              </text>
              <text x={lx} y={ly + 15} textAnchor={anchor} fontSize={11} fill="var(--text-muted)">
                {markMax} · {fmtDay(data[maxI].x)}
              </text>
              <path
                d={`M${sx},${ly + 2} Q${bx},${ly + 2} ${bx},${by}`}
                fill="none"
                stroke="var(--text-primary)"
                strokeWidth={1.4}
                markerEnd="url(#bc-arrow)"
              />
            </g>
          );
        })()}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-md border border-border bg-surface-1 px-2.5 py-1.5 text-xs shadow-sm"
          style={{
            left: Math.min(Math.max(0, M.left + hover * slot + slot / 2 - 70), width - 150),
          }}
        >
          <div className="text-ink-3">{h.x} UTC</div>
          <div className="font-medium text-ink">{format(h.y)}{series && h.parts ? " total" : ""}</div>
          {series && h.parts && (
            <ul className="mt-1 space-y-0.5">
              {[...series].reverse().filter((sr) => (h.parts![sr.key] ?? 0) > 0).map((sr) => (
                <li key={sr.key} className="flex items-center gap-1.5 text-ink-2">
                  <span className="size-2 rounded-sm" style={{ background: sr.color }} />
                  <span className="w-12">{sr.key}</span>
                  <span className="ml-auto tabular-nums">{format(h.parts![sr.key])}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
