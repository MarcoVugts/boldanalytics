// Local stand-in for the Dune API (Dune isn't needed to develop the pipeline/page).
// Usage: node scripts/mock-dune.mjs   then set DUNE_API_BASE=http://localhost:4010/api/v1
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

const TOKENS = [
  ["0x" + "a1".repeat(20), "AAPL"], ["0x" + "b2".repeat(20), "NVDA"],
  ["0x" + "c3".repeat(20), "META"], ["0x" + "d4".repeat(20), "GOOGL"],
  ["0x" + "e5".repeat(20), "TSLA"],
];
const WALLETS = Array.from({ length: 400 }, (_, i) => "0x" + (i + 1).toString(16).padStart(40, "0"));
const execs = new Map();

function rowsFor(start, end) {
  const rows = [];
  for (let d = new Date(start + "T00:00:00Z"); d < new Date(end + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    const weekend = [0, 6].includes(d.getUTCDay());
    const growth = 1 + (d - new Date("2026-08-24")) / 864e5 / 30;
    for (const [ti, [token, symbol]] of TOKENS.entries()) {
      const n = Math.max(0, Math.round((weekend ? 15 : 40) * growth / (ti + 1)));
      for (const w of WALLETS.slice((ti * 37 + d.getUTCDate() * 11) % 300).slice(0, n)) {
        const buy = Math.random() * 2000 * (ti === 1 ? 2 : 1), sell = Math.random() * 1500;
        rows.push({ day: `${day} 00:00:00.000 UTC`, wallet: w, token, symbol, trades: 1 + Math.floor(Math.random() * 4),
          buy_usd: buy, sell_usd: sell, buy_amount: buy / 200, sell_amount: sell / 200 });
      }
    }
  }
  return rows;
}

createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const send = (code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  let m;
  if (req.method === "POST" && (m = url.pathname.match(/\/query\/(\d+)\/execute$/))) {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const p = JSON.parse(body || "{}").query_parameters ?? {};
      const id = "01MOCK" + randomBytes(6).toString("hex").toUpperCase();
      const rows = rowsFor(p.start_date.slice(0, 10), p.end_date.slice(0, 10));
      execs.set(id, { rows, at: Date.now(), query_id: Number(m[1]) });
      console.log("execute", m[1], p, "->", rows.length, "rows");
      send(200, { execution_id: id, state: "QUERY_STATE_PENDING" });
    });
    return;
  }
  if ((m = url.pathname.match(/\/execution\/([^/]+)\/(status|results)$/))) {
    const e = execs.get(m[1]); if (!e) return send(404, { error: "not found" });
    const done = Date.now() - e.at > 4000;
    if (m[2] === "status") return send(200, {
      execution_id: m[1], query_id: e.query_id, is_execution_finished: done,
      state: done ? "QUERY_STATE_COMPLETED" : "QUERY_STATE_EXECUTING",
      execution_cost_credits: done ? Math.round(e.rows.length * 9 / 1000 + 10) / 1 : undefined,
      result_metadata: done ? { row_count: e.rows.length, total_row_count: e.rows.length, datapoint_count: e.rows.length * 9,
        execution_time_millis: 3200, pending_time_millis: 800, total_result_set_bytes: e.rows.length * 180 } : undefined,
    });
    const limit = Number(url.searchParams.get("limit") ?? 1000), offset = Number(url.searchParams.get("offset") ?? 0);
    const next = offset + limit < e.rows.length ? offset + limit : undefined;
    return send(200, { execution_id: m[1], result: { rows: e.rows.slice(offset, offset + limit) }, next_offset: next });
  }
  send(404, { error: "no route" });
}).listen(4010, () => console.log("mock Dune on http://localhost:4010/api/v1"));
