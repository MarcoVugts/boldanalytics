import { db, hasDb } from "../db";

// Bezoekcijfers voor /beheer uit page_views (zie lib/tracking.ts). Alleen meegetelde weergaven (excluded IS NULL).
// Unieke bezoekers in een periode: bezoeken waarvan het vorige bezoek in die browser vóór de periode lag (of er nooit
// was). Zo telt elke browser één keer per periode, zonder ID. Dagen in Nederlandse tijd.
const TZ = "Europe/Amsterdam";

export type Totals = { k: "today" | "7d" | "30d"; views: number; visits: number; visitors: number; fresh: number };
export type DayRow = { day: string; views: number; visits: number; visitors: number };
export type Row = { k: string; n: number; m?: number };

export async function getVisitStats() {
  if (!hasDb()) return null;
  const sql = db();
  const base = sql`SELECT (at AT TIME ZONE ${TZ})::date AS d, * FROM page_views WHERE excluded IS NULL AND at > now() - interval '32 days'`;
  const [totals, days, pages, sources, devices, excluded] = await Promise.all([
    sql<Totals[]>`
      WITH v AS (${base}), c AS (SELECT (now() AT TIME ZONE ${TZ})::date AS cur),
           w(k, n) AS (VALUES ('today', 0), ('7d', 6), ('30d', 29))
      SELECT w.k,
             COUNT(v.*) FILTER (WHERE v.d >= c.cur - w.n)::int AS views,
             COUNT(v.*) FILTER (WHERE v.entry AND v.d >= c.cur - w.n)::int AS visits,
             COUNT(v.*) FILTER (WHERE v.entry AND v.d >= c.cur - w.n AND (v.visit_gap IS NULL OR v.d - v.visit_gap < c.cur - w.n))::int AS visitors,
             COUNT(v.*) FILTER (WHERE v.entry AND v.d >= c.cur - w.n AND v.visit_no = 1)::int AS fresh
      FROM w CROSS JOIN c LEFT JOIN v ON true
      GROUP BY w.k`,
    sql<DayRow[]>`
      WITH v AS (${base})
      SELECT to_char(g::date, 'YYYY-MM-DD') AS day,
             COUNT(v.*)::int AS views,
             COUNT(v.*) FILTER (WHERE v.entry)::int AS visits,
             COUNT(v.*) FILTER (WHERE v.entry AND (v.visit_gap IS NULL OR v.visit_gap >= 1))::int AS visitors
      FROM generate_series((now() AT TIME ZONE ${TZ})::date - 29, (now() AT TIME ZONE ${TZ})::date, interval '1 day') g
      LEFT JOIN v ON v.d = g::date
      GROUP BY g ORDER BY g`,
    sql<Row[]>`
      WITH v AS (${base}) SELECT path AS k, COUNT(*)::int AS n, COUNT(*) FILTER (WHERE entry)::int AS m
      FROM v WHERE v.d >= (now() AT TIME ZONE ${TZ})::date - 29 GROUP BY 1 ORDER BY 2 DESC LIMIT 12`,
    sql<Row[]>`
      WITH v AS (${base}) SELECT COALESCE(utm, ref, 'direct') AS k, COUNT(*)::int AS n
      FROM v WHERE entry AND v.d >= (now() AT TIME ZONE ${TZ})::date - 29 GROUP BY 1 ORDER BY 2 DESC LIMIT 12`,
    sql<Row[]>`
      WITH v AS (${base}) SELECT COALESCE(device, '?') AS k, COUNT(*)::int AS n
      FROM v WHERE entry AND v.d >= (now() AT TIME ZONE ${TZ})::date - 29 GROUP BY 1 ORDER BY 2 DESC`,
    sql<Row[]>`
      SELECT excluded AS k, COUNT(*)::int AS n FROM page_views
      WHERE excluded IS NOT NULL AND at > now() - interval '30 days' GROUP BY 1 ORDER BY 2 DESC`,
  ]);
  const plain = <T,>(r: readonly T[]) => r.map((x) => ({ ...x }));
  return { totals: plain(totals), days: plain(days), pages: plain(pages), sources: plain(sources), devices: plain(devices), excluded: plain(excluded) };
}
