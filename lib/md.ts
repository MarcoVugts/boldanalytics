// MotherDuck (DuckDB) client for the analytics tables, via MotherDuck's Postgres endpoint.
//
// Queries are DuckDB SQL. Values are inlined as escaped literals (see `lit`) and sent with the
// simple query protocol: the endpoint is in preview, and this avoids depending on how it
// handles bound parameters. All inlined values come from our own code (dates, symbols, numbers).
//
// Env:
//   MOTHERDUCK_TOKEN       set by the Vercel MotherDuck integration
//   MOTHERDUCK_PG_HOST     default pg.us-east-1-aws.motherduck.com (same region as Vercel/Neon)
//   MOTHERDUCK_DATABASE    default boldanalytics
//   MD_LOCAL_URL           local dev: postgres://localhost:5433/local (scripts/local-duckdb-pg.py)
import { Pool, type PoolClient } from "pg";

const globalForMd = globalThis as unknown as { mdPool?: Pool };

export const MD_DATABASE = process.env.MOTHERDUCK_DATABASE ?? "boldanalytics";

export const hasMd = () => Boolean(process.env.MOTHERDUCK_TOKEN || process.env.MD_LOCAL_URL);

function makePool() {
  if (process.env.MD_LOCAL_URL) return new Pool({ connectionString: process.env.MD_LOCAL_URL, max: 1 });
  const token = process.env.MOTHERDUCK_TOKEN;
  if (!token) throw new Error("MOTHERDUCK_TOKEN is not set");
  const pool = new Pool({
    host: process.env.MOTHERDUCK_PG_HOST ?? "pg.us-east-1-aws.motherduck.com",
    port: 5432,
    user: "postgres",
    password: token,
    database: MD_DATABASE,
    ssl: { rejectUnauthorized: true },
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
  });
  pool.on("error", (e) => console.error("motherduck pool", e));
  return pool;
}

function pool() {
  globalForMd.mdPool ??= makePool();
  return globalForMd.mdPool;
}

/** A piece of SQL to insert verbatim (identifiers, keywords). Never wrap user input. */
export class Raw {
  constructor(readonly sql: string) {}
}
export const raw = (s: string) => new Raw(s);

export type Lit = string | number | boolean | null | undefined | Raw | readonly (string | number)[];

/** Value -> DuckDB SQL literal. Strings are single-quoted with '' escaping (standard SQL). */
export function lit(v: Lit): string {
  if (v instanceof Raw) return v.sql;
  if (v == null) return "NULL";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error(`non-finite number in SQL: ${v}`);
    return String(v);
  }
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (Array.isArray(v)) return v.length ? `(${v.map((x) => lit(x)).join(", ")})` : "(NULL)";
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** Build SQL text from a template, inlining values as literals. */
export function sqlText(strings: TemplateStringsArray, ...values: Lit[]): string {
  return strings.reduce((acc, s, i) => acc + s + (i < values.length ? lit(values[i]) : ""), "");
}

export async function mdQuery<T>(text: string): Promise<T[]> {
  const res = await pool().query(text);
  // multi-statement text returns an array of results; callers use single statements
  const r = Array.isArray(res) ? res[res.length - 1] : res;
  return (r.rows ?? []).map((row: T) => ({ ...row }));
}

/** md`SELECT ... WHERE day >= ${from}` */
export function md<T>(strings: TemplateStringsArray, ...values: Lit[]): Promise<T[]> {
  return mdQuery<T>(sqlText(strings, ...values));
}

/** Run statements on one connection inside BEGIN/COMMIT. */
export async function mdTx(fn: (exec: (text: string) => Promise<void>) => Promise<void>) {
  const client: PoolClient = await pool().connect();
  try {
    await client.query("BEGIN");
    await fn(async (text) => {
      await client.query(text);
    });
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Normalise an address from Dune/Coinbase to lowercase 0x-hex text (how addresses are stored). */
export function addr(v: unknown): string {
  const s = String(v ?? "").toLowerCase();
  if (!/^0x[0-9a-f]*$/.test(s)) throw new Error(`not a hex address: ${s.slice(0, 60)}`);
  return s;
}
