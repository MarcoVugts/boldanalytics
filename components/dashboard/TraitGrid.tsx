import type { Trait, TraderType } from "@/lib/queries/clusters";

// diverging: blue = above the average wallet, orange = below, neutral in between
const cell = (s: number) => {
  const a = Math.min(1, Math.abs(s));
  if (a < 0.08) return { background: "transparent" };
  return { background: `color-mix(in oklab, ${s > 0 ? "var(--series-1)" : "var(--series-2)"} ${Math.round(12 + a * 48)}%, transparent)` };
};

/** Groups × traits: the actual (typical) value, coloured by how far it is from the average wallet. */
export function TraitGrid({ types, traits }: { types: TraderType[]; traits: Trait[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-surface-1 py-1 pr-2 text-left font-normal text-ink-3">Type</th>
            {traits.map((t) => (
              <th key={t.key} className="min-w-14 px-1 py-1 text-center font-normal text-ink-3">{t.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {types.map((ty, i) => (
            <tr key={ty.id}>
              <td className="sticky left-0 bg-surface-1 py-1.5 pr-2">
                <span className="flex items-center gap-1.5 whitespace-nowrap font-medium">
                  <span className="size-2.5 rounded-full" style={{ background: `var(--cat-${ty.id + 1})` }} />
                  {ty.name}
                </span>
              </td>
              {traits.map((t) => (
                <td key={t.key} className="whitespace-nowrap rounded px-1.5 py-1.5 text-center tabular-nums" style={cell(t.scores[i])}>
                  {t.values[i]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm" style={{ background: "color-mix(in oklab, var(--series-1) 50%, transparent)" }} /> above the average wallet</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm" style={{ background: "color-mix(in oklab, var(--series-2) 50%, transparent)" }} /> below</span>
        <span>Sizes are medians (a typical wallet); shares are averages per wallet.</span>
      </p>
    </div>
  );
}
