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

const preview = await call(`/execution/${execution_id}/results?limit=5`);
console.log("\nfull status response (look for cost/credit fields):");
console.log(JSON.stringify(s, null, 2));
console.log("\nfirst rows:");
console.table(preview.result?.rows ?? []);
