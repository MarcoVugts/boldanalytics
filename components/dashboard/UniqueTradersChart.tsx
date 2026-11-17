"use client";

import { useMemo, useState } from "react";
import { BarChart } from "../BarChart";
import { GRAINS, periodLabels, Toggle, type Grain } from "./periods";

type Row = { g: Grain; p: string; symbol: string; wallets: number };

/** Unique wallets per day / week / month, in total or for one stock (a wallet counts once per period). */
export function UniqueTradersChart({ rows, symbols, first, last }: { rows: Row[]; symbols: string[]; first: string; last: string }) {
  const [g, setG] = useState<Grain>("day");
  const [sym, setSym] = useState("*");
  const data = useMemo(() => rows.filter((r) => r.g === g && r.symbol === sym).map((r) => ({ x: r.p, y: r.wallets })), [rows, g, sym]);
  const { tick, long } = periodLabels(g, first, last);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Toggle label="Period" options={GRAINS} value={g} onChange={setG} />
        <label className="flex items-center gap-2 text-xs text-ink-3">
          <span className="sr-only sm:not-sr-only">Stock</span>
          <select
            value={sym}
            onChange={(e) => setSym(e.target.value)}
            className="rounded-md border border-border bg-surface-1 px-2 py-1 text-xs font-medium text-ink"
          >
            <option value="*">All stocks</option>
            {symbols.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <BarChart key={g + sym} unit="count" height={280} label={`Unique traders per ${g}${sym === "*" ? "" : ` in ${sym}`}`} tickLabel={tick} longLabel={long} data={data} />
    </div>
  );
}
