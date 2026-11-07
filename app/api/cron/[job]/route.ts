import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { runIngest, syncTokens, type IngestResult } from "@/lib/ingest";

// Hobby allows up to 300s; unfinished Dune executions are stored and resumed next call.
export const maxDuration = 300;

// GET /api/cron/daily                        — tokens + trades + routes (Vercel cron)
// GET /api/cron/trades | routes | tokens     — one job
// GET /api/cron/trades?start=2026-11-01&end=2026-11-02   — manual window
//     &maxExport=200                         — raise the export-credit guard for this call
export async function GET(req: NextRequest, ctx: { params: Promise<{ job: string }> }) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { job } = await ctx.params;
  const q = req.nextUrl.searchParams;
  const valid = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined);
  const trigger = /vercel-cron/i.test(req.headers.get("user-agent") ?? "") ? "cron" : "manual";
  const deadline = Date.now() + (maxDuration - 20) * 1000;
  const opts = () => ({
    budgetMs: Math.max(10_000, deadline - Date.now()),
    start: valid(q.get("start")),
    end: valid(q.get("end")),
    force: q.get("force") === "1",
    maxExportCredits: q.get("maxExport") ? Number(q.get("maxExport")) : undefined,
    trigger,
  });

  const jobs: Record<string, string[]> = {
    daily: ["tokens", "trades", "routes"],
    tokens: ["tokens"],
    trades: ["trades"],
    routes: ["routes"],
  };
  if (!jobs[job]) return NextResponse.json({ error: `unknown job: ${job}` }, { status: 404 });

  const results: (IngestResult | { dataset: string; action: string; [k: string]: unknown })[] = [];
  for (const name of jobs[job]) {
    try {
      results.push(name === "tokens" ? await syncTokens() : await runIngest(name, opts()));
    } catch (err) {
      console.error(name, err);
      results.push({ dataset: name, action: "error", message: String(err) });
    }
  }

  if (results.some((r) => r.action === "completed")) revalidateTag("trades", "max");
  revalidateTag("runs", "max");
  // The token list is a nice-to-have; only the Dune loaders decide success, so a
  // Coinbase hiccup doesn't mark the whole cron run as failed.
  const ok = results.every((r) => r.action !== "error" || r.dataset === "tokens");
  console.log(JSON.stringify({ job, trigger, results }));
  return NextResponse.json({ job, trigger, results }, { status: ok ? 200 : 500 });
}
