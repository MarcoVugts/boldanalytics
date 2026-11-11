/** KPI tile: value, change vs the previous period and a small trend line (server component, plain SVG). */
export function Kpi({ label, value, delta, note, spark }: { label: string; value: string; delta?: number | null; note?: string; spark?: number[] }) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-surface-1 p-3 sm:p-4">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="font-brand text-xl font-extrabold tabular-nums sm:text-3xl">{value}</span>
        {delta != null && Number.isFinite(delta) && <Delta value={delta} />}
      </div>
      {note && <div className="mt-0.5 text-xs text-ink-3">{note}</div>}
      {spark && spark.length > 1 && <Spark values={spark} />}
    </div>
  );
}

export function Delta({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span className={`text-xs font-semibold tabular-nums ${up ? "text-good" : "text-critical"}`}>
      {up ? "▲" : "▼"} {Math.abs(value * 100).toFixed(Math.abs(value) < 0.1 ? 1 : 0)}%
    </span>
  );
}

function Spark({ values }: { values: number[] }) {
  const W = 200, H = 36;
  const max = Math.max(...values), min = Math.min(0, ...values);
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => H - 2 - ((v - min) / (max - min || 1)) * (H - 4);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden className="mt-auto h-8 w-full pt-2 sm:h-9">
      <path d={`${line} L${W} ${H} L0 ${H}Z`} fill="var(--series-1)" opacity=".12" />
      <path d={line} fill="none" stroke="var(--series-1)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

/** Relative change, null when there is no previous value. */
export const change = (cur: number, prev: number) => (prev > 0 ? cur / prev - 1 : null);
