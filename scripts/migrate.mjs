// Runs in `npm run build` (Vercel) and locally: node --env-file=.env.local scripts/migrate.mjs
//   1. Neon (DATABASE_URL): sql/migrations/*.sql, each once. Holds the run log (dune_runs).
//   2. MotherDuck (MOTHERDUCK_TOKEN, or MD_LOCAL_URL locally): sql/md/*.sql (idempotent) and
//      sql/md/seed/*.sql (re-applied every build). Holds the analytics tables.
//   3. One-time copy of the analytics tables from Neon to MotherDuck while MotherDuck is empty.
import { readdir, readFile } from "node:fs/promises";
import postgres from "postgres";
import pg from "pg";

/* ---------- 1. Neon ---------- */
const url = process.env.DATABASE_URL;
let neon = null;
if (!url) {
  console.log("migrate: DATABASE_URL not set, skipping Neon");
} else {
  neon = postgres(url, { ssl: /localhost|host=\/tmp/.test(url) ? false : "require", max: 1, onnotice: () => {} });
  await neon`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
  const done = new Set((await neon`SELECT name FROM schema_migrations`).map((r) => r.name));
  const dir = new URL("../sql/migrations/", import.meta.url);
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    const body = await readFile(new URL(file, dir), "utf8");
    await neon.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`INSERT INTO schema_migrations (name) VALUES (${file})`;
    });
    console.log("neon: applied", file);
  }
  console.log("neon: migrations up to date");
}

/* ---------- 2. MotherDuck ---------- */
const MD_DB = process.env.MOTHERDUCK_DATABASE ?? "boldanalytics";
const mdConfig = (database) =>
  process.env.MD_LOCAL_URL
    ? { connectionString: process.env.MD_LOCAL_URL }
    : {
        host: process.env.MOTHERDUCK_PG_HOST ?? "pg.us-east-1-aws.motherduck.com",
        port: 5432,
        user: "postgres",
        password: process.env.MOTHERDUCK_TOKEN,
        database,
        ssl: { rejectUnauthorized: true },
        connectionTimeoutMillis: 20_000,
      };

/** Split a .sql file into statements (no semicolons inside our string literals at line ends). */
const statements = (body) =>
  body
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);

if (!process.env.MOTHERDUCK_TOKEN && !process.env.MD_LOCAL_URL) {
  // On Vercel the charts read from MotherDuck: fail the build (the live site stays as it is)
  // rather than deploy a site without data.
  if (process.env.VERCEL) throw new Error("MOTHERDUCK_TOKEN is not set: add the MotherDuck integration to this project");
  console.log("migrate: MOTHERDUCK_TOKEN not set, skipping MotherDuck");
} else {
  if (!process.env.MD_LOCAL_URL) {
    // The database has to exist before we can connect to it by name.
    const boot = new pg.Client(mdConfig("md:"));
    await boot.connect();
    try {
      await boot.query(`CREATE DATABASE IF NOT EXISTS ${MD_DB}`);
    } catch (e) {
      console.warn(`motherduck: could not create database ${MD_DB} (${e.message}); trying to use it as is`);
    }
    await boot.end();
  }
  const md = new pg.Client(mdConfig(MD_DB));
  await md.connect();
  for (const sub of ["", "seed/"]) {
    const dir = new URL(`../sql/md/${sub}`, import.meta.url);
    for (const file of (await readdir(dir).catch(() => [])).filter((f) => f.endsWith(".sql")).sort()) {
      for (const st of statements(await readFile(new URL(file, dir), "utf8"))) await md.query(st);
      console.log(`motherduck: applied ${sub}${file}`);
    }
  }

  /* ---------- 3. one-time copy Neon -> MotherDuck ---------- */
  const [{ n }] = (await md.query("SELECT COUNT(*)::DOUBLE AS n FROM trades_daily")).rows;
  const neonHas = neon && (await neon`SELECT to_regclass('public.trades_daily') IS NOT NULL AS ok`)[0].ok;
  if (n === 0 && neonHas) {
    const lit = (v) =>
      v == null ? "NULL" : typeof v === "number" ? (Number.isFinite(v) ? String(v) : "NULL") : `'${String(v).replace(/'/g, "''")}'`;
    const copy = async (table, cols, select, conflict = "") => {
      const rows = await neon.unsafe(select);
      for (let i = 0; i < rows.length; i += 2000) {
        const values = rows.slice(i, i + 2000).map((r) => `(${cols.map((c) => lit(r[c])).join(", ")})`);
        await md.query(`INSERT INTO ${table} (${cols.join(", ")}) VALUES ${values.join(", ")} ${conflict}`);
      }
      console.log(`motherduck: copied ${rows.length} ${table} rows from Neon`);
    };
    await md.query("BEGIN");
    await copy("tokens", ["symbol", "address", "name", "raw"],
      `SELECT symbol, '0x' || encode(address, 'hex') AS address, name, raw::text AS raw FROM tokens`,
      "ON CONFLICT (symbol) DO NOTHING");
    await copy("routes", ["route", "tx_to", "project", "version", "first_day"],
      `SELECT route::text AS route, '0x' || encode(tx_to, 'hex') AS tx_to, project, version, to_char(first_day, 'YYYY-MM-DD') AS first_day FROM routes`,
      "ON CONFLICT (route) DO NOTHING");
    await copy("trades_daily",
      ["day", "wallet", "symbol", "route", "trades", "swaps", "buy_usd", "sell_usd", "cross_usd", "buy_amount", "sell_amount"],
      `SELECT to_char(day, 'YYYY-MM-DD') AS day, '0x' || encode(wallet, 'hex') AS wallet, symbol, route::text AS route,
              trades, swaps, buy_usd, sell_usd, cross_usd, buy_amount, sell_amount FROM trades_daily`);
    await md.query("COMMIT");
  }
  console.log("motherduck: up to date");
  await md.end();
}
await neon?.end();
