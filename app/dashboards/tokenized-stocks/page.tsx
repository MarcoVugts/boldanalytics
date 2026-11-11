import type { Metadata } from "next";
import { BarChart } from "@/components/BarChart";
import { Stat } from "@/components/Stat";
import { ShareCard } from "@/components/ShareCard";
import { RecordDay } from "@/components/RecordDay";
import { int, num, usd } from "@/lib/format";
import { getByDex, getByEntryContract, getDaily, getOverview, type GroupRow } from "@/lib/queries/trades";
import { FlowSankey } from "@/components/FlowSankey";
import { NetworkGraph } from "@/components/NetworkGraph";
import { PressureChart } from "@/components/PressureChart";
import { getFlows, getNetwork, getPressure, HF_TRADES_PER_DAY } from "@/lib/queries/flows";
import { getCoTrading } from "@/lib/queries/segments";
import { CoTradeMatrix } from "@/components/CoTradeMatrix";

export const metadata: Metadata = {
  title: "Tokenized Stocks on Base",
  description: "Who trades tokenized stocks onchain, how much, and when.",
};


export default async function TokenizedStocks() {
  const [overview, daily, dexes, entries, pressure, flows, network, cotrade] = await Promise.all([
    getOverview(), getDaily(), getByDex(), getByEntryContract(),
    getPressure(), getFlows(), getNetwork(), getCoTrading(),
  ]);
  const volumeSub = milestoneSub(daily);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Dashboard · updated daily</p>
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
            <Stat label="DEX volume" value={usd(overview.volume_usd)} note="USD, stock-to-stock swaps counted once" />
            <Stat label="Swaps" value={num(overview.trades)} note="dex.trades rows, de-duplicated" />
            <Stat label="Unique wallets" value={num(overview.wallets)} note="by tx sender" />
            <Stat label="Days covered" value={int(daily.length)} note={`${overview.first_day} → ${overview.last_day}`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ShareCard slug="daily-dex-volume" exportSub="USD, all tokens" asOf={overview.last_day ?? undefined} from={overview.first_day ?? undefined} title="Daily DEX volume" sub={volumeSub}>
              <BarChart unit="usd" label="Daily DEX volume in USD" markMax="record day" data={daily.map((d) => ({ x: d.day, y: d.volume_usd }))} />
            </ShareCard>
            <ShareCard slug="daily-active-wallets" asOf={overview.last_day ?? undefined} from={overview.first_day ?? undefined} title="Daily active wallets" sub="Wallets with at least one trade">
              <BarChart unit="count" label="Daily active wallets" data={daily.map((d) => ({ x: d.day, y: d.wallets }))} />
            </ShareCard>
          </div>

          <RecordDay />

          <ShareCard
            slug="buy-sell-pressure"
            exportZoom={1.1}
            asOf={overview.last_day ?? undefined} from={overview.first_day ?? undefined}
            title="Buy and sell pressure"
            sub={`Bought vs sold per stock. High-frequency = wallets with ${HF_TRADES_PER_DAY}+ trades that day (bots, market makers).`}
          >
            <PressureChart tokens={pressure.tokens} days={pressure.days} />
          </ShareCard>

          <ShareCard slug="how-the-volume-flows" format="wide" asOf={overview.last_day ?? undefined} from={overview.first_day ?? undefined} title="How the volume flows" sub="Wallet type → app or operator the transaction went through → DEX that executed it → stock. Hover to follow a path.">
            <FlowSankey rows={flows} />
          </ShareCard>

          <ShareCard slug="traded-together" exportZoom={1} asOf={overview.last_day ?? undefined} from={overview.first_day ?? undefined} title="Traded together" sub="Which stocks the same (regular) traders trade. Affinity above 1× means more often together than chance.">
            <CoTradeMatrix data={cotrade} />
          </ShareCard>

          <ShareCard slug="who-trades-what" exportZoom={1} asOf={overview.last_day ?? undefined} from={overview.first_day ?? undefined} title="Who trades what" sub="The 60 largest wallets and the stocks they trade. Hover a wallet or stock to see its connections.">
            <NetworkGraph wallets={network.wallets} tokens={network.tokens} edges={network.edges} />
          </ShareCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <ShareCard slug="by-dex" asOf={overview.last_day ?? undefined} from={overview.first_day ?? undefined} title="By DEX" sub="Where the swap executed (venues grouped, e.g. all Aerodrome pool types)">
              <GroupTable rows={dexes} label="DEX" />
            </ShareCard>
            <ShareCard slug="by-app-operator" asOf={overview.last_day ?? undefined} from={overview.first_day ?? undefined} title="By app / operator" sub="Who the transaction went through: DEX router, aggregator or a trading firm's own contract">
              <GroupTable rows={entries} label="App / operator" />
            </ShareCard>
          </div>

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
            App labels: &ldquo;(attributed)&rdquo; = identity from third-party labels, not confirmed by the firm. Wintermute: the trading contract shares a multisig
            with a vault that Arkham, Etherscan and the Open Labels Initiative label as Wintermute. &ldquo;(suspected)&rdquo; marks weaker attributions.
            &ldquo;Unknown market maker&rdquo; = trading contracts whose owner we could not identify, labelled by behaviour: they buy and sell almost exactly the same amount
            of each stock (inventory-neutral), like a market maker.
            Other names come from Dune contract metadata. Unlabeled bot = unknown contract with few senders and many trades.
          </p>
          <p className="text-xs text-ink-3">
            Totals count a stock-to-stock swap (e.g. AAPL → NVDA) once.
          </p>
        </>
      )}
    </div>
  );
}

