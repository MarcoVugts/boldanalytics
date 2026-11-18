import { db, hasDb } from "@/lib/db";

// Paginaweergaven (lib/tracking.ts) opslaan in page_views. Geen IP-adres of andere persoonsgegevens: alleen pad,
// bezoekcode per tabblad, het hoeveelste bezoek, dagen sinds het vorige, herkomst (alleen de sitenaam) en soort apparaat.
const ORIGINS = /^https:\/\/(www\.)?boldanalytics\.(io|vercel\.app)$/;
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pagespeed|curl|wget|python|axios|go-http|java\//i;

const device = (ua: string) => (/ipad|tablet/i.test(ua) ? "tablet" : /mobi|iphone|android/i.test(ua) ? "mobile" : "desktop");
const clean = (v: unknown, re: RegExp, max = 120) => (typeof v === "string" && v.length <= max && re.test(v) ? v : null);
const int = (v: unknown, max: number) => (Number.isInteger(v) && (v as number) >= 0 ? Math.min(v as number, max) : null);

export async function POST(request: Request) {
  if (!ORIGINS.test(request.headers.get("origin") ?? "") || !hasDb()) return new Response(null, { status: 204 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse((await request.text()).slice(0, 1000));
  } catch {
    return new Response(null, { status: 204 });
  }
  if (body.event && typeof body.event === "object") return saveEvent(request, body);
  const path = clean(typeof body.path === "string" ? body.path.split("?")[0] : null, /^\/[\w\-/.]{0,120}$/);
  if (!path || /^\/(beheer|ops)(\/|$)/.test(path)) return new Response(null, { status: 204 });
  const ua = request.headers.get("user-agent") ?? "";
  const bot = BOT.test(ua);
  const excluded = bot ? "bot" : body.excluded === "self" ? "self" : body.excluded === "auto" ? "auto" : null;
  const entry = body.entry === true;
  await db()`
    INSERT INTO page_views (path, visit, entry, visit_no, visit_gap, ref, utm, utm_medium, utm_campaign, country, device, excluded, detail)
    VALUES (${path}, ${clean(body.visit, /^[a-z0-9]{4,16}$/)}, ${entry}, ${entry ? int(body.nr, 100000) : null},
            ${entry ? int(body.gap, 100000) : null}, ${entry ? clean(body.ref, /^[a-z0-9.-]{1,100}$/i) : null},
            ${entry ? clean(body.utm, /^[\w.-]{1,40}$/) : null}, ${entry ? clean(body.medium, /^[\w.-]{1,40}$/) : null},
            ${entry ? clean(body.campaign, /^[\w.-]{1,60}$/) : null}, ${entry ? clean(request.headers.get("x-vercel-ip-country"), /^[A-Z]{2}$/) : null}, ${device(ua)}, ${excluded}, ${bot ? ua.slice(0, 120) : null})`;
  return new Response(null, { status: 204 });
}

const KINDS = new Set(["download", "toggle", "hover", "click", "play", "outbound"]);

async function saveEvent(request: Request, body: Record<string, unknown>) {
  const e = body.event as Record<string, unknown>;
  const path = clean(typeof body.path === "string" ? body.path.split("?")[0] : null, /^\/[\w\-/.]{0,120}$/);
  const kind = typeof e.kind === "string" && KINDS.has(e.kind) ? e.kind : null;
  if (!path || !kind || /^\/(beheer|ops)(\/|$)/.test(path)) return new Response(null, { status: 204 });
  const ua = request.headers.get("user-agent") ?? "";
  const excluded = BOT.test(ua) ? "bot" : body.excluded === "self" ? "self" : body.excluded === "auto" ? "auto" : null;
  const text = /^[\w .,:%&+()'’/·×→–-]{1,80}$/u;
  await db()`
    INSERT INTO events (path, visit, kind, target, value, excluded)
    VALUES (${path}, ${clean(body.visit, /^[a-z0-9]{4,16}$/)}, ${kind}, ${clean(e.target, text, 80)}, ${clean(e.value, text, 80)}, ${excluded})`;
  return new Response(null, { status: 204 });
}
