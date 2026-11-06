"use client";

import { useEffect, useRef, useState } from "react";
import { num, usd } from "@/lib/format";

type Point = { x: string; y: number };

const HEIGHT = 220;
const M = { top: 12, right: 8, bottom: 24, left: 56 };

function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0];
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step);
}

export function BarChart({
  data,
  unit,
  label,
}: {
  data: Point[];
  unit: "usd" | "count";
  label: string;
}) {
  const format = unit === "usd" ? usd : num;
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

  const ticks = niceTicks(Math.max(...data.map((d) => d.y)));
  const yMax = ticks[ticks.length - 1] || 1;
  const innerW = Math.max(10, width - M.left - M.right);
  const innerH = HEIGHT - M.top - M.bottom;
  const slot = innerW / data.length;
  const gap = slot > 6 ? 2 : 0;
  const barW = Math.max(1, slot - gap);
  const y = (v: number) => M.top + innerH - (v / yMax) * innerH;
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerW / 70))));
  const h = hover !== null ? data[hover] : null;

  return (
    <div ref={ref} className="relative w-full min-w-0 overflow-hidden" onMouseLeave={() => setHover(null)}>
      <svg width={width} height={HEIGHT} role="img" aria-label={label} className="block">
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
          const hgt = Math.max(0, M.top + innerH - top);
          const r = Math.min(4, barW / 2, hgt);
          return (
            <g key={d.x}>
              <path
                d={`M${x},${top + hgt} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + hgt} Z`}
                fill={hover === i ? "var(--series-1-hover)" : "var(--series-1)"}
              />
              {/* hit target: full column height */}
              <rect x={M.left + i * slot} y={M.top} width={slot} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} />
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={HEIGHT - 6} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
                  {d.x.slice(5)}
                </text>
              )}
            </g>
          );
        })}
        <line x1={M.left} x2={width - M.right} y1={M.top + innerH} y2={M.top + innerH} stroke="var(--border)" />
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-md border border-border bg-surface-1 px-2.5 py-1.5 text-xs shadow-sm"
          style={{
            left: Math.min(Math.max(0, M.left + hover * slot + slot / 2 - 60), width - 130),
          }}
        >
          <div className="text-ink-3">{h.x} UTC</div>
          <div className="font-medium text-ink">{format(h.y)}</div>
        </div>
      )}
    </div>
  );
}
