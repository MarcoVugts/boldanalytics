"use client";

import { useMemo, useState } from "react";
import { BarChart, type Series } from "../BarChart";
import { GRAINS, periodLabels, Toggle, type Grain } from "./periods";

export type StackRow = { g: Grain; p: string; k: string; v: number };
export type Measure = { key: string; label: string; unit: "usd" | "count"; rows: StackRow[] };
export type Group = { key: string; label?: string; color: string };

/** Stacked bars per day / week / month with switches: what to show (measure), total or split by group, absolute or % share. */
export function PeriodStack({
  measures,
  groups,
  groupLabel,
  first,
  last,
  defaultGrain = "day",
  allowTotal = true,
  height = 300,
}: {
  measures: Measure[];
  groups: Group[];
  /** what the split is by, shown in the toggle ("By stock") and before the legend */
  groupLabel: string;
  first: string;
  last: string;
  defaultGrain?: Grain;
  allowTotal?: boolean;
  height?: number;
}) {
  const [g, setG] = useState<Grain>(defaultGrain);
  const [mi, setMi] = useState(0);
  const [split, setSplit] = useState(true);
  const [share, setShare] = useState(false);
  const m = measures[mi];
  const series: Series[] = groups.map((gr) => ({ key: gr.label ?? gr.key, color: gr.color }));
  const labelOf = useMemo(() => new Map(groups.map((gr) => [gr.key, gr.label ?? gr.key])), [groups]);
  const data = useMemo(() => {
    const byP = new Map<string, Record<string, number>>();
    for (const r of m.rows) {
      if (r.g !== g) continue;
      const parts = byP.get(r.p) ?? byP.set(r.p, {}).get(r.p)!;
      const k = labelOf.get(r.k) ?? labelOf.get("Other") ?? r.k;
      parts[k] = (parts[k] ?? 0) + r.v;
    }
    return [...byP.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([x, parts]) => {
      const tot = Object.values(parts).reduce((s, v) => s + v, 0);
      if (!split) return { x, y: tot };
      const p = share && tot > 0 ? Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, (v / tot) * 100])) : parts;
      return { x, y: share ? 100 : tot, parts: p };
    });
  }, [m, g, split, share, labelOf]);
  const { tick, long } = periodLabels(g, first, last);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Toggle label="Period" options={GRAINS} value={g} onChange={setG} />
        {measures.length > 1 && <Toggle label="Show" options={measures.map((x, i) => ({ key: i, label: x.label }))} value={mi} onChange={setMi} />}
        {allowTotal && <Toggle label="Split" options={[{ key: false, label: "Total" }, { key: true, label: `By ${groupLabel}` }]} value={split} onChange={setSplit} />}
        {split && <Toggle label="Scale" options={[{ key: false, label: m.unit === "usd" ? "USD" : "Count" }, { key: true, label: "% share" }]} value={share} onChange={setShare} />}
      </div>
      {split && (
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
          <li className="text-ink-3">{groupLabel[0].toUpperCase() + groupLabel.slice(1)}:</li>
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
              {s.key}
            </li>
          ))}
        </ul>
      )}
      <BarChart
        key={`${g}${mi}${split}${share}`}
        unit={split && share ? "pct" : m.unit}
        height={height}
        label={`${m.label} per ${g}${split ? ` by ${groupLabel}` : ""}`}
        series={split ? series : undefined}
        tickLabel={tick}
        longLabel={long}
        data={data}
      />
    </div>
  );
}
