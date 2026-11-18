import type { Metadata } from "next";
import { ShareCard } from "@/components/ShareCard";
import { TypeMap } from "@/components/dashboard/TypeMap";
import { TraitGrid } from "@/components/dashboard/TraitGrid";
import { TypeCards } from "@/components/dashboard/TypeCards";
import { int } from "@/lib/format";
import { getOverview } from "@/lib/queries/trades";
import { getTraderTypes, NAMING } from "@/lib/queries/clusters";

export const metadata: Metadata = { title: "Trader types · Tokenized Stocks on Base" };

export default async function TraderTypes() {
  const [overview, tt] = await Promise.all([getOverview(), getTraderTypes()]);
  if (!overview?.last_day || !tt) return null;
  const range = { asOf: overview.last_day ?? undefined, from: overview.first_day ?? undefined };
  return (
    <div className="space-y-6">
      <div className="max-w-3xl space-y-1">
        <h2 className="text-lg font-semibold">Who are the traders?</h2>
        <p className="text-sm text-ink-2">
          All {int(tt.wallets)} wallets, grouped by how they trade. The groups are not set by hand: clustering (k-means) finds them in the data,
          on size, how often and how regularly wallets trade, trade size, how many stocks, weekend trading, apps and market makers, buying vs
          selling, and crypto-related and meme stocks. The number of groups is chosen by how cleanly they separate. Each group is then named
          from a fixed list of words, one per trait it clearly stands out on (see below).
        </p>
      </div>
      <ShareCard slug="trader-types-map" {...range} title="Trader types at a glance" sub="Every dot is a wallet; similar wallets cluster together into the types. Click a type’s area for its description.">
        <TypeMap points={tt.points} names={tt.types.map((t) => t.name)} />
      </ShareCard>
      <ShareCard slug="trader-types-traits" exportZoom={1} {...range} title="What sets each type apart" sub="The typical value per type; colour shows how far it is from the average wallet">
        <TraitGrid types={tt.types} traits={tt.traits} />
      </ShareCard>
      <TypeCards types={tt.types} />
      <details className="rounded-lg border border-border bg-surface-1 p-4 text-sm">
        <summary className="cursor-pointer font-semibold">How the names are made</summary>
        <p className="mt-2 max-w-3xl text-ink-2">
          The words are fixed, the groups are not. After clustering, every group gets the words whose condition its numbers meet: at most one
          word per trait, one noun (otherwise &ldquo;traders&rdquo;) and its two strongest other words. z is how far the group&apos;s centre sits from
          all wallets, in standard deviations. A group that stands out on nothing is called &ldquo;Typical traders&rdquo;.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="text-ink-3">
              <tr><th className="py-1.5 pr-3 font-medium">Trait</th><th className="py-1.5 pr-3 font-medium">Word</th><th className="py-1.5 font-medium">When a group gets it</th></tr>
            </thead>
            <tbody>
              {NAMING.map((w) => (
                <tr key={w.word} className="border-t border-border">
                  <td className="py-1.5 pr-3 text-ink-3">{w.trait}</td>
                  <td className="py-1.5 pr-3 font-medium">{w.noun ? `… ${w.word}` : `${w.word} …`}</td>
                  <td className="py-1.5 text-ink-2">{w.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="text-xs text-ink-3">Over all loaded days. Groups and names are recomputed as new data comes in.</p>
    </div>
  );
}
