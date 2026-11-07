// Local stand-in for the Dune API (Dune isn't needed to develop the pipeline/page).
// Usage: node scripts/mock-dune.mjs   then set DUNE_API_BASE=http://localhost:4010/api/v1
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

// Deterministic pseudo-random so reloads look the same.
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

const SYMBOLS = ["AAPL", "NVDA", "TSLA", "META", "GOOGL", "MSFT", "AMZN", "COIN", "MSTR", "HOOD", "AMD", "NFLX", "PLTR", "SPY", "QQQ", "CRCL", "GME", "UBER"];
const WALLETS = Array.from({ length: 1500 }, (_, i) => "0x" + ((i + 1) * 2654435761 % 2 ** 32).toString(16).padStart(40, "a"));
const HF = WALLETS.slice(0, 12); // bots / market makers
const execs = new Map();
const VENUES = [["aerodrome", "2", 0.35], ["uniswap", "4", 0.3], ["uniswap", "3", 0.2], ["pancakeswap", "3", 0.08], ["balancer", "2", 0.04], ["curve", "", 0.03]];
const ENTRIES = Array.from({ length: 14 }, (_, i) => "0x" + (i * 7919 + 4096).toString(16).padStart(40, String((i % 9) + 1)));
const ROUTES = [];
for (const [ei, e] of ENTRIES.entries())
  for (const [vi, [project, version]] of VENUES.entries())
    if ((ei + vi) % 3 !== 1) ROUTES.push({ route: 1e12 + ei * 100 + vi, tx_to: e, project, version, first_day: "2026-08-24" });
// Query ids: DUNE_QUERY_ROUTES must be 2 in .env.local for the mock; anything else = trades.

const pick = (arr, weights) => {
  let x = rnd() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < arr.length; i++) if ((x -= weights[i]) <= 0) return arr[i];
  return arr.at(-1);
};
const routeWeights = ROUTES.map((r) => VENUES.find((v) => v[0] === r.project && v[1] === r.version)[2] / (1 + ENTRIES.indexOf(r.tx_to)) ** 1.2);
const symbolWeights = SYMBOLS.map((_, i) => 1 / (i + 1) ** 1.1);

function rowsFor(start, end) {
  const rows = [];
  for (let d = new Date(start + "T00:00:00Z"); d < new Date(end + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    const weekend = [0, 6].includes(d.getUTCDay());
    const growth = 1 + (d - new Date("2026-08-24")) / 864e5 / 30;
    const mood = Math.sin(d.getTime() / 864e5 / 5); // drifting buy/sell sentiment
    const seen = new Map();
    const add = (wallet, symbol, route, trades, scale, buyBias) => {
      const k = `${wallet}|${symbol}|${route}`;
      const cur = seen.get(k) ?? { day, wallet, symbol, route, trades: 0, swaps: 0, buy_usd: 0, sell_usd: 0, cross_usd: 0, buy_amount: 0, sell_amount: 0 };
      const v = scale * (0.3 + rnd());
      const b = v * Math.min(0.95, Math.max(0.05, 0.5 + buyBias + (rnd() - 0.5) * 0.4));
      cur.trades += trades; cur.swaps += trades; cur.buy_usd += b; cur.sell_usd += v - b;
      cur.buy_amount += b / 200; cur.sell_amount += (v - b) / 200;
      if (rnd() < 0.02) cur.cross_usd += (v - b) * 0.5;
      seen.set(k, cur);
    };
    // bots: many trades, balanced flow, few routes, many symbols
    for (const [hi, w] of HF.entries())
      for (const symbol of SYMBOLS.slice(0, 4 + (hi % 10)))
        add(w, symbol, ROUTES[(hi * 3) % 6].route, Math.round((60 + rnd() * 120) / (1 + SYMBOLS.indexOf(symbol) * 0.2)), 40000 * growth / (1 + SYMBOLS.indexOf(symbol) * 0.3), 0);
    // regular wallets: few trades, directional with the market mood
    const n = Math.round((weekend ? 250 : 700) * growth);
    for (let i = 0; i < n; i++) {
      const wi = 12 + Math.floor(rnd() ** 1.6 * (WALLETS.length - 12));
      const w = WALLETS[wi];
      // taste groups: big tech, crypto-linked, meme/momentum
      const boost = [{ AAPL: 3, MSFT: 3, GOOGL: 3, AMZN: 2, META: 2 }, { COIN: 5, MSTR: 5, HOOD: 4, CRCL: 4 }, { TSLA: 3, GME: 6, PLTR: 4, NVDA: 2 }][wi % 3];
      const symbol = pick(SYMBOLS, symbolWeights.map((x, i) => x * (boost[SYMBOLS[i]] ?? 1)));
      add(w, symbol, pick(ROUTES, routeWeights).route, 1 + Math.floor(rnd() * 3), 800 + rnd() ** 3 * 25000, mood * 0.25 + (symbol === "NVDA" ? 0.1 : symbol === "TSLA" ? -0.12 : 0));
    }
    rows.push(...seen.values());
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
      const rows = m[1] === "2" ? ROUTES : rowsFor(p.start_date.slice(0, 10), p.end_date.slice(0, 10));
      execs.set(id, { rows, at: Date.now(), query_id: Number(m[1]) });
      console.log("execute", m[1], p, "->", rows.length, "rows");
      send(200, { execution_id: id, state: "QUERY_STATE_PENDING" });
    });
    return;
  }
  if (req.method === "POST" && url.pathname.endsWith("/usage")) {
    return send(200, { billing_periods: [{ start_date: "2026-11-01", end_date: "2026-12-01", credits_used: 1234.5, credits_included: 4000 }] });
  }
  if ((m = url.pathname.match(/\/execution\/([^/]+)\/(status|results)$/))) {
    const e = execs.get(m[1]); if (!e) return send(404, { error: "not found" });
    const done = Date.now() - e.at > 4000;
    if (m[2] === "status") return send(200, {
      execution_id: m[1], query_id: e.query_id, is_execution_finished: done,
      state: done ? "QUERY_STATE_COMPLETED" : "QUERY_STATE_EXECUTING",
      execution_cost_credits: done ? Math.round(e.rows.length * 9 / 1000 + 10) / 1 : undefined,
      result_metadata: done ? { row_count: e.rows.length, total_row_count: e.rows.length, datapoint_count: e.rows.length * 11,
        execution_time_millis: 3200, pending_time_millis: 800, total_result_set_bytes: e.rows.length * 114 } : undefined,
    });
    const limit = Number(url.searchParams.get("limit") ?? 1000), offset = Number(url.searchParams.get("offset") ?? 0);
    const next = offset + limit < e.rows.length ? offset + limit : undefined;
    return send(200, { execution_id: m[1], result: { rows: e.rows.slice(offset, offset + limit) }, next_offset: next });
  }
  send(404, { error: "no route" });
}).listen(4010, () => console.log("mock Dune on http://localhost:4010/api/v1"));
