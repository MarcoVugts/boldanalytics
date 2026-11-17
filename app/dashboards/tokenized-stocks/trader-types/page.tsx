import type { Metadata } from "next";
import { ShareCard } from "@/components/ShareCard";
import { TypeBubbles } from "@/components/dashboard/TypeBubbles";
import { TypeMap } from "@/components/dashboard/TypeMap";
import { TraitGrid } from "@/components/dashboard/TraitGrid";
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
          All {int(tt.wallets)} wallets, grouped by how they trade. Market makers&apos; wallet fleets, high-frequency bots, whales ($1M+ traded) and dust wallets
          (under $10 traded) are set apart by clear rules. Everyone else is grouped by clustering (k-means) on behaviour: size, how
          often and how regularly they trade, trade size, how many stocks, weekend trading, apps, whether they mostly buy or sell, and how much
          goes into crypto-related and meme stocks.
        </p>
      </div>
      <ShareCard slug="trader-types-map" {...range} title="Trader types at a glance" sub="Every dot is a wallet; similar wallets cluster together into the types">
        <TypeMap points={tt.points} names={tt.types.map((t) => t.name)} />
      </ShareCard>
      <ShareCard slug="trader-types-size" {...range} title="Size of each type" sub="Each bubble is a type: where its typical wallet sits, and how many wallets it holds">
        <TypeBubbles types={tt.types} />
      </ShareCard>
      <ShareCard slug="trader-types-traits" exportZoom={1} {...range} title="What sets each type apart" sub="The typical value per type; colour shows how far it is from the average wallet">
        <TraitGrid types={tt.types} traits={tt.traits} />
      </ShareCard>
      <TypeCards types={tt.types} />
      <p className="text-xs text-ink-3">
        Over all loaded days. Rules: market-maker fleets = more than 80% of trades through a market maker&apos;s contract; high-frequency bots =
        20+ trades per active day on at least 5 days; whales = $1M+ traded; dust = under $10 traded in total. Groups are recomputed as new data comes in.
      </p>
    </div>
  );
}
