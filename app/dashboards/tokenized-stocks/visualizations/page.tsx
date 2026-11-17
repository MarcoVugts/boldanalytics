import type { Metadata } from "next";
import { Suspense } from "react";
import { ShareCard } from "@/components/ShareCard";
import { FlowSankey } from "@/components/FlowSankey";
import { PressureChart } from "@/components/PressureChart";
import { NetworkGraph } from "@/components/NetworkGraph";
import { CoTradeMatrix } from "@/components/CoTradeMatrix";
import { RecordDay } from "@/components/RecordDay";
import { NetworkGrowthCard } from "@/components/NetworkGrowthCard";
import { getOverview } from "@/lib/queries/trades";
import { getFlows, getNetwork, getPressure, HF_TRADES_PER_DAY } from "@/lib/queries/flows";
import { getCoTrading } from "@/lib/queries/segments";
import { LabelNote } from "../shared";

export const metadata: Metadata = { title: "Visualizations · Tokenized Stocks on Base" };

export default async function Visualizations() {
  const [overview, flows, pressure, cotrade, network] = await Promise.all([getOverview(), getFlows(), getPressure(), getCoTrading(), getNetwork()]);
  if (!overview?.last_day) return null;
  const range = { asOf: overview.last_day ?? undefined, from: overview.first_day ?? undefined };
  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="h-96 rounded-lg border border-border bg-surface-1" />}>
        <NetworkGrowthCard />
      </Suspense>
      <ShareCard slug="how-the-volume-flows" format="wide" {...range} title="How the volume flows" sub="Wallet type → app or operator the transaction went through → DEX that executed it → stock. Hover to follow a path.">
        <FlowSankey rows={flows} />
      </ShareCard>
      <ShareCard slug="buy-sell-pressure" exportZoom={1.1} {...range} title="Buy and sell pressure" sub={`Bought vs sold per stock. High-frequency = wallets with ${HF_TRADES_PER_DAY}+ trades that day (bots, market makers).`}>
        <PressureChart tokens={pressure.tokens} days={pressure.days} />
      </ShareCard>
      <ShareCard slug="traded-together" exportZoom={1} {...range} title="Traded together" sub="Which stocks the same (regular) traders trade. Affinity above 1× means more often together than chance.">
        <CoTradeMatrix data={cotrade} />
      </ShareCard>
      <ShareCard slug="who-trades-what" exportZoom={1} {...range} title="Who trades what" sub="The 60 largest wallets and the stocks they trade. Hover a wallet or stock to see its connections.">
        <NetworkGraph wallets={network.wallets} tokens={network.tokens} edges={network.edges} />
      </ShareCard>
      <RecordDay />
      <LabelNote />
    </div>
  );
}
