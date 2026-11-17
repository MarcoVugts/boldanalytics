import { EntityLogo } from "../EntityLogo";
import { int, usd } from "@/lib/format";
import type { TraderType } from "@/lib/queries/clusters";

const pct = (v: number) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;

/** One card per trader type: size, share of volume, typical behaviour and favourite stocks. */
export function TypeCards({ types }: { types: TraderType[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {types.map((t) => (
        <section key={t.id} className="flex flex-col rounded-lg border border-border bg-surface-1 p-4">
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full" style={{ background: `var(--cat-${t.id + 1})` }} />
            <h3 className="font-semibold">{t.name}</h3>
          </div>
          <p className="mt-1 text-xs text-ink-3">{t.desc}</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-ink-3">Wallets</div>
              <div className="font-brand text-xl font-extrabold tabular-nums">{int(t.wallets)}</div>
              <div className="text-xs text-ink-2">{pct(t.walletShare)} of wallets</div>
            </div>
            <div>
              <div className="text-xs text-ink-3">Volume</div>
              <div className="font-brand text-xl font-extrabold tabular-nums">{usd(t.volume)}</div>
              <div className="text-xs text-ink-2">{pct(t.volumeShare)} of volume</div>
            </div>
          </div>
          {/* wallets vs volume share, side by side */}
          <div className="mt-3 space-y-1 text-[11px] text-ink-3">
            {[["wallets", t.walletShare], ["volume", t.volumeShare]].map(([k, v]) => (
              <div key={k as string} className="grid grid-cols-[3.5rem_1fr] items-center gap-2">
                <span>{k}</span>
                <span className="h-1.5 rounded-full bg-surface-0">
                  <span className="block h-full rounded-full" style={{ width: `${Math.max(1, (v as number) * 100)}%`, background: `var(--cat-${t.id + 1})` }} />
                </span>
              </div>
            ))}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <dt className="text-ink-3">Median volume</dt><dd className="text-right tabular-nums">{usd(t.med.volume)}</dd>
            <dt className="text-ink-3">Median trades</dt><dd className="text-right tabular-nums">{int(t.med.trades)}</dd>
            <dt className="text-ink-3">Median active days</dt><dd className="text-right tabular-nums">{int(t.med.days)}</dd>
            <dt className="text-ink-3">Weekend volume</dt><dd className="text-right tabular-nums">{pct(t.mean.weekend)}</dd>
            <dt className="text-ink-3">Via market makers</dt><dd className="text-right tabular-nums">{pct(t.mean.mm)}</dd>
            <dt className="text-ink-3">Via apps & aggregators</dt><dd className="text-right tabular-nums">{pct(t.mean.agg)}</dd>
          </dl>
          <div className="mt-auto pt-3">
            <div className="text-xs text-ink-3">Favourite stocks</div>
            <div className="mt-1 flex flex-wrap gap-2.5">
              {t.topStocks.map((s) => (
                <span key={s.symbol} className="flex items-center gap-1 text-xs">
                  <EntityLogo kind="stock" name={s.symbol} size={16} />
                  <span className="font-medium">{s.symbol}</span>
                  <span className="text-ink-3">{pct(s.share)}</span>
                </span>
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
