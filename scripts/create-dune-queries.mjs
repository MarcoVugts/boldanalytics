// Create (or update) the Dune queries from sql/dune/*.sql via the Dune API.
// Needs a Read/Write API key. Usage:
//   node --env-file=.env.local scripts/create-dune-queries.mjs            # create all
//   node --env-file=.env.local scripts/create-dune-queries.mjs --private  # as private queries
// Re-running updates queries whose id is already set in the env:
//   DUNE_QUERY_TRADES / DUNE_QUERY_TRADES_SIZE / DUNE_QUERY_TOP_SENDERS
import { readFile } from "node:fs/promises";

const BASE = process.env.DUNE_API_BASE ?? "https://api.dune.com/api/v1";
const KEY = process.env.DUNE_API_KEY;
if (!KEY) throw new Error("DUNE_API_KEY is not set");
const isPrivate = process.argv.includes("--private");

const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
const today = new Date().toISOString().slice(0, 10);
const params = [
  { key: "start_date", type: "datetime", value: `${yesterday} 00:00:00` },
  { key: "end_date", type: "datetime", value: `${today} 00:00:00` },
];

const QUERIES = [
  { env: "DUNE_QUERY_TRADES_SIZE", file: "trades_daily_size.sql", name: "Tokenized stocks: trades_daily size check" },
  { env: "DUNE_QUERY_TOP_SENDERS", file: "top_senders.sql", name: "Tokenized stocks: top senders" },
  { env: "DUNE_QUERY_TRADES", file: "trades_daily.sql", name: "Tokenized stocks: trades_daily (loader)" },
];

async function call(path, method, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { "X-Dune-API-Key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}: ${text}`);
  return JSON.parse(text);
}

for (const q of QUERIES) {
  const query_sql = await readFile(new URL(`../sql/dune/${q.file}`, import.meta.url), "utf8");
  const body = { name: q.name, description: `Bold Analytics. Source: sql/dune/${q.file}`, query_sql, parameters: params, is_private: isPrivate };
  const existing = process.env[q.env];
  if (existing) {
    await call(`/query/${existing}`, "PATCH", body);
    console.log(`updated ${q.env}=${existing}  https://dune.com/queries/${existing}`);
  } else {
    const { query_id } = await call("/query", "POST", body);
    console.log(`created ${q.env}=${query_id}  https://dune.com/queries/${query_id}`);
  }
}
