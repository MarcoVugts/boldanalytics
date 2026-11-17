"use client";

import { useMemo, useState } from "react";
import { BarChart, type Series } from "../BarChart";
import { GRAINS, periodLabels, Toggle, type Grain } from "./periods";

type Row = { g: Grain; p: string; bucket: number; volume: number; wallets: number };

/** Volume (or number of wallets) per period, stacked by wallet bucket. Bucket colours run light -> dark blue (small -> large). */
export function BucketChart({ rows, buckets, first, last, what }: { rows: Row[]; buckets: string[]; first: string; last: string; what: string }) {
  const [g, setG] = useState<Grain>("week");
  const [metric, setMetric] = useState<"volume" | "wallets">("volume");
  const [share, setShare] = useState(false);
  const series: Series[] = buckets.map((b, i) => ({ key: b, color: `var(--bk-${i})` }));
  const data = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    for (const r of rows) {
      if (r.g !== g) continue;
      const parts = m.get(r.p) ?? m.set(r.p, {}).get(r.p)!;
      parts[buckets[r.bucket]] = (parts[buckets[r.bucket]] ?? 0) + (metric === "volume" ? r.volume : r.wallets);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([x, parts]) => {
      const tot = Object.values(parts).reduce((s, v) => s + v, 0);
      const p = share && tot > 0 ? Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, (v / tot) * 100])) : parts;
      return { x, y: share ? 100 : tot, parts: p };
    });
  }, [rows, g, metric, share, buckets]);
  const { tick, long } = periodLabels(g, first, last);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Toggle label="Period" options={GRAINS} value={g} onChange={setG} />
        <Toggle label="Measure" options={[{ key: "volume" as const, label: "Volume" }, { key: "wallets" as const, label: "Wallets" }]} value={metric} onChange={setMetric} />
        <Toggle label="Scale" options={[{ key: false, label: "Total" }, { key: true, label: "% share" }]} value={share} onChange={setShare} />
      </div>
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
        <li className="text-ink-3">{what}:</li>
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
            {s.key}
          </li>
        ))}
      </ul>
      <BarChart
        key={g + metric + share}
        unit={share ? "pct" : metric === "volume" ? "usd" : "count"}
        height={300}
        label={`${metric === "volume" ? "Volume" : "Wallets"} per ${g} by ${what.toLowerCase()}`}
        series={series}
        tickLabel={tick}
        longLabel={long}
        data={data}
      />
    </div>
  );
}
