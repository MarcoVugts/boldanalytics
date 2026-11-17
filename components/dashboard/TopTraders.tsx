import { EntityLogo } from "../EntityLogo";
import { int, num, usd } from "@/lib/format";
import type { TopTrader } from "@/lib/queries/traders";

const KIND: Record<string, string> = { market_maker: "market maker", dex_router: "DEX router", aggregator: "aggregator", smart_wallet: "smart wallet", bot: "bot", app: "app" };
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Wallets with the most trades: activity, volume, main operator and the stocks they trade most. */
export function TopTraders({ rows }: { rows: TopTrader[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-ink-3">
          <tr className="border-b border-border">
            <th className="py-2 pr-3 font-normal">#</th>
            <th className="py-2 pr-3 font-normal">Wallet</th>
            <th className="py-2 pr-3 font-normal">Trades through</th>
            <th className="py-2 pr-3 text-right font-normal">Trades</th>
            <th className="py-2 pr-3 text-right font-normal">Volume</th>
            <th className="hidden py-2 pr-3 text-right font-normal md:table-cell">Avg trade</th>
            <th className="hidden py-2 pr-3 text-right font-normal md:table-cell">Active days</th>
            <th className="py-2 font-normal">Mostly trades</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.wallet} className="border-b border-border last:border-0">
              <td className="py-2 pr-3 tabular-nums text-ink-3">{i + 1}</td>
              <td className="py-2 pr-3">
                <a href={`https://basescan.org/address/${r.wallet}`} target="_blank" rel="noreferrer" className="whitespace-nowrap font-mono text-xs hover:underline" title={r.wallet}>
                  {short(r.wallet)}
                </a>
              </td>
              <td className="py-2 pr-3">
                <span className="whitespace-nowrap">{r.op}</span>
                {KIND[r.kind] && <span className="ml-1.5 hidden whitespace-nowrap rounded bg-surface-0 px-1.5 py-0.5 text-[11px] text-ink-3 sm:inline">{KIND[r.kind]}</span>}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">{num(r.trades)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{usd(r.volume)}</td>
              <td className="hidden py-2 pr-3 text-right tabular-nums text-ink-2 md:table-cell">{usd(r.trades > 0 ? r.volume / r.trades : 0)}</td>
              <td className="hidden py-2 pr-3 text-right tabular-nums text-ink-2 md:table-cell">{int(r.days)}</td>
              <td className="py-2">
                <span className="flex items-center gap-2.5">
                  {r.top.map((t) => (
                    <span key={t.symbol} className="flex items-center gap-1 whitespace-nowrap text-xs" title={`${t.symbol}: ${(t.share * 100).toFixed(0)}% of its volume`}>
                      <EntityLogo kind="stock" name={t.symbol} size={16} />
                      <span className="font-medium">{t.symbol}</span>
                      <span className="text-ink-3">{(t.share * 100).toFixed(0)}%</span>
                    </span>
                  ))}
                  {r.stocks > r.top.length && <span className="text-xs text-ink-3">+{r.stocks - r.top.length}</span>}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
