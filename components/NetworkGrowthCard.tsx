import { getGrowthGraph } from "@/lib/queries/growth";
import { NetworkGrowth } from "./NetworkGrowth";

/** Card with the live "network grows" visual (data from the cached growth query). */
export async function NetworkGrowthCard() {
  const g = await getGrowthGraph();
  if (!g) return null;
  return (
    <section className="rounded-lg border border-border bg-surface-1 p-4 sm:p-5">
      <h2 className="text-lg font-bold tracking-tight sm:text-xl">The network grows</h2>
      <p className="mt-1 max-w-3xl text-sm text-ink-2">
        Every wallet that traded tokenized stocks on Base, the operator it traded through (market makers, apps and routers),
        the DEX that executed it and the stock, day by day. Wallets appear on their first trade; lines and circles grow with volume.
      </p>
      <div className="mt-4">
        <NetworkGrowth g={g} />
      </div>
    </section>
  );
}
