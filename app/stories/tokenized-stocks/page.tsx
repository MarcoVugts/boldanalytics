import type { Metadata } from "next";
import { BarChart } from "@/components/BarChart";
import { Card, Stat } from "@/components/Stat";
import { int, num, usd } from "@/lib/format";
import { getByToken, getDaily, getOverview } from "@/lib/queries/trades";

export const metadata: Metadata = {
  title: "Tokenized Stocks on Base",
  description: "Who trades tokenized stocks onchain, how much, and when.",
};


export default async function TokenizedStocks() {
  const [overview, daily, tokens] = await Promise.all([getOverview(), getDaily(), getByToken()]);
  const totalVol = tokens.reduce((s, t) => s + t.volume_usd, 0) || 1;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Data story</p>
        <h1 className="text-3xl font-bold tracking-tight">Tokenized Stocks on Base</h1>
        <p className="max-w-2xl text-ink-2">
          DEX trading in tokenized equities, aggregated per wallet, token and day.
          {overview?.last_day && <> Data through {overview.last_day} (UTC).</>}
        </p>
      </header>

      {!overview || !overview.last_day ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-sm text-ink-2">
          No data loaded yet. Run the loader: <code className="font-mono">GET /api/cron/trades</code>.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="DEX volume" value={usd(overview.volume_usd)} note="buy + sell legs, USD" />
            <Stat label="Trades" value={num(overview.trades)} note="one tx = one trade" />
            <Stat label="Unique wallets" value={num(overview.wallets)} note="by tx sender" />
            <Stat label="Days covered" value={int(daily.length)} note={`${overview.first_day} → ${overview.last_day}`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Daily DEX volume" sub="USD, all tokens">
              <BarChart unit="usd" label="Daily DEX volume in USD" data={daily.map((d) => ({ x: d.day, y: d.volume_usd }))} />
            </Card>
            <Card title="Daily active wallets" sub="Wallets with at least one trade">
              <BarChart unit="count" label="Daily active wallets" data={daily.map((d) => ({ x: d.day, y: d.wallets }))} />
            </Card>
          </div>

          <Card title="By token" sub="Volume share across all loaded days">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-ink-3">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4 font-normal">Token</th>
                    <th className="py-2 pr-4 text-right font-normal">Volume</th>
                    <th className="py-2 pr-4 font-normal">Share</th>
                    <th className="py-2 pr-4 text-right font-normal">Trades</th>
                    <th className="py-2 text-right font-normal">Wallets</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((t) => (
                    <tr key={t.symbol} className="border-b border-border last:border-0">
                      <td className="py-2 pr-4 font-medium">{t.symbol}</td>
                      <td className="py-2 pr-4 text-right">{usd(t.volume_usd)}</td>
                      <td className="w-1/3 py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-sm bg-surface-0">
                            <div className="h-2 rounded-sm bg-series-1" style={{ width: `${(t.volume_usd / totalVol) * 100}%` }} />
                          </div>
                          <span className="w-12 text-right text-xs text-ink-2">{((t.volume_usd / totalVol) * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-right">{int(t.trades)}</td>
                      <td className="py-2 text-right">{int(t.wallets)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

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

          <p className="text-xs text-ink-3">
            Volume counts each token leg; a direct token-to-token swap (e.g. AAPL → NVDA) counts on both tokens, so the all-token total is slightly overstated.
          </p>
        </>
      )}
    </div>
  );
}
