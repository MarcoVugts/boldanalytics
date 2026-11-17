import type { Metadata } from "next";
import { BarChart } from "@/components/BarChart";
import { ShareCard } from "@/components/ShareCard";
import { VolumeChart } from "@/components/dashboard/VolumeChart";
import { KeyTable } from "@/components/dashboard/KeyTable";
import { Stat } from "@/components/Stat";
import { int, usd } from "@/lib/format";
import { getByEntryContract, getDaily, getDailyBy, getOverview } from "@/lib/queries/trades";
import { avgTradeSize, GroupTable, keyStats, LabelNote, milestoneSub, stackDays } from "../shared";

export const metadata: Metadata = { title: "Volume · Tokenized Stocks on Base" };

export default async function Volume() {
  const [overview, daily, byStock, byDex, entries] = await Promise.all([getOverview(), getDaily(), getDailyBy("symbol"), getDailyBy("dex"), getByEntryContract()]);
  if (!overview?.last_day) return null;
  const range = { asOf: overview.last_day ?? undefined, from: overview.first_day ?? undefined };
  const days = daily.map((d) => d.day);

  // weekday vs weekend (markets closed): average volume per day and share of all volume
  const isWeekend = (d: string) => [0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay());
  const we = daily.filter((d) => isWeekend(d.day)), wd = daily.filter((d) => !isWeekend(d.day));
  const avg = (xs: typeof daily) => xs.reduce((s, d) => s + d.volume_usd, 0) / Math.max(1, xs.length);
  const weShare = we.reduce((s, d) => s + d.volume_usd, 0) / Math.max(1, daily.reduce((s, d) => s + d.volume_usd, 0));
  const avgSize = avgTradeSize(daily);
  const last7Size = avgSize.slice(-7).reduce((s, d) => s + d.y, 0) / Math.max(1, Math.min(7, avgSize.length));

  return (
    <div className="space-y-6">
      <ShareCard slug="dex-volume-by-stock" exportSub="USD, all tokens" {...range} title="Volume by stock" sub={milestoneSub(daily)}>
        <VolumeChart {...stackDays(daily, byStock)} />
      </ShareCard>

      <ShareCard slug="volume-per-stock" exportZoom={1} {...range} title="Per stock" sub="Volume over all loaded days and how it moved recently. A stock-to-stock swap counts on the stock that was bought.">
        <KeyTable rows={keyStats(byStock, days)} kind="stock" label="Stock" show={15} />
      </ShareCard>

      <ShareCard slug="dex-volume-by-dex" exportSub="USD, all tokens" {...range} title="Volume by DEX" sub="Where the swaps executed (venues grouped, e.g. all Aerodrome pool types)">
        <VolumeChart {...stackDays(daily, byDex, 5)} noun="DEX" markMax={false} />
      </ShareCard>

      <ShareCard slug="volume-per-dex" exportZoom={1} {...range} title="Per DEX" sub="Volume over all loaded days and how it moved recently">
        <KeyTable rows={keyStats(byDex, days)} kind="dex" label="DEX" show={8} />
      </ShareCard>

      <ShareCard slug="by-app-operator" {...range} title="By app / operator" sub="Who the transaction went through: DEX router, aggregator or a trading firm's own contract">
        <GroupTable rows={entries} label="App / operator" />
      </ShareCard>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <ShareCard slug="average-trade-size" {...range} title="Average trade size" sub={`USD per swap per day · last 7 days ${usd(last7Size)}`}>
          <BarChart unit="usd" label="Average trade size per day in USD" data={avgSize} />
        </ShareCard>
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface-1 p-4 sm:p-5">
          <h2 className="text-sm font-medium">Markets closed, trading open</h2>
          <p className="text-sm text-ink-2">Tokenized stocks trade onchain on weekends too, while stock exchanges are closed.</p>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Avg per weekday" value={usd(avg(wd))} />
            <Stat label="Avg per weekend day" value={usd(avg(we))} />
          </div>
          <p className="text-sm text-ink-2">
            <span className="font-semibold text-ink">{(weShare * 100).toFixed(1)}%</span> of all volume traded on weekends ({int(we.length)} of {int(daily.length)} days).
          </p>
        </section>
      </div>
      <LabelNote />
      <p className="text-xs text-ink-3">Totals count a stock-to-stock swap (e.g. AAPL → NVDA) once. Days in UTC.</p>
    </div>
  );
}
