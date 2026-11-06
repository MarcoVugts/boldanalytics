import type { Metadata } from "next";
import { Stat } from "@/components/Stat";
import { bytes, int, num } from "@/lib/format";
import { getRunTotals, getRuns } from "@/lib/queries/trades";

export const metadata: Metadata = { title: "Ingest runs", robots: { index: false, follow: false } };

const stateColor: Record<string, string> = {
  completed: "text-good",
  failed: "text-critical",
  pending: "text-warning",
};

export default async function Ops() {
  const [runs, totals] = await Promise.all([getRuns(), getRunTotals()]);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Ingest runs &amp; Dune cost</h1>
        <p className="mt-1 text-sm text-ink-2">
          Every Dune execution the loader made. Check credits against dune.com → Settings → Usage.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Runs (all time)" value={int(totals?.runs ?? 0)} />
        <Stat label="Credits, last 30 days" value={totals?.credits_30d != null ? num(totals.credits_30d) : "—"} note="as reported by Dune" />
        <Stat label="Datapoints, last 30 days" value={num(totals?.datapoints_30d ?? 0)} note="rows × columns exported" />
        <Stat label="Database size" value={totals ? bytes(totals.db_bytes) : "—"} note="Neon free: 0.5–1 GB" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface-1">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-ink-3">
            <tr className="border-b border-border">
              {["Started (UTC)", "Dataset", "Window (end excl.)", "Engine", "State", "Rows", "Datapoints", "Credits", "Exec", "Upserted"].map((h) => (
                <th key={h} className="px-3 py-2 font-normal whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 whitespace-nowrap">
                <td className="px-3 py-2">{r.started_at}</td>
                <td className="px-3 py-2">{r.dataset}</td>
                <td className="px-3 py-2">{r.start_date} → {r.end_date}</td>
                <td className="px-3 py-2">{r.performance}</td>
                <td className={`px-3 py-2 font-medium ${stateColor[r.state] ?? ""}`} title={r.error ?? undefined}>
                  {r.state === "completed" ? "✓ " : r.state === "failed" ? "✕ " : "… "}{r.state}
                </td>
                <td className="px-3 py-2 text-right">{r.row_count != null ? int(r.row_count) : "—"}</td>
                <td className="px-3 py-2 text-right">{r.datapoint_count != null ? int(r.datapoint_count) : "—"}</td>
                <td className="px-3 py-2 text-right">{r.cost_credits != null ? num(r.cost_credits) : "—"}</td>
                <td className="px-3 py-2 text-right">{r.execution_ms != null ? `${(r.execution_ms / 1000).toFixed(1)}s` : "—"}</td>
                <td className="px-3 py-2 text-right">{r.rows_upserted != null ? int(r.rows_upserted) : "—"}</td>
              </tr>
            ))}
            {!runs.length && (
              <tr><td colSpan={10} className="px-3 py-6 text-center text-ink-3">No runs yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
