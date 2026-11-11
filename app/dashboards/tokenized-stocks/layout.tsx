import { Suspense } from "react";
import { DashboardTabs, TabRow } from "@/components/dashboard/DashboardTabs";
import { getOverview } from "@/lib/queries/trades";
import { TABS } from "./shared";

export default async function TokenizedStocksLayout({ children }: LayoutProps<"/dashboards/tokenized-stocks">) {
  const overview = await getOverview();
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Dashboard · updated daily</p>
        <h1 className="text-3xl font-bold tracking-tight">Tokenized Stocks on Base</h1>
        <p className="max-w-2xl text-ink-2">
          Onchain DEX trading in tokenized equities, aggregated per wallet, token and day.
          {overview?.last_day && <> Data through {overview.last_day} (UTC).</>}
        </p>
      </header>
      {/* usePathname needs a Suspense boundary with cacheComponents */}
      <Suspense fallback={<TabRow tabs={TABS} />}>
        <DashboardTabs tabs={TABS} />
      </Suspense>
      {!overview?.last_day ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-sm text-ink-2">
          No data loaded yet. Run the loader: <code className="font-mono">GET /api/cron/trades</code>.
        </div>
      ) : (
        children
      )}
    </div>
  );
}
