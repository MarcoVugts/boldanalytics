import { int, usd } from "@/lib/format";
import type { GroupRow, TokenRow } from "@/lib/queries/trades";

// Building blocks shared by the Tokenized Stocks dashboard pages.

export const BASE = "/dashboards/tokenized-stocks";
export const TABS = [
  { href: BASE, label: "Overview" },
  { href: `${BASE}/volume`, label: "Volume" },
  { href: `${BASE}/liquidity-flow`, label: "Liquidity flow" },
  { href: `${BASE}/traders`, label: "Traders" },
  { href: `${BASE}/visuals`, label: "Visuals" },
];

export function GroupTable({ rows, label, mono }: { rows: GroupRow[]; label: string; mono?: boolean }) {
  const total = rows.reduce((s, r) => s + r.volume_usd, 0) || 1;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-ink-3">
          <tr className="border-b border-border">
            <th className="py-2 pr-4 font-normal">{label}</th>
            <th className="py-2 pr-4 text-right font-normal">Volume</th>
            <th className="py-2 pr-4 text-right font-normal">Share</th>
            <th className="py-2 pr-4 text-right font-normal">Swaps</th>
            <th className="py-2 text-right font-normal">Wallets</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-border last:border-0">
              <td className={`py-2 pr-4 ${mono ? "font-mono text-xs" : "font-medium"}`} title={r.key}>
                {mono ? `${r.key.slice(0, 8)}…${r.key.slice(-6)}` : r.key}
                {r.kind && r.kind !== "unknown" && (
                  <span className="ml-2 rounded bg-surface-0 px-1.5 py-0.5 text-[11px] font-normal text-ink-3">{KIND[r.kind] ?? r.kind}</span>
                )}
              </td>
              <td className="py-2 pr-4 text-right">{usd(r.volume_usd)}</td>
              <td className="py-2 pr-4 text-right text-ink-2">{((r.volume_usd / total) * 100).toFixed(1)}%</td>
              <td className="py-2 pr-4 text-right">{int(r.swaps)}</td>
              <td className="py-2 text-right">{int(r.wallets)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const KIND: Record<string, string> = {
  market_maker: "market maker",
  dex_router: "DEX router",
  aggregator: "aggregator",
  smart_wallet: "smart wallets",
  bridge: "bridge",
  multisig: "multisig",
  defi_protocol: "DeFi",
  bot: "bot",
  other: "other",
};

/** "USD, all tokens · Passed $5B total volume on 7 Nov": whole billions, first day the running total crossed it. */
export function milestoneSub(daily: { day: string; volume_usd: number }[]) {
  const base = "USD, all tokens";
  const total = daily.reduce((s, d) => s + d.volume_usd, 0);
  const milestone = Math.floor(total / 1e9);
  if (milestone < 1) return base;
  let run = 0;
  const day = daily.find((d) => (run += d.volume_usd) >= milestone * 1e9)?.day;
  const when = day
    ? ` on ${new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`
    : "";
  return `${base} · Passed $${milestone}B total volume${when}`;
}

/** Compact "by token" view: top N as horizontal bars with share, the rest summed. */
export function TokenBars({ rows, top = 10 }: { rows: TokenRow[]; top?: number }) {
  const total = rows.reduce((s, r) => s + r.volume_usd, 0) || 1;
  const head = rows.slice(0, top);
  const rest = rows.slice(top).reduce((s, r) => s + r.volume_usd, 0);
  const max = head[0]?.volume_usd || 1;
  const list = rest > 0 ? [...head, { symbol: `${rows.length - top} others`, volume_usd: rest, trades: 0, wallets: 0 }] : head;
  return (
    <ul className="space-y-1.5 text-sm">
      {list.map((r, i) => (
        <li key={r.symbol} className="grid grid-cols-[4rem_1fr_8.5rem] items-center gap-3 sm:grid-cols-[4.5rem_1fr_9.5rem]">
          <span className={i < head.length ? "font-medium" : "text-ink-3"}>{r.symbol}</span>
          <span className="h-4 rounded-sm bg-surface-0">
            <span className="block h-full rounded-sm" style={{ width: `${Math.min(100, (r.volume_usd / max) * 100)}%`, background: i < head.length ? "var(--series-1)" : "var(--neutral-mark)" }} />
          </span>
          <span className="text-right tabular-nums text-ink-2">
            {usd(r.volume_usd)} <span className="text-ink-3">· {((r.volume_usd / total) * 100).toFixed(1)}%</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function LabelNote() {
  return (
    <p className="text-xs text-ink-3">
      App labels: &ldquo;(attributed)&rdquo; = identity from third-party labels, not confirmed by the firm. Wintermute: the trading contract shares a multisig
      with a vault that Arkham, Etherscan and the Open Labels Initiative label as Wintermute. &ldquo;(suspected)&rdquo; marks weaker attributions.
      &ldquo;Unknown market maker&rdquo; = trading contracts whose owner we could not identify, labelled by behaviour: they buy and sell almost exactly the same amount
      of each stock (inventory-neutral), like a market maker.
      Other names come from Dune contract metadata. Unlabeled bot = unknown contract with few senders and many trades.
    </p>
  );
}

/** Daily volume aggregated per ISO week (Monday start). */
export function weekly(daily: { day: string; volume_usd: number }[]) {
  const m = new Map<string, number>();
  for (const d of daily) {
    const t = new Date(`${d.day}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
    const k = t.toISOString().slice(0, 10);
    m.set(k, (m.get(k) ?? 0) + d.volume_usd);
  }
  return [...m.entries()].map(([x, y]) => ({ x, y }));
}
