import type { Metadata } from "next";
import Link from "next/link";
import { BarChart } from "@/components/BarChart";
import { ShareCard } from "@/components/ShareCard";
import { Kpi, change } from "@/components/dashboard/Kpi";
import { usd, num } from "@/lib/format";
import { getDaily, getOverview, getWeekStats } from "@/lib/queries/trades";
import { getPressure } from "@/lib/queries/flows";
import { BASE, milestoneSub } from "./shared";

export const metadata: Metadata = {
  title: "Tokenized Stocks on Base",
  description: "Who trades tokenized stocks onchain, how much, and when.",
};

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export default async function Overview() {
  const [overview, daily, week, pressure] = await Promise.all([getOverview(), getDaily(), getWeekStats(), getPressure()]);
  if (!overview?.last_day) return null;

  const last = daily.slice(-7), prev = daily.slice(-14, -7);
  const vol7 = sum(last.map((d) => d.volume_usd)), volPrev = sum(prev.map((d) => d.volume_usd));
  const tr7 = sum(last.map((d) => d.trades)), trPrev = sum(prev.map((d) => d.trades));
  const record = daily.reduce((a, d) => (d.volume_usd > a.volume_usd ? d : a), daily[0]);
  const spark = (k: "volume_usd" | "trades" | "wallets") => daily.slice(-30).map((d) => d[k]);

  // "This week": top stock, biggest riser (ignoring tiny tokens), share of high-frequency wallets in volume.
  const tokens = week?.tokens ?? [];
  const tokTotal = sum(tokens.map((t) => t.cur)) || 1;
  const top = tokens[0];
  const riser = tokens
    .filter((t) => t.prev > 0 && t.cur > tokTotal * 0.01)
    .map((t) => ({ ...t, ch: t.cur / t.prev - 1 }))
    .sort((a, b) => b.ch - a.ch)[0];
  const lastDays = new Set(last.map((d) => d.day));
  const pd = pressure.days.filter((d) => lastDays.has(d.day));
  const hf = sum(pd.filter((d) => d.segment === "hf").map((d) => d.buy + d.sell));
  const hfShare = hf / (sum(pd.map((d) => d.buy + d.sell)) || 1);

  const facts = [
    top && { k: "Most traded", v: top.symbol, s: `${((top.cur / tokTotal) * 100).toFixed(0)}% of volume` },
    riser && { k: "Biggest riser", v: riser.symbol, s: `▲ ${(riser.ch * 100).toFixed(0)}% vs previous week` },
    pd.length > 0 && { k: "High-frequency share", v: `${(hfShare * 100).toFixed(0)}%`, s: "of volume from bots and market makers" },
  ].filter(Boolean) as { k: string; v: string; s: string }[];

  const dives = [
    { href: `${BASE}/volume`, title: "Volume", text: "Per day, per week, per stock and per DEX." },
    { href: `${BASE}/liquidity-flow`, title: "Liquidity flow", text: "How volume flows from wallets via apps and DEXs to stocks, and where buying or selling dominates." },
    { href: `${BASE}/traders`, title: "Traders", text: "Active wallets, which stocks are traded together and who trades what." },
    { href: `${BASE}/visuals`, title: "Visuals", text: "The record day in motion and other visuals, ready to share." },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Volume, last 7 days" value={usd(vol7)} delta={change(vol7, volPrev)} note="vs previous 7 days" spark={spark("volume_usd")} />
        <Kpi label="Trades, last 7 days" value={num(tr7)} delta={change(tr7, trPrev)} note="vs previous 7 days" spark={spark("trades")} />
        <Kpi label="Active wallets, last 7 days" value={num(week?.wallets_cur ?? 0)} delta={week ? change(week.wallets_cur, week.wallets_prev) : null} note="distinct wallets" spark={spark("wallets")} />
        <Kpi label="Total volume" value={usd(overview.volume_usd)} note={`since ${fmtDay(overview.first_day!)} · record ${usd(record.volume_usd)} on ${fmtDay(record.day)}`} />
      </div>

      {facts.length > 0 && (
        <section className="divide-y divide-border rounded-lg border border-border bg-surface-1 sm:grid sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {facts.map((f) => (
            <div key={f.k} className="flex items-baseline justify-between gap-3 p-3 sm:block sm:p-4">
              <div className="text-xs font-medium uppercase tracking-wider text-ink-3">{f.k}<span className="hidden sm:inline"> · this week</span></div>
              <div className="text-right sm:text-left">
                <div className="font-brand text-lg font-extrabold sm:mt-1 sm:text-xl">{f.v}</div>
                <div className="text-xs text-ink-2 sm:text-sm">{f.s}</div>
              </div>
            </div>
          ))}
        </section>
      )}

      <ShareCard slug="daily-dex-volume" exportSub="USD, all tokens" asOf={overview.last_day ?? undefined} from={overview.first_day ?? undefined} title="Daily DEX volume" sub={milestoneSub(daily)}>
        <BarChart unit="usd" label="Daily DEX volume in USD" markMax="record day" data={daily.map((d) => ({ x: d.day, y: d.volume_usd }))} />
      </ShareCard>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Deep dives</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {dives.map((d) => (
            <Link key={d.href} href={d.href} className="group rounded-lg border border-border bg-surface-1 p-3 hover:border-series-1/40 sm:p-4">
              <div className="font-semibold group-hover:underline">{d.title} →</div>
              <p className="mt-1 hidden text-sm text-ink-2 sm:block">{d.text}</p>
            </Link>
          ))}
        </div>
      </section>

      <p className="text-xs text-ink-3">Totals count a stock-to-stock swap (e.g. AAPL → NVDA) once. Weeks compare the last 7 loaded days with the 7 before.</p>
    </div>
  );
}
