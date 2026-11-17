"use client";

import { useState } from "react";
import { Toggle } from "./periods";
import { TopTraders } from "./TopTraders";
import type { TopTrader } from "@/lib/queries/traders";

/** Top traders with a switch to leave out market makers' wallets (which otherwise fill the list). */
export function TopTradersSwitch({ all, noMM }: { all: TopTrader[]; noMM: TopTrader[] }) {
  const [hide, setHide] = useState(true);
  return (
    <div className="space-y-3">
      <Toggle label="Market makers" options={[{ key: true, label: "Hide market makers" }, { key: false, label: "All wallets" }]} value={hide} onChange={setHide} />
      <TopTraders rows={hide ? noMM : all} />
      {hide && <p className="text-xs text-ink-3">Hidden: wallets that trade mostly through a market maker&apos;s contract (their main operator).</p>}
    </div>
  );
}
