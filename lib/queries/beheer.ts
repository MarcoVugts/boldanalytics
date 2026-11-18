import type postgres from "postgres";
import { db, hasDb } from "../db";
import type { StackRow } from "@/components/dashboard/PeriodStack";

// /beheer, set up like Runtools: a period (7, 30, 90 days or everything), tiles compared with the period before,
// and per-day series that the charts group into days, weeks or months. Data: page_views and events (lib/tracking.ts).
// Unique visitors per day / week / month: the first visit of a browser in that day / week / month (visit_gap), so the
// daily numbers of a week add up to that week's unique visitors without storing an ID.
const TZ = "Europe/Amsterdam";
export const PERIODS = { "7": "7 dagen", "30": "30 dagen", "90": "90 dagen", alles: "alles" } as const;
export type Period = keyof typeof PERIODS;
type Grain = "day" | "week" | "month";

const CHANNEL = `CASE
  WHEN utm IS NOT NULL THEN 'Campaign: ' || utm
  WHEN ref IS NULL OR ref ~* 'boldanalytics' THEN 'Direct / unknown'
  WHEN ref ~* '(^|\\.)(t\\.co|x\\.com|twitter\\.com)$' THEN 'X'
  WHEN ref ~* '(^|\\.)(linkedin\\.com|lnkd\\.in)$' THEN 'LinkedIn'
  WHEN ref ~* '(^|\\.)google\\.' THEN 'Google'
  WHEN ref ~* '(^|\\.)(bing|duckduckgo|yahoo|ecosia)\\.' THEN 'Other search'
  WHEN ref ~* '(^|\\.)dune\\.com$' THEN 'Dune'
  WHEN ref ~* '(^|\\.)(t\\.me|telegram\\.org|discord\\.com|reddit\\.com|warpcast\\.com|farcaster\\.xyz|base\\.app)$' THEN 'Social / chat'
  ELSE 'Other sites' END`;

export type Row = { k: string; n: number; m?: number };
type Day = {
  day: string; visits: number; views: number; uv_d: number; uv_w: number; uv_m: number;
  v_new: number; v_2: number; v_3: number; v_6: number;
  g_0: number; g_1: number; g_3: number; g_7: number; g_28: number; g_long: number;
  bot: number; self: number; auto: number;
};
const KEYS = ["visits", "views", "uv_d", "uv_w", "uv_m", "v_new", "v_2", "v_3", "v_6", "g_0", "g_1", "g_3", "g_7", "g_28", "g_long", "bot", "self", "auto"] as const;

