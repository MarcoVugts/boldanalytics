import type { Metadata } from "next";
import { BarChart } from "@/components/BarChart";
import { ShareCard } from "@/components/ShareCard";
import { NetworkGraph } from "@/components/NetworkGraph";
import { CoTradeMatrix } from "@/components/CoTradeMatrix";
import { getDaily, getOverview } from "@/lib/queries/trades";
import { getNetwork } from "@/lib/queries/flows";
import { getCoTrading } from "@/lib/queries/segments";
import { LabelNote } from "../shared";

export const metadata: Metadata = { title: "Traders · Tokenized Stocks on Base" };

export default async function Traders() {
  const [overview, daily, cotrade, network] = await Promise.all([getOverview(), getDaily(), getCoTrading(), getNetwork()]);
  if (!overview?.last_day) return null;
  const range = { asOf: overview.last_day ?? undefined, from: overview.first_day ?? undefined };
  return (
    <div className="space-y-6">
      <ShareCard slug="daily-active-wallets" {...range} title="Daily active wallets" sub="Wallets with at least one trade">
        <BarChart unit="count" label="Daily active wallets" data={daily.map((d) => ({ x: d.day, y: d.wallets }))} />
      </ShareCard>
      <ShareCard slug="traded-together" exportZoom={1} {...range} title="Traded together" sub="Which stocks the same (regular) traders trade. Affinity above 1× means more often together than chance.">
        <CoTradeMatrix data={cotrade} />
      </ShareCard>
      <ShareCard slug="who-trades-what" exportZoom={1} {...range} title="Who trades what" sub="The 60 largest wallets and the stocks they trade. Hover a wallet or stock to see its connections.">
        <NetworkGraph wallets={network.wallets} tokens={network.tokens} edges={network.edges} />
      </ShareCard>
      <LabelNote />
    </div>
  );
}
