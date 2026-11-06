// Small Dune API test: run the trades query for a short window and report size + cost.
// No database needed. Usage:
//   node --env-file=.env.local scripts/test-dune.mjs [start=yesterday] [end=today] [medium|large]
// Compare with dune.com → Settings → Usage before/after.
const BASE = process.env.DUNE_API_BASE ?? "https://api.dune.com/api/v1";
const KEY = process.env.DUNE_API_KEY;
const QUERY = process.env.DUNE_QUERY_TRADES;
if (!KEY || !QUERY) throw new Error("Set DUNE_API_KEY and DUNE_QUERY_TRADES");

const day = (offset) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
const [start = day(-1), end = day(0), performance = "medium"] = process.argv.slice(2);
const h = { "X-Dune-API-Key": KEY, "Content-Type": "application/json" };
const call = async (path, init) => {
  const r = await fetch(BASE + path, { ...init, headers: h });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
};

const usage = async () => {
  try {
    const u = await call("/usage", { method: "POST", body: "{}" });
    return (u.billing_periods ?? u.billingPeriods)?.at(-1)?.credits_used ?? null;
  } catch { return null; }
};
const usedBefore = await usage();

console.log(`query ${QUERY}  window [${start}, ${end})  engine ${performance}`);
const t0 = Date.now();
const { execution_id } = await call(`/query/${QUERY}/execute`, {
  method: "POST",
  body: JSON.stringify({
    query_parameters: { start_date: `${start} 00:00:00`, end_date: `${end} 00:00:00` },
    performance,
  }),
});
console.log("execution", execution_id);

let s;
do {
  await new Promise((r) => setTimeout(r, 3000));
  s = await call(`/execution/${execution_id}/status`);
  process.stdout.write(`\r${s.state}  ${Math.round((Date.now() - t0) / 1000)}s   `);
} while (/PENDING|EXECUTING/.test(s.state));
console.log();

// Only pull 5 rows here: export is billed per MB, so the test stays cheap.
const preview = await call(`/execution/${execution_id}/results?limit=5`);
const m = s.result_metadata ?? {};
const bytes = m.total_result_set_bytes ?? m.result_set_bytes ?? 0;
const perMb = Number(process.env.DUNE_EXPORT_CREDITS_PER_MB ?? 10);
const usedAfter = await usage();

console.log("\nfirst rows:");
console.table(preview.result?.rows ?? []);
console.log(`
state                 ${s.state}
rows                  ${m.total_row_count ?? m.row_count}
datapoints            ${m.datapoint_count}
result size           ${(bytes / 1e6).toFixed(2)} MB
execution time        ${((m.execution_time_millis ?? 0) / 1000).toFixed(1)}s (+${((m.pending_time_millis ?? 0) / 1000).toFixed(1)}s queued)
execution credits     ${s.execution_cost_credits ?? "not reported"}
export credits (est.) ${((bytes / 1e6) * perMb).toFixed(2)}   ← if the loader pulls all rows (${perMb}/MB)
billing period used   ${usedBefore ?? "?"} → ${usedAfter ?? "?"} (may lag a bit)
`);
if (s.error) console.log("error:", JSON.stringify(s.error, null, 2));
