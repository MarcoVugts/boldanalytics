import type { Metadata } from "next";
import { ShareCard } from "@/components/ShareCard";
import { PeriodStack, type StackRow } from "@/components/dashboard/PeriodStack";
import { TopTradersSwitch } from "@/components/dashboard/TopTradersSwitch";
import { getOverview } from "@/lib/queries/trades";
import { getTopTraders, getUniqueTraders, getWalletBuckets, TRADE_BUCKETS, VOLUME_BUCKETS } from "@/lib/queries/traders";
import { LabelNote } from "../shared";

export const metadata: Metadata = { title: "Traders · Tokenized Stocks on Base" };

export default async function Traders() {
  const [overview, unique, buckets, top, topNoMM] = await Promise.all([getOverview(), getUniqueTraders(), getWalletBuckets(), getTopTraders(), getTopTraders(25, true)]);
  if (!overview?.last_day) return null;
  const range = { asOf: overview.last_day ?? undefined, from: overview.first_day ?? undefined };
  const span = { first: overview.first_day!, last: overview.last_day! };
  // stocks: the 8 with the most traders (summed over months), the rest as Other
  const perStock = new Map<string, number>();
  for (const r of unique) if (r.g === "month") perStock.set(r.symbol, (perStock.get(r.symbol) ?? 0) + r.wallets);
  const topStocks = [...perStock.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k);
  const stockGroups = [...topStocks.map((k, i) => ({ key: k, color: `var(--cat-${i + 1})` })), { key: "Other", color: "var(--neutral-mark)" }];
  const uniqueRows: StackRow[] = unique.map((r) => ({ g: r.g, p: r.p, k: topStocks.includes(r.symbol) ? r.symbol : "Other", v: r.wallets }));
  const bucketMeasures = (by: "trades" | "volume") => {
    const rows = buckets.filter((r) => r.by === by);
    const make = (f: (r: (typeof rows)[number]) => number): StackRow[] => rows.map((r) => ({ g: r.g, p: r.p, k: String(r.bucket), v: f(r) }));
    return [
      { key: "volume", label: "Volume", unit: "usd" as const, rows: make((r) => r.volume) },
      { key: "trades", label: "Trades", unit: "count" as const, rows: make((r) => r.trades) },
      { key: "wallets", label: "Wallets", unit: "count" as const, rows: make((r) => r.wallets) },
    ];
  };
  const bucketGroups = (labels: string[]) => labels.map((l, i) => ({ key: String(i), label: l, color: `var(--bk-${i})` }));

  return (
    <div className="space-y-6">
      <ShareCard
        slug="unique-traders"
        {...range}
        title="Unique traders"
        sub="Wallets with at least one trade in the period. Split by stock, every wallet counts once: under the stock it traded most in that period."
      >
        <PeriodStack measures={[{ key: "wallets", label: "Traders", unit: "count", rows: uniqueRows }]} groups={stockGroups} groupLabel="stock" {...span} />
      </ShareCard>

      <ShareCard
        slug="wallets-by-number-of-trades"
        {...range}
        title="Wallets grouped by how often they trade"
        sub="Each wallet goes into a group by its number of trades (transactions) in that period: 1, 2–5, 6–20 and up. Show the volume, trades or number of wallets per group. Darker = more trades per wallet."
      >
        <PeriodStack measures={bucketMeasures("trades")} groups={bucketGroups(TRADE_BUCKETS)} groupLabel="trades per wallet" defaultGrain="week" {...span} />
      </ShareCard>

      <ShareCard
        slug="wallets-by-volume"
        {...range}
        title="Wallets grouped by how much they trade"
        sub="Each wallet goes into a group by the USD it traded in that period: under $1K, $1K–10K and up. Show the volume, trades or number of wallets per group. Darker = bigger wallets."
      >
        <PeriodStack measures={bucketMeasures("volume")} groups={bucketGroups(VOLUME_BUCKETS)} groupLabel="volume per wallet" defaultGrain="week" {...span} />
      </ShareCard>

      <ShareCard slug="top-traders" exportZoom={1} {...range} title="Top traders" sub="The 25 wallets with the most trades over all loaded days, the operator they mostly trade through and the stocks they trade most (share of their volume)">
        <TopTradersSwitch all={top} noMM={topNoMM} />
      </ShareCard>
      <LabelNote />
      <p className="text-xs text-ink-3">Trades = transactions. Weeks start on Monday; the first and last period can be partial. Days in UTC.</p>
    </div>
  );
}
