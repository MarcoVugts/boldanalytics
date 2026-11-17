import type { Metadata } from "next";
import { BarChart } from "@/components/BarChart";
import { ShareCard } from "@/components/ShareCard";
import { getDaily, getOverview } from "@/lib/queries/trades";

export const metadata: Metadata = { title: "Traders · Tokenized Stocks on Base" };

export default async function Traders() {
  const [overview, daily] = await Promise.all([getOverview(), getDaily()]);
  if (!overview?.last_day) return null;
  const range = { asOf: overview.last_day ?? undefined, from: overview.first_day ?? undefined };
  return (
    <div className="space-y-6">
      <ShareCard slug="daily-active-wallets" {...range} title="Daily active wallets" sub="Wallets with at least one trade">
        <BarChart unit="count" label="Daily active wallets" data={daily.map((d) => ({ x: d.day, y: d.wallets }))} />
      </ShareCard>
    </div>
  );
}
