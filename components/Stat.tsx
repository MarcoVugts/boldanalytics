export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-1 p-4">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</div>
      {note && <div className="mt-1 text-xs text-ink-3">{note}</div>}
    </div>
  );
}

export function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-border bg-surface-1 p-4">
      <h2 className="text-sm font-medium text-ink">{title}</h2>
      {sub && <p className="mt-0.5 text-xs text-ink-3">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