function GroupTable({ rows, label, mono }: { rows: GroupRow[]; label: string; mono?: boolean }) {
  const total = rows.reduce((s, r) => s + r.volume_usd, 0) || 1;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-ink-3">
          <tr className="border-b border-border">
            <th className="py-2 pr-4 font-normal">{label}</th>
            <th className="py-2 pr-4 text-right font-normal">Volume</th>
            <th className="py-2 pr-4 text-right font-normal">Share</th>
            <th className="py-2 pr-4 text-right font-normal">Swaps</th>
            <th className="py-2 text-right font-normal">Wallets</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-border last:border-0">
              <td className={`py-2 pr-4 ${mono ? "font-mono text-xs" : "font-medium"}`} title={r.key}>
                {mono ? `${r.key.slice(0, 8)}…${r.key.slice(-6)}` : r.key}
                {r.kind && r.kind !== "unknown" && (
                  <span className="ml-2 rounded bg-surface-0 px-1.5 py-0.5 text-[11px] font-normal text-ink-3">{KIND[r.kind] ?? r.kind}</span>
                )}
              </td>
              <td className="py-2 pr-4 text-right">{usd(r.volume_usd)}</td>
              <td className="py-2 pr-4 text-right text-ink-2">{((r.volume_usd / total) * 100).toFixed(1)}%</td>
              <td className="py-2 pr-4 text-right">{int(r.swaps)}</td>
              <td className="py-2 text-right">{int(r.wallets)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const KIND: Record<string, string> = {
  market_maker: "market maker",
  dex_router: "DEX router",
  aggregator: "aggregator",
  smart_wallet: "smart wallets",
  bridge: "bridge",
  multisig: "multisig",
  defi_protocol: "DeFi",
  bot: "bot",
  other: "other",
};

/** "USD, all tokens · Passed $5B total volume on 7 Nov": whole billions, first day the running total crossed it. */
function milestoneSub(daily: { day: string; volume_usd: number }[]) {
  const base = "USD, all tokens";
  const total = daily.reduce((s, d) => s + d.volume_usd, 0);
  const milestone = Math.floor(total / 1e9);
  if (milestone < 1) return base;
  let run = 0;
  const day = daily.find((d) => (run += d.volume_usd) >= milestone * 1e9)?.day;
  const when = day
    ? ` on ${new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`
    : "";
  return `${base} · Passed $${milestone}B total volume${when}`;
}
