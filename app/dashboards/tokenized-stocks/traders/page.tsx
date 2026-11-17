import type { Metadata } from "next";
import { ShareCard } from "@/components/ShareCard";
import { UniqueTradersChart } from "@/components/dashboard/UniqueTradersChart";
import { BucketChart } from "@/components/dashboard/BucketChart";
import { TopTraders } from "@/components/dashboard/TopTraders";
import { getOverview } from "@/lib/queries/trades";
import { getTopTraders, getUniqueTraders, getWalletBuckets, TRADE_BUCKETS, VOLUME_BUCKETS } from "@/lib/queries/traders";
import { LabelNote } from "../shared";

export const metadata: Metadata = { title: "Traders · Tokenized Stocks on Base" };

export default async function Traders() {
  const [overview, unique, buckets, top] = await Promise.all([getOverview(), getUniqueTraders(), getWalletBuckets(), getTopTraders()]);
  if (!overview?.last_day) return null;
  const range = { asOf: overview.last_day ?? undefined, from: overview.first_day ?? undefined };
  const span = { first: overview.first_day!, last: overview.last_day! };
  // stocks for the selector: most traders first
  const perStock = new Map<string, number>();
  for (const r of unique) if (r.g === "month" && r.symbol !== "*") perStock.set(r.symbol, (perStock.get(r.symbol) ?? 0) + r.wallets);
  const symbols = [...perStock.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);

  return (
    <div className="space-y-6">
      <ShareCard slug="unique-traders" {...range} title="Unique traders" sub="Wallets with at least one trade in the period; a wallet counts once per day, week or month, however often it traded">
        <UniqueTradersChart rows={unique} symbols={symbols} {...span} />
      </ShareCard>

      <ShareCard
        slug="volume-by-trades-per-wallet"
        {...range}
        title="Volume by trades per wallet"
        sub="Each wallet is put in a bucket by how many trades (transactions) it made in that period. Darker = more trades per wallet."
      >
        <BucketChart rows={buckets.filter((r) => r.by === "trades")} buckets={TRADE_BUCKETS} what="Trades per wallet" {...span} />
      </ShareCard>

      <ShareCard
        slug="volume-by-volume-per-wallet"
        {...range}
        title="Volume by volume per wallet"
        sub="Each wallet is put in a bucket by how much it traded (USD) in that period. Darker = bigger wallets."
      >
        <BucketChart rows={buckets.filter((r) => r.by === "volume")} buckets={VOLUME_BUCKETS} what="Volume per wallet" {...span} />
      </ShareCard>

      <ShareCard slug="top-traders" exportZoom={1} {...range} title="Top traders" sub="The 25 wallets with the most trades over all loaded days, the operator they mostly trade through and the stocks they trade most (share of their volume)">
        <TopTraders rows={top} />
      </ShareCard>
      <LabelNote />
      <p className="text-xs text-ink-3">Trades = transactions. Weeks start on Monday; the first and last period can be partial. Days in UTC.</p>
    </div>
  );
}