/** Monday of the week / first of the month of a YYYY-MM-DD day. */
function bucket(day: string, g: Grain) {
  if (g === "day") return day;
  if (g === "month") return `${day.slice(0, 7)}-01`;
  const t = new Date(`${day}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
}

/** Per-day values → StackRows for all three grains (summed per week / month). */
function rows(days: { day: string; k: string; v: number }[]): StackRow[] {
  const out = new Map<string, StackRow>();
  for (const g of ["day", "week", "month"] as Grain[])
    for (const d of days) {
      const p = bucket(d.day, g), id = `${g}|${p}|${d.k}`;
      const r = out.get(id) ?? out.set(id, { g, p, k: d.k, v: 0 }).get(id)!;
      r.v += d.v;
    }
  return [...out.values()];
}

export async function getBeheer(period: Period) {
  if (!hasDb()) return null;
  const sql = db();
  const start =
    period === "alles"
      ? sql`COALESCE((SELECT min((at AT TIME ZONE ${TZ})::date) FROM page_views), (now() AT TIME ZONE ${TZ})::date)`
      : sql`((now() AT TIME ZONE ${TZ})::date - ${Number(period) - 1}::int)`;
  const inP = sql`(at AT TIME ZONE ${TZ})::date >= ${start}`;
  const counted = sql`SELECT * FROM page_views WHERE excluded IS NULL AND ${inP}`;
  const ev = sql`SELECT * FROM events WHERE excluded IS NULL AND ${inP}`;
  const tiles = (from: postgres.PendingQuery<postgres.Row[]>, to: postgres.PendingQuery<postgres.Row[]>) => sql<{ visitors: number; visits: number; views: number; interactions: number; downloads: number }[]>`
    WITH b AS (SELECT ${from} AS s, ${to} AS e),
         v AS (SELECT p.*, (p.at AT TIME ZONE ${TZ}) AS lt FROM page_views p, b WHERE p.excluded IS NULL AND (p.at AT TIME ZONE ${TZ}) >= b.s AND (p.at AT TIME ZONE ${TZ}) < b.e),
         x AS (SELECT e.kind FROM events e, b WHERE e.excluded IS NULL AND (e.at AT TIME ZONE ${TZ}) >= b.s AND (e.at AT TIME ZONE ${TZ}) < b.e)
    SELECT (SELECT COUNT(*) FILTER (WHERE entry AND (visit_gap IS NULL OR lt::date - visit_gap < (SELECT s FROM b)::date)) FROM v)::int AS visitors,
           (SELECT COUNT(*) FILTER (WHERE entry) FROM v)::int AS visits,
           (SELECT COUNT(*) FROM v)::int AS views,
           (SELECT COUNT(*) FILTER (WHERE kind IN ('toggle', 'hover', 'click', 'play')) FROM x)::int AS interactions,
           (SELECT COUNT(*) FILTER (WHERE kind = 'download') FROM x)::int AS downloads`;
  const now = sql`(now() AT TIME ZONE ${TZ})`;
  const len = period === "alles" ? null : Number(period);

  const [cur, prev, days, pageDays, channelDays, eventDays, pages, channels, refs, campaigns, countries, devices, downloads, charts, choices, outbound] = await Promise.all([
    tiles(sql`${start}::timestamp`, sql`${now} + interval '1 minute'`),
    // the period before, just as long and up to the same time of day
    len ? tiles(sql`${start}::timestamp - make_interval(days => ${len})`, sql`${now} - make_interval(days => ${len})`) : Promise.resolve(null),
    sql<Day[]>`
      WITH d AS (SELECT generate_series(${start}::timestamp, date_trunc('day', ${now}), interval '1 day') AS day),
           v AS (SELECT (at AT TIME ZONE ${TZ}) AS lt, * FROM page_views WHERE ${inP})
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
        COUNT(v.*) FILTER (WHERE v.excluded IS NULL AND v.entry)::int AS visits,
        COUNT(v.*) FILTER (WHERE v.excluded IS NULL)::int AS views,
        COUNT(v.*) FILTER (WHERE v.excluded IS NULL AND v.entry AND (v.visit_gap IS NULL OR v.visit_gap >= 1))::int AS uv_d,
        COUNT(v.*) FILTER (WHERE v.excluded IS NULL AND v.entry AND (v.visit_gap IS NULL OR d.day::date - v.visit_gap < date_trunc('week', d.day)::date))::int AS uv_w,
        COUNT(v.*) FILTER (WHERE v.excluded IS NULL AND v.entry AND (v.visit_gap IS NULL OR d.day::date - v.visit_gap < date_trunc('month', d.day)::date))::int AS uv_m,
        COUNT(v.*) FILTER (WHERE v.excluded IS NULL AND v.entry AND v.visit_no = 1)::int AS v_new,
        COUNT(v.*) FILTER (WHERE v.excluded IS NULL AND v.entry AND v.visit_no = 2)::int AS v_2,
        COUNT(v.*) FILTER (WHERE v.excluded IS NULL AND v.entry AND v.visit_no BETWEEN 3 AND 5)::int AS v_3,
        COUNT(v.*) FILTER (WHERE v.excluded IS NULL AND v.entry AND v.visit_no >= 6)::int AS v_6,
        COUNT(v.*) FILTER (WHERE v.excluded IS NULL AND v.entry AND v.visit_no > 1 AND v.visit_gap = 0)::int AS g_0,
        COUNT(v.*) FILTER (WHERE v.excluded IS NULL AND v.entry AND v.visit_no > 1 AND v.visit_gap = 1)::int AS g_1,
        COUNT(v.*) FILTER (WHERE v.excluded IS NULL AND v.entry AND v.visit_no > 1 AND v.visit_gap BETWEEN 2 AND 3)::int AS g_3,
        COUNT(v.*) FILTER (WHERE v.excluded IS NULL AND v.entry AND v.visit_no > 1 AND v.visit_gap BETWEEN 4 AND 7)::int AS g_7,
        COUNT(v.*) FILTER (WHERE v.excluded IS NULL AND v.entry AND v.visit_no > 1 AND v.visit_gap BETWEEN 8 AND 28)::int AS g_28,
        COUNT(v.*) FILTER (WHERE v.excluded IS NULL AND v.entry AND v.visit_no > 1 AND v.visit_gap > 28)::int AS g_long,
        COUNT(v.*) FILTER (WHERE v.excluded = 'bot')::int AS bot,
        COUNT(v.*) FILTER (WHERE v.excluded = 'self')::int AS self,
        COUNT(v.*) FILTER (WHERE v.excluded = 'auto')::int AS auto
      FROM d LEFT JOIN v ON v.lt::date = d.day::date
      GROUP BY d.day ORDER BY d.day`,
    sql<{ day: string; k: string; v: number }[]>`
      WITH v AS (${counted}) SELECT to_char((at AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD') AS day, path AS k, COUNT(*)::int AS v FROM v GROUP BY 1, 2`,
    sql<{ day: string; k: string; v: number }[]>`
      WITH v AS (${counted}) SELECT to_char((at AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD') AS day, ${sql.unsafe(CHANNEL)} AS k, COUNT(*)::int AS v FROM v WHERE entry GROUP BY 1, 2`,
    sql<{ day: string; k: string; v: number }[]>`
      WITH e AS (${ev}) SELECT to_char((at AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD') AS day, kind AS k, COUNT(*)::int AS v FROM e GROUP BY 1, 2`,
    sql<Row[]>`WITH v AS (${counted}) SELECT path AS k, COUNT(*)::int AS n, COUNT(*) FILTER (WHERE entry)::int AS m FROM v GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
    sql<Row[]>`WITH v AS (${counted}) SELECT ${sql.unsafe(CHANNEL)} AS k, COUNT(*)::int AS n FROM v WHERE entry GROUP BY 1 ORDER BY 2 DESC`,
    sql<Row[]>`WITH v AS (${counted}) SELECT ref AS k, COUNT(*)::int AS n FROM v WHERE entry AND ref IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
    sql<Row[]>`WITH v AS (${counted}) SELECT concat_ws(' / ', utm, utm_medium, utm_campaign) AS k, COUNT(*)::int AS n FROM v WHERE entry AND utm IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 12`,
    sql<Row[]>`WITH v AS (${counted}) SELECT COALESCE(country, '?') AS k, COUNT(*)::int AS n FROM v WHERE entry GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
    sql<Row[]>`WITH v AS (${counted}) SELECT COALESCE(device, '?') AS k, COUNT(*)::int AS n FROM v WHERE entry GROUP BY 1 ORDER BY 2 DESC`,
    sql<Row[]>`WITH e AS (${ev}) SELECT concat_ws(' · ', target, value) AS k, COUNT(*)::int AS n FROM e WHERE kind = 'download' GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
    sql<Row[]>`WITH e AS (${ev}) SELECT target AS k, COUNT(*)::int AS n, COUNT(DISTINCT visit)::int AS m FROM e WHERE kind IN ('toggle', 'hover', 'click', 'play') GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
    sql<Row[]>`WITH e AS (${ev}) SELECT concat_ws(' · ', target, value) AS k, COUNT(*)::int AS n FROM e WHERE kind IN ('toggle', 'click', 'play') GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
    sql<Row[]>`WITH e AS (${ev}) SELECT target AS k, COUNT(*)::int AS n FROM e WHERE kind = 'outbound' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
  ]);

  const dayList = days.map((d) => ({ ...d }));
  const first = dayList[0]?.day ?? "", last = dayList[dayList.length - 1]?.day ?? "";
  const per = (ks: readonly (keyof Day)[]) => dayList.flatMap((d) => ks.map((k) => ({ day: d.day, k: String(k), v: Number(d[k]) })));
  // unique visitors: the daily column that fits each grain
  const uv: StackRow[] = [
    ...rows(dayList.map((d) => ({ day: d.day, k: "Unieke bezoekers", v: d.uv_d }))).filter((r) => r.g === "day"),
    ...rows(dayList.map((d) => ({ day: d.day, k: "Unieke bezoekers", v: d.uv_w }))).filter((r) => r.g === "week"),
    ...rows(dayList.map((d) => ({ day: d.day, k: "Unieke bezoekers", v: d.uv_m }))).filter((r) => r.g === "month"),
  ];
  // top 8 pages / channels per period, the rest as Other; every day present (zero rows keep empty days on the axis)
  const top = (list: { k: string; v: number }[], n = 8) => {
    const tot = new Map<string, number>();
    for (const r of list) tot.set(r.k, (tot.get(r.k) ?? 0) + r.v);
    return [...tot.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
  };
  const zero = dayList.map((d) => ({ day: d.day, k: "Other", v: 0 }));
  const plain = <T,>(r: readonly T[]) => r.map((x) => ({ ...x }));
  return {
    period, first, last,
    tiles: { ...cur[0] }, prev: prev ? { ...prev[0] } : null,
    trend: { visitors: uv, visits: rows(per(["visits"]).map((r) => ({ ...r, k: "Bezoeken" }))), views: rows(per(["views"]).map((r) => ({ ...r, k: "Weergaven" }))) },
    returning: rows(per(["v_new", "v_2", "v_3", "v_6"])),
    gaps: rows(per(["g_0", "g_1", "g_3", "g_7", "g_28", "g_long"])),
    excludedDays: rows(per(["bot", "self", "auto"])),
    pages: { rows: rows([...zero, ...pageDays.map((r) => ({ ...r }))]), top: top(pageDays) },
    channels: { rows: rows([...zero, ...channelDays.map((r) => ({ ...r }))]), top: top(channelDays) },
    events: rows([...zero, ...eventDays.map((r) => ({ ...r }))]),
    lists: {
      pages: plain(pages), channels: plain(channels), refs: plain(refs), campaigns: plain(campaigns), countries: plain(countries),
      devices: plain(devices), downloads: plain(downloads), charts: plain(charts), choices: plain(choices), outbound: plain(outbound),
    },
  };
}
export type Beheer = NonNullable<Awaited<ReturnType<typeof getBeheer>>>;
