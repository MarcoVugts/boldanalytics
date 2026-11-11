import type { Metadata } from "next";
import { ShareCard } from "@/components/ShareCard";
import { FlowSankey } from "@/components/FlowSankey";
import { PressureChart } from "@/components/PressureChart";
import { getByEntryContract, getOverview } from "@/lib/queries/trades";
import { getFlows, getPressure, HF_TRADES_PER_DAY } from "@/lib/queries/flows";
import { GroupTable, LabelNote } from "../shared";

export const metadata: Metadata = { title: "Liquidity flow · Tokenized Stocks on Base" };

export default async function LiquidityFlow() {
  const [overview, flows, pressure, entries] = await Promise.all([getOverview(), getFlows(), getPressure(), getByEntryContract()]);
  if (!overview?.last_day) return null;
  const range = { asOf: overview.last_day ?? undefined, from: overview.first_day ?? undefined };
  return (
    <div className="space-y-6">
      <ShareCard slug="how-the-volume-flows" format="wide" {...range} title="How the volume flows" sub="Wallet type → app or operator the transaction went through → DEX that executed it → stock. Hover to follow a path.">
        <FlowSankey rows={flows} />
      </ShareCard>
      <ShareCard slug="buy-sell-pressure" exportZoom={1.1} {...range} title="Buy and sell pressure" sub={`Bought vs sold per stock. High-frequency = wallets with ${HF_TRADES_PER_DAY}+ trades that day (bots, market makers).`}>
        <PressureChart tokens={pressure.tokens} days={pressure.days} />
      </ShareCard>
      <ShareCard slug="by-app-operator" {...range} title="By app / operator" sub="Who the transaction went through: DEX router, aggregator or a trading firm's own contract">
        <GroupTable rows={entries} label="App / operator" />
      </ShareCard>
      <LabelNote />
    </div>
  );
}
