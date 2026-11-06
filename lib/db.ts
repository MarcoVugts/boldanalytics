import postgres from "postgres";

// One pooled client per server instance. Neon requires SSL; local Postgres doesn't.
const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

function makeClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const local = /localhost|127\.0\.0\.1|host=\/tmp/.test(url);
  return postgres(url, {
    ssl: local ? false : "require",
    max: 5,
    idle_timeout: 20,
    prepare: false, // safe with Neon's pooled (pgbouncer) endpoint
  });
}

export function db(): postgres.Sql {
  globalForDb.sql ??= makeClient();
  return globalForDb.sql;
}

export const hasDb = () => Boolean(process.env.DATABASE_URL);

/** "0xabc…" -> Buffer (bytea). */
export function hexToBytes(hex: string): Buffer {
  return Buffer.from(hex.startsWith("0x") ? hex.slice(2) : hex, "hex");
}

/** Buffer (bytea) -> "0xabc…". */
export function bytesToHex(b: Uint8Array | Buffer | null): string {
  return b ? "0x" + Buffer.from(b).toString("hex") : "";
}
