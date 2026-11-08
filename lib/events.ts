import { db, hasDb } from "./db";

/** Best-effort event log in Neon (job_events), shown on /ops. Never throws. */
export async function logEvent(job: string, event: string, detail?: unknown, link?: number) {
  const text = detail == null ? null : typeof detail === "string" ? detail : JSON.stringify(detail);
  console.log(`[${job}${link ? ` #${link}` : ""}] ${event}${text ? ` ${text}` : ""}`);
  if (!hasDb()) return;
  try {
    await db()`INSERT INTO job_events (job, link, event, detail) VALUES (${job}, ${link ?? null}, ${event}, ${text?.slice(0, 2000) ?? null})`;
  } catch (e) {
    console.error("logEvent", e);
  }
}
