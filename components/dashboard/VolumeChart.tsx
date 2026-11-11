"use client";

import { useState } from "react";
import { BarChart, type Series } from "../BarChart";

type Day = { x: string; y: number; parts: Record<string, number> };

/** Daily volume with a switch between one total bar and bars split by stock (top N + Other). */
export function VolumeChart({ days, symbols, markMax }: { days: Day[]; symbols: string[]; markMax?: string }) {
  const [split, setSplit] = useState(true);
  // Colour follows the stock (fixed order by total volume), Other is neutral and sits on top.
  const series: Series[] = [
    ...symbols.map((s, i) => ({ key: s, color: `var(--cat-${i + 1})` })),
    { key: "Other", color: "var(--neutral-mark)" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="View" className="flex rounded-md border border-border p-0.5 text-xs">
          {[["Total", false], ["By stock", true]].map(([label, v]) => (
            <button
              key={String(label)}
              type="button"
              role="radio"
              aria-checked={split === v}
              onClick={() => setSplit(v as boolean)}
              className={`rounded px-2.5 py-1 font-medium ${split === v ? "bg-series-1/10 text-ink" : "text-ink-3 hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {split && (
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
            {series.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
                {s.key}
              </li>
            ))}
          </ul>
        )}
      </div>
      <BarChart
        unit="usd"
        label={split ? "Daily DEX volume by stock in USD" : "Daily DEX volume in USD"}
        markMax={markMax}
        series={split ? series : undefined}
        data={days}
      />
    </div>
  );
}
