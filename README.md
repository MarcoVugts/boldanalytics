# Bold Analytics

Site + data pipeline for boldanalytics.io. Next.js (App Router, Cache Components) on Vercel, Neon Postgres, data from Dune.

## How the data flows

```
Dune saved query (sql/dune/trades_daily.sql, params start_date/end_date)
   │  POST /query/{id}/execute  → poll status → page through results
   ▼
/api/cron/trades  (Vercel cron, daily 04:15 UTC)
   │  upsert wallet × token × day into trades_daily, log run + cost in dune_runs
   ▼
Neon Postgres ──► cached reads ('use cache', tag "trades") ──► /stories/tokenized-stocks
                                                       └────► /ops (runs, credits, DB size)
```

**trades_daily grain**: day × wallet (`tx_from`) × `taker` × `tx_to` (router/aggregator) × `project`/`version` (DEX) × token, with trades, swaps, buy/sell USD and token amounts. `cross_usd`/`cross_swaps` let totals count stock→stock swaps once.

**Incremental, to keep Dune cost low**

- Window is `[start, end)` with `end = today 00:00 UTC` → only complete days.
- `start = last completed run's end` (`INGEST_OVERLAP_DAYS=0`) → each daily run exports exactly one new day. An overlap day costs a full extra day of export. The days in the window are replaced in one transaction (delete + insert).
- Already up to date → Dune is **not** called (no credits).
- First run backfills from `INGEST_BACKFILL_START` in chunks of `INGEST_MAX_DAYS_PER_RUN` days; call the route again to continue.
- If a Dune execution takes longer than the function budget, it's stored as `pending` and the next call resumes it instead of paying for a new execution.

Every execution is logged in `dune_runs`. See `/ops`.

**What a run costs on Dune** (from docs.dune.com/api-reference/overview/billing):
- *Execution*: compute-based, reported per run as `execution_cost_credits` → stored as `cost_credits`.
- *Export*: pulling results costs **10 credits per MB on Analyst** (2 on Plus) → estimated from result size as `export_credits_est`. Keep result columns minimal.
- Status, usage and polling calls are free. After each run the loader stores the billing-period total from `POST /v1/usage`.
- Analyst = 4,000 credits/month.

## Setup

1. **Dune**: `node --env-file=.env.local scripts/create-dune-queries.mjs` creates them via the API (Read/Write key), or create them by hand. The queries (parameters `start_date`, `end_date`, both type *datetime*):
   - `sql/dune/trades_daily_size.sql`: run first, in the Dune UI, over a few days. One row per day: rows per grain (`rows_full` = what the loader will pull), `usd_null_share`, senders vs takers.
   - `sql/dune/top_senders.sql`: one-off check for bundlers/relayers among `tx_from`.
   - `sql/dune/trades_daily.sql`: the loader query; put its id in `DUNE_QUERY_TRADES`.
2. **Vercel**: import this repo as a new project. Add Neon via *Storage* (region us-east-1) → `DATABASE_URL` is set automatically.
3. **Env vars** (see `.env.example`): `DUNE_API_KEY`, `DUNE_QUERY_TRADES`, `CRON_SECRET`.
4. **Migrate**: runs automatically in `npm run build` (Vercel build) when `DATABASE_URL` is set.
5. **Test Dune cost** for one day, before loading anything (pulls only 5 rows, prints execution credits, result size and estimated export credits):
   `node --env-file=.env.local scripts/test-dune.mjs 2026-11-05 2026-11-06`
6. **First load** (repeat until it says `skipped`):
   `curl -H "Authorization: Bearer $CRON_SECRET" https://<deployment>/api/cron/trades`

Manual window: `/api/cron/trades?start=2026-11-01&end=2026-11-03` (doesn't affect the incremental position unless it's the newest completed run).

## Local development (no Dune key needed)

```bash
node scripts/mock-dune.mjs                       # fake Dune API on :4010
cp .env.example .env.local                       # set DUNE_API_BASE=http://localhost:4010/api/v1 and DATABASE_URL
node --env-file=.env.local scripts/migrate.mjs
npm run dev
curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/trades
```

## Layout

```
app/stories/tokenized-stocks   data story page
app/ops                        ingest runs & cost (noindex)
app/api/cron/[job]             loaders (trades; balances/wallets later)
lib/dune.ts                    Dune client: execute, poll, paginate
lib/ingest.ts                  incremental window + upsert + run log
lib/queries/                   cached Postgres reads for pages
sql/dune/                      Dune query sources
sql/migrations/                Postgres schema
scripts/                       migrate, test-dune, mock-dune
```
