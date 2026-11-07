import type { Metadata } from "next";
import { Stat } from "@/components/Stat";
import { bytes, int, num } from "@/lib/format";
import { getClientStatement, getRunTotals, getRuns } from "@/lib/queries/trades";

// What one credit costs on your plan (Analyst: $75 / 4,000). Used for the pass-through statement.
const USD_PER_CREDIT = Number(process.env.DUNE_USD_PER_CREDIT ?? 75 / 4000);
const usd2 = (v: number) => `$${v.toFixed(2)}`;

export const metadata: Metadata = { title: "Ingest runs", robots: { index: false, follow: false } };

const stateColor: Record<string, string> = {
  completed: "text-good",
  failed: "text-critical",
  over_budget: "text-critical",
  pending: "text-warning",
};

export default async function Ops() {
  const [runs, totals, statement] = await Promise.all([getRuns(), getRunTotals(), getClientStatement()]);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Ingest runs &amp; Dune cost</h1>
        <p className="mt-1 text-sm text-ink-2">
          Every Dune execution the loader made. Execution credits come from Dune; export credits are estimated from result size (Analyst: 10 credits per MB).
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Runs (all time)" value={int(totals?.runs ?? 0)} />
        <Stat
          label="Loader credits, last 30 days"
          value={num((totals?.exec_credits_30d ?? 0) + (totals?.export_credits_30d ?? 0))}
          note={`execution ${num(totals?.exec_credits_30d ?? 0)} + export ≈${num(totals?.export_credits_30d ?? 0)}`}
        />
        <Stat
          label="Dune billing period"
          value={totals?.period_used != null ? `${num(totals.period_used)} / ${num(totals.period_included ?? 0)}` : "—"}
          note="all account usage, from Dune /usage"
        />
        <Stat label="Database size" value={totals ? bytes(totals.db_bytes) : "—"} note="Neon free: 0.5–1 GB" />
      </div>

      <section className="space-y-2">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Credits per client</h2>
          <p className="text-sm text-ink-2">
            Per calendar month (UTC), for passing Dune costs through. Cost at ${USD_PER_CREDIT.toFixed(4)} per credit
            (set <code>DUNE_USD_PER_CREDIT</code>). Export credits are estimated from result size; check against the Dune billing period above.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border bg-surface-1">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-3">
              <tr className="border-b border-border">
                {["Month", "Client", "Runs", "Exec credits", "Export ≈", "Total credits", "Cost"].map((h, i) => (
                  <th key={h} className={`px-3 py-2 font-normal whitespace-nowrap ${i > 1 ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statement.map((r) => {
                const total = r.exec_credits + r.export_credits;
                return (
                  <tr key={`${r.month}-${r.client}`} className="border-b border-border last:border-0 whitespace-nowrap">
                    <td className="px-3 py-2">{r.month}</td>
                    <td className="px-3 py-2 font-medium">{r.client}</td>
                    <td className="px-3 py-2 text-right">{int(r.runs)}</td>
                    <td className="px-3 py-2 text-right">{int(r.exec_credits)}</td>
                    <td className="px-3 py-2 text-right">{int(r.export_credits)}</td>
                    <td className="px-3 py-2 text-right font-medium">{int(total)}</td>
                    <td className="px-3 py-2 text-right">{usd2(total * USD_PER_CREDIT)}</td>
                  </tr>
                );
              })}
              {!statement.length && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-ink-3">No runs yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface-1">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-ink-3">
            <tr className="border-b border-border">
              {["Started (UTC)", "By", "Client", "Dataset", "Window (end excl.)", "Engine", "State", "Rows", "Datapoints", "Exec credits", "Export ≈", "Exec", "Upserted"].map((h) => (
                <th key={h} className="px-3 py-2 font-normal whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 whitespace-nowrap">
                <td className="px-3 py-2">{r.started_at}</td>
                <td className="px-3 py-2 text-ink-2">{r.triggered_by ?? "—"}</td>
                <td className="px-3 py-2 text-ink-2">{r.client}</td>
                <td className="px-3 py-2">{r.dataset}</td>
                <td className="px-3 py-2">{r.start_date} → {r.end_date}</td>
                <td className="px-3 py-2">{r.performance}</td>
                <td className={`px-3 py-2 font-medium ${stateColor[r.state] ?? ""}`} title={r.error ?? undefined}>
                  {r.state === "completed" ? "✓ " : r.state === "pending" ? "… " : "✕ "}{r.state}
                </td>
                <td className="px-3 py-2 text-right">{r.row_count != null ? int(r.row_count) : "—"}</td>
                <td className="px-3 py-2 text-right">{r.datapoint_count != null ? int(r.datapoint_count) : "—"}</td>
                <td className="px-3 py-2 text-right">{r.cost_credits != null ? num(r.cost_credits) : "—"}</td>
                <td className="px-3 py-2 text-right">{r.export_credits_est != null ? num(r.export_credits_est) : "—"}</td>
                <td className="px-3 py-2 text-right">{r.execution_ms != null ? `${(r.execution_ms / 1000).toFixed(1)}s` : "—"}</td>
                <td className="px-3 py-2 text-right">{r.rows_upserted != null ? int(r.rows_upserted) : "—"}</td>
              </tr>
            ))}
            {!runs.length && (
              <tr><td colSpan={13} className="px-3 py-6 text-center text-ink-3">No runs yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
