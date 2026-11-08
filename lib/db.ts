import postgres from "postgres";

// Neon Postgres: the run log (dune_runs). Analytics tables live in MotherDuck (lib/md.ts).
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
