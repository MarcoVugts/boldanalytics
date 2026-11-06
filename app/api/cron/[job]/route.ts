import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { runTradesIngest } from "@/lib/ingest";

// Hobby allows up to 300s; the loader stores unfinished executions and resumes next call.
export const maxDuration = 300;

// GET /api/cron/trades                      — normal incremental run (Vercel cron)
// GET /api/cron/trades?start=2026-11-01     — manual window (end defaults to today)
// GET /api/cron/trades?start=…&end=…&force=1
export async function GET(req: NextRequest, ctx: { params: Promise<{ job: string }> }) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { job } = await ctx.params;
  const q = req.nextUrl.searchParams;
  const valid = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined);

  try {
    switch (job) {
      case "trades": {
        const result = await runTradesIngest({
          budgetMs: (maxDuration - 30) * 1000,
          start: valid(q.get("start")),
          end: valid(q.get("end")),
          force: q.get("force") === "1",
        });
        if (result.action === "completed") {
          revalidateTag("trades", "max");
        }
        revalidateTag("runs", "max");
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json({ error: `unknown job: ${job}` }, { status: 404 });
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
