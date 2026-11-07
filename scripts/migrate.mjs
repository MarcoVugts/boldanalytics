// Apply sql/migrations/*.sql in order (each once). Usage: node --env-file=.env.local scripts/migrate.mjs
import { readdir, readFile } from "node:fs/promises";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  // Runs as part of `npm run build`; without a database there's nothing to migrate.
  console.log("migrate: DATABASE_URL not set, skipping");
  process.exit(0);
}
const sql = postgres(url, { ssl: /localhost|host=\/tmp/.test(url) ? false : "require", max: 1, onnotice: () => {} });

await sql`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
const done = new Set((await sql`SELECT name FROM schema_migrations`).map((r) => r.name));
const dir = new URL("../sql/migrations/", import.meta.url);

for (const file of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort()) {
  if (done.has(file)) continue;
  const body = await readFile(new URL(file, dir), "utf8");
  await sql.begin(async (tx) => {
    await tx.unsafe(body);
    await tx`INSERT INTO schema_migrations (name) VALUES (${file})`;
  });
  console.log("applied", file);
}
console.log("migrations up to date");

// Seeds (idempotent, re-applied every build): reference data such as app labels.
const seedDir = new URL("../sql/seed/", import.meta.url);
for (const file of (await readdir(seedDir).catch(() => [])).filter((f) => f.endsWith(".sql")).sort()) {
  await sql.unsafe(await readFile(new URL(file, seedDir), "utf8"));
  console.log("seeded", file);
}
await sql.end();
