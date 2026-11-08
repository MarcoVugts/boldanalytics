import { connection } from "next/server";
import { db, hasDb } from "@/lib/db";
import { hasMd, md } from "@/lib/md";

// Plain-text snapshot of /ops (fresh, uncached) to paste into a chat or issue.
// Contains no secrets: run log, credits, MotherDuck stats and the event log.
export async function GET() {
  await connection();
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  const out: string[] = [`# Bold Analytics /ops export, ${now} UTC`];
  const safe = async <T,>(f: () => Promise<T>): Promise<T | string> => {
    try {
      return await f();
    } catch (e) {
      return `(error: ${String(e).slice(0, 200)})`;
    }
  };
  const table = (rows: Record<string, unknown>[]) =>
    rows.length
      ? [Object.keys(rows[0]).join(" | "), ...rows.map((r) => Object.values(r).map((v) => (v == null ? "" : String(v))).join(" | "))].join("\n")
      : "(none)";

  if (hasMd()) {
    const s = await safe(async () => {
      const [r] = await md<Record<string, unknown>>`
        SELECT COUNT(*)::DOUBLE AS rows, COUNT(DISTINCT day)::DOUBLE AS days,
               strftime(MIN(day), '%Y-%m-%d') AS first_day, strftime(MAX(day), '%Y-%m-%d') AS last_day
        FROM trades_daily`;
      return r;
    });
    out.push("", "## MotherDuck trades_daily", typeof s === "string" ? s : table([s]));
    const perDay = await safe(() =>
      md<Record<string, unknown>>`
        SELECT strftime(day, '%Y-%m-%d') AS day, COUNT(*)::INT AS n_rows FROM trades_daily
        GROUP BY day ORDER BY day DESC LIMIT 100`,
    );
    out.push("", "## Rows per day (newest first)", typeof perDay === "string" ? perDay : perDay.map((r) => `${r.day} ${r.n_rows}`).join(", "));
  }

  if (hasDb()) {
    const sql = db();
    const lock = await safe(() => sql`
      SELECT name, to_char(locked_until AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') AS locked_until, locked_until > now() AS held
      FROM job_locks`);
    out.push("", "## Locks", typeof lock === "string" ? lock : table(lock as never));
    const usage = await safe(() => sql`
      SELECT period_credits_used::float8 AS used, period_credits_included::float8 AS included,
             to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS as_of
      FROM dune_runs WHERE period_credits_used IS NOT NULL ORDER BY id DESC LIMIT 1`);
    out.push("", "## Dune billing period (from last completed run)", typeof usage === "string" ? usage : table(usage as never));
    const runs = await safe(() => sql`
      SELECT id, to_char(started_at AT TIME ZONE 'UTC', 'MM-DD HH24:MI') AS started, triggered_by AS by, client, dataset,
             to_char(start_date, 'YYYY-MM-DD') || '→' || to_char(end_date, 'YYYY-MM-DD') AS win, state,
             row_count AS dune_rows, rows_upserted AS loaded, load_offset AS off,
             round(cost_credits::numeric, 2) AS exec_cr, export_credits_est AS export_cr,
             round(execution_ms / 1000.0, 1) AS exec_s, left(error, 160) AS error
      FROM dune_runs ORDER BY id DESC LIMIT 30`);
    out.push("", "## Runs (last 30)", typeof runs === "string" ? runs : table(runs as never));
    const events = await safe(() => sql`
      SELECT to_char(at AT TIME ZONE 'UTC', 'MM-DD HH24:MI:SS') AS at, job, link, event, left(detail, 400) AS detail
      FROM job_events ORDER BY id DESC LIMIT 60`);
    out.push("", "## Event log (last 60, newest first)", typeof events === "string" ? events : table(events as never));
  }

  return new Response(out.join("\n") + "\n", {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}
