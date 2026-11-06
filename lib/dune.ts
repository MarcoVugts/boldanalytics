// Minimal Dune API client: execute a saved query with parameters, poll, paginate results.
// DUNE_API_BASE can point at scripts/mock-dune.mjs for local development.

const BASE = process.env.DUNE_API_BASE ?? "https://api.dune.com/api/v1";

export type Performance = "medium" | "large";

export type ExecutionStatus = {
  execution_id: string;
  query_id?: number;
  execution_cost_credits?: number;
  state: string; // QUERY_STATE_PENDING | _EXECUTING | _COMPLETED | _FAILED | _CANCELLED | _EXPIRED ...
  is_execution_finished?: boolean;
  submitted_at?: string;
  execution_started_at?: string;
  execution_ended_at?: string;
  error?: unknown;
  result_metadata?: {
    column_names?: string[];
    row_count?: number;
    total_row_count?: number;
    datapoint_count?: number;
    result_set_bytes?: number;
    total_result_set_bytes?: number;
    execution_time_millis?: number;
    pending_time_millis?: number;
  };
  [key: string]: unknown;
};

function apiKey(): string {
  const key = process.env.DUNE_API_KEY;
  if (!key) throw new Error("DUNE_API_KEY is not set");
  return key;
}

async function dune<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "X-Dune-API-Key": apiKey(),
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Dune ${init?.method ?? "GET"} ${path} -> ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json() as Promise<T>;
}

export async function executeQuery(
  queryId: number,
  params: Record<string, string>,
  performance: Performance = "medium",
): Promise<string> {
  const r = await dune<{ execution_id: string; state: string }>(`/query/${queryId}/execute`, {
    method: "POST",
    body: JSON.stringify({ query_parameters: params, performance }),
  });
  return r.execution_id;
}

export function getStatus(executionId: string) {
  return dune<ExecutionStatus>(`/execution/${executionId}/status`);
}

export const isDone = (s: ExecutionStatus) =>
  s.is_execution_finished ?? !/PENDING|EXECUTING/.test(s.state);

export const isSuccess = (s: ExecutionStatus) => s.state === "QUERY_STATE_COMPLETED";

/** Poll until finished or until `budgetMs` runs out (returns the last status either way). */
export async function waitForExecution(executionId: string, budgetMs: number, intervalMs = 3000) {
  const deadline = Date.now() + budgetMs;
  let status = await getStatus(executionId);
  while (!isDone(status) && Date.now() + intervalMs < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    status = await getStatus(executionId);
  }
  return status;
}

/** Stream all result rows page by page. */
export async function* resultPages<Row = Record<string, unknown>>(executionId: string, pageSize = 10_000) {
  let offset: number | undefined = 0;
  while (offset !== undefined) {
    const r: {
      result?: { rows: Row[] };
      next_offset?: number;
    } = await dune(`/execution/${executionId}/results?limit=${pageSize}&offset=${offset}`);
    yield r.result?.rows ?? [];
    offset = r.next_offset ?? undefined;
  }
}

/** Execution credits as billed by Dune (source of truth per their docs). */
export function extractCredits(s: ExecutionStatus): number | null {
  return typeof s.execution_cost_credits === "number" ? s.execution_cost_credits : null;
}

/**
 * Export is billed separately per MB of results pulled (Analyst: 10, Plus: 2).
 * Estimate from the result size Dune reports.
 */
export function estimateExportCredits(s: ExecutionStatus): number | null {
  const bytes = s.result_metadata?.total_result_set_bytes ?? s.result_metadata?.result_set_bytes;
  if (bytes == null) return null;
  const perMb = Number(process.env.DUNE_EXPORT_CREDITS_PER_MB ?? 10);
  return Math.round((bytes / 1e6) * perMb * 100) / 100;
}

/** Credits used in the current billing period (POST /usage is free). */
export async function getUsage(): Promise<{ used: number; included: number } | null> {
  try {
    const r = await dune<{ billingPeriods?: { credits_used: number; credits_included: number; end_date: string }[] }>(
      "/usage",
      { method: "POST", body: "{}" },
    );
    const p = r.billingPeriods?.at(-1);
    return p ? { used: p.credits_used, included: p.credits_included } : null;
  } catch {
    return null; // informational only; never fail a load on this
  }
}
