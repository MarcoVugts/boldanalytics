import type { Metadata } from "next";
import { BarChart } from "@/components/BarChart";
import { ShareCard } from "@/components/ShareCard";
import { int, usd } from "@/lib/format";
import { getByDex, getByToken, getDaily, getDailyByToken, getOverview } from "@/lib/queries/trades";
import { GroupTable, TokenBars, milestoneSub, stackDays, weekly } from "../shared";
import { VolumeChart } from "@/components/dashboard/VolumeChart";

export const metadata: Metadata = { title: "Volume · Tokenized Stocks on Base" };

export default async function Volume() {
  const [overview, daily, tokens, dexes, byToken] = await Promise.all([getOverview(), getDaily(), getByToken(), getByDex(), getDailyByToken()]);
  if (!overview?.last_day) return null;
  const range = { asOf: overview.last_day ?? undefined, from: overview.first_day ?? undefined };
  return (
    <div className="space-y-6">
      <ShareCard slug="daily-dex-volume" exportSub="USD, all tokens" {...range} title="Daily DEX volume" sub={milestoneSub(daily)}>
        <VolumeChart {...stackDays(daily, byToken)} markMax="record day" />
      </ShareCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ShareCard slug="weekly-dex-volume" {...range} title="Weekly DEX volume" sub="USD per week (Monday start); the first and last week can be partial">
          <BarChart unit="usd" label="Weekly DEX volume in USD" data={weekly(daily)} />
        </ShareCard>
        <ShareCard slug="volume-by-stock" exportZoom={1} {...range} title="Volume by stock" sub="Top 10 across all loaded days; a stock-to-stock swap counts on both stocks">
          <TokenBars rows={tokens} />
        </ShareCard>
      </div>

      <ShareCard slug="by-dex" {...range} title="By DEX" sub="Where the swap executed (venues grouped, e.g. all Aerodrome pool types)">
        <GroupTable rows={dexes} label="DEX" />
      </ShareCard>

      <details className="rounded-lg border border-border bg-surface-1 p-4 text-sm">
        <summary className="cursor-pointer text-ink-2">Daily data table</summary>
        <table className="mt-3 w-full">
          <thead className="text-left text-xs text-ink-3">
            <tr><th className="py-1 font-normal">Day (UTC)</th><th className="py-1 text-right font-normal">Volume</th><th className="py-1 text-right font-normal">Trades</th><th className="py-1 text-right font-normal">Wallets</th></tr>
          </thead>
          <tbody>
            {[...daily].reverse().map((d) => (
              <tr key={d.day} className="border-t border-border">
                <td className="py-1">{d.day}</td><td className="py-1 text-right">{usd(d.volume_usd)}</td>
                <td className="py-1 text-right">{int(d.trades)}</td><td className="py-1 text-right">{int(d.wallets)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <p className="text-xs text-ink-3">Totals count a stock-to-stock swap (e.g. AAPL → NVDA) once.</p>
    </div>
  );
}
