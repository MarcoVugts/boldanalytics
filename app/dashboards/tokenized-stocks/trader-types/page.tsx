import type { Metadata } from "next";
import { ShareCard } from "@/components/ShareCard";
import { TypeScatter } from "@/components/dashboard/TypeScatter";
import { TypeCards } from "@/components/dashboard/TypeCards";
import { int } from "@/lib/format";
import { getOverview } from "@/lib/queries/trades";
import { getTraderTypes } from "@/lib/queries/clusters";

export const metadata: Metadata = { title: "Trader types · Tokenized Stocks on Base" };

export default async function TraderTypes() {
  const [overview, tt] = await Promise.all([getOverview(), getTraderTypes()]);
  if (!overview?.last_day || !tt) return null;
  const range = { asOf: overview.last_day ?? undefined, from: overview.first_day ?? undefined };
  return (
    <div className="space-y-6">
      <div className="max-w-3xl space-y-1">
        <h2 className="text-lg font-semibold">Who are the traders?</h2>
        <p className="text-sm text-ink-2">
          We grouped all {int(tt.wallets)} wallets into {tt.k} types by how they trade: how much and how often, on how many days and how
          regularly, in how many stocks, the size of their trades, weekend trading and whether they trade through a market maker&apos;s contract
          or an app. The groups come from the data (k-means clustering); the names describe what each group has in common.
        </p>
      </div>
      <ShareCard slug="trader-types-map" {...range} title="Trader types at a glance" sub="Each dot is a wallet: number of trades against volume, coloured by type">
        <TypeScatter points={tt.points} names={tt.types.map((t) => t.name)} />
      </ShareCard>
      <TypeCards types={tt.types} />
      <p className="text-xs text-ink-3">
        Over all loaded days. Medians describe a typical wallet in the group; percentages for weekend, market makers and apps are averages
        per wallet. Groups are recomputed as new data comes in, so names and sizes can shift.
      </p>
    </div>
  );
}
