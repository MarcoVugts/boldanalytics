import { after, NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import {
  backfillShouldContinue,
  runBackfill,
  runIngest,
  syncTokens,
  type BackfillStatus,
  type IngestResult,
} from "@/lib/ingest";

// The backfill continues by calling itself (?chain=n) until it is done, paused or stopped.
// Each chained call answers 202 at once and does its work in after(), within maxDuration.
const MAX_CHAIN = 40;

async function kickBackfill(origin: string, secret: string, n: number) {
  if (n > MAX_CHAIN) return console.log(`backfill chain: stopping at ${MAX_CHAIN} links`);
  try {
    const res = await fetch(`${origin}/api/cron/backfill?chain=${n}`, {
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(20_000),
    });
    console.log(`backfill chain: link ${n} -> ${res.status}`);
  } catch (e) {
    console.error(`backfill chain: link ${n} failed`, e);
  }
}

// Hobby allows up to 300s; unfinished Dune executions are stored and resumed next call.
export const maxDuration = 300;

// GET /api/cron/daily                        — tokens + trades + routes, then history backfill with the time left
// GET /api/cron/backfill                     — only the history backfill (continues by itself)
// GET /api/cron/trades | routes | tokens     — one job
// GET /api/cron/trades?start=2026-11-01&end=2026-11-02   — manual window
//     &maxExport=200                         — raise the export-credit guard for this call
//     &client=acme                           — bill this run's credits to a client (see /ops)
export async function GET(req: NextRequest, ctx: { params: Promise<{ job: string }> }) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { job } = await ctx.params;
  const q = req.nextUrl.searchParams;
  const valid = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined);
  const client = q.get("client");
  if (client && !/^[a-z0-9][a-z0-9-]{0,39}$/.test(client)) {
    return NextResponse.json({ error: "client must be a lowercase slug (a-z, 0-9, -)" }, { status: 400 });
  }
  const trigger = /vercel-cron/i.test(req.headers.get("user-agent") ?? "") ? "cron" : "manual";
  const deadline = Date.now() + (maxDuration - 20) * 1000;
  const opts = () => ({
    budgetMs: Math.max(10_000, deadline - Date.now()),
    start: valid(q.get("start")),
    end: valid(q.get("end")),
    force: q.get("force") === "1",
    maxExportCredits: q.get("maxExport") ? Number(q.get("maxExport")) : undefined,
    trigger,
    client: client ?? undefined,
  });

  const jobs: Record<string, string[]> = {
    daily: ["tokens", "trades", "routes"],
    backfill: [],
    tokens: ["tokens"],
    trades: ["trades"],
    routes: ["routes"],
  };
  if (!jobs[job]) return NextResponse.json({ error: `unknown job: ${job}` }, { status: 404 });

  // A link in the self-continuing backfill chain: answer now, work after the response.
  const chain = Number(q.get("chain") ?? 0);
  if (job === "backfill" && chain > 0) {
    const origin = req.nextUrl.origin;
    after(async () => {
      // Resume a pending trades execution first (no Dune call if there is none and we're up to date).
      await runIngest("trades", { budgetMs: 60_000, trigger: "chain" }).catch((err) => console.error("trades", err));
      const b = await runBackfill(deadline, "chain").catch((err) => {
        console.error("backfill", err);
        return null;
      });
      if (b?.results.some((r) => r.action === "completed")) revalidateTag("trades", "max");
      revalidateTag("runs", "max");
      console.log(JSON.stringify({ job, chain, results: b?.results, backfill: b?.status }));
      if (backfillShouldContinue(b?.status)) await kickBackfill(origin, secret, chain + 1);
    });
    return NextResponse.json({ job, chain, accepted: true }, { status: 202 });
  }

  const results: (IngestResult | { dataset: string; action: string; [k: string]: unknown })[] = [];
  for (const name of jobs[job]) {
    try {
      results.push(name === "tokens" ? await syncTokens() : await runIngest(name, opts()));
    } catch (err) {
      console.error(name, err);
      results.push({ dataset: name, action: "error", message: String(err) });
    }
  }

  // History backfill uses whatever function time is left (daily and backfill jobs only).
  let backfill: BackfillStatus | undefined;
  if (job === "daily" || job === "backfill") {
    try {
      const b = await runBackfill(deadline, trigger);
      results.push(...b.results.map((r) => ({ ...r, dataset: `${r.dataset} (backfill)` })));
      backfill = b.status;
    } catch (err) {
      console.error("backfill", err);
      backfill = { done: false, oldestDay: null, message: String(err) };
    }
  }

  if (results.some((r) => r.action === "completed")) revalidateTag("trades", "max");
  revalidateTag("runs", "max");
  // The token list is a nice-to-have; only the Dune loaders decide success, so a
  // Coinbase hiccup doesn't mark the whole cron run as failed.
  const ok = results.every((r) => r.action !== "error" || r.dataset === "tokens");
  // Not finished and nothing paused or failed: continue right away in a new invocation.
  if (backfillShouldContinue(backfill)) {
    const origin = req.nextUrl.origin;
    after(() => kickBackfill(origin, secret, 1));
  }
  console.log(JSON.stringify({ job, trigger, results, backfill }));
  return NextResponse.json({ job, trigger, results, backfill, continuing: backfillShouldContinue(backfill) }, { status: ok ? 200 : 500 });
}
