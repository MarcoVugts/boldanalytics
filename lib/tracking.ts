// Bezoekersmeting in de browser (zelfde basis als Runtools): geen cookies, geen ID's die een persoon volgen.
//   bezoek      = één tabblad (willekeurige code in sessionStorage)
//   visit_no    = het hoeveelste bezoek in deze browser (een getal in localStorage)
//   visit_gap   = dagen sinds het vorige bezoek in deze browser (een datum in localStorage) -> unieke bezoekers per periode
// Je eigen apparaat telt niet mee zodra je /beheer opent (OPT_OUT_KEY); geautomatiseerde browsers ook niet.
export const OPT_OUT_KEY = "bold:niet-meetellen";
const VISIT_KEY = "bold:bezoek";
const COUNT_KEY = "bold:bezoeken";
const LAST_KEY = "bold:laatste-bezoek";
const PROD_HOSTS = /^(www\.)?boldanalytics\.(io|vercel\.app)$/;

const today = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD, lokale datum

function visitId(): { id: string; isNew: boolean } {
  try {
    const known = sessionStorage.getItem(VISIT_KEY);
    if (known && /^[a-z0-9]{4,16}$/.test(known)) return { id: known, isNew: false };
    const id = Math.random().toString(36).slice(2, 12);
    sessionStorage.setItem(VISIT_KEY, id);
    return { id, isNew: true };
  } catch {
    return { id: Math.random().toString(36).slice(2, 12), isNew: true };
  }
}

/** Het hoeveelste bezoek in deze browser, en dagen sinds het vorige (null = eerste keer). Eén keer per bezoek. */
function visitCount(): { nr: number; gap: number | null } {
  try {
    const nr = Number(localStorage.getItem(COUNT_KEY) ?? 0) + 1;
    localStorage.setItem(COUNT_KEY, String(nr));
    const last = localStorage.getItem(LAST_KEY);
    const now = today();
    const gap = last && /^\d{4}-\d{2}-\d{2}$/.test(last) ? Math.max(0, Math.round((Date.parse(now) - Date.parse(last)) / 86_400_000)) : null;
    localStorage.setItem(LAST_KEY, now);
    return { nr, gap };
  } catch {
    return { nr: 1, gap: null };
  }
}

function excludedReason(): "self" | "auto" | null {
  if (navigator.webdriver) return "auto";
  try {
    return localStorage.getItem(OPT_OUT_KEY) === "1" ? "self" : null;
  } catch {
    return null;
  }
}

/** Paginaweergave naar /api/ping: met lage voorrang, zonder te wachten, fouten genegeerd. Alleen op de echte site. */
export function trackView(path: string) {
  if (typeof window === "undefined" || !PROD_HOSTS.test(window.location.hostname)) return;
  if (/^\/(beheer|ops)(\/|$)/.test(path)) return;
  const go = () => {
    const { id, isNew } = visitId();
    let ref = "";
    try {
      ref = isNew && document.referrer ? new URL(document.referrer).hostname : "";
    } catch {
      /* geen geldige verwijzing */
    }
    const params = new URLSearchParams(window.location.search);
    const counts = isNew ? visitCount() : null;
    const body = {
      path,
      visit: id,
      entry: isNew,
      nr: counts?.nr,
      gap: counts?.gap ?? undefined,
      ref: ref || undefined,
      utm: isNew ? (params.get("utm_source") ?? undefined) : undefined,
      excluded: excludedReason() ?? undefined,
    };
    try {
      fetch("/api/ping", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
    } catch {
      /* meten mag nooit iets in de weg zitten */
    }
  };
  // Chrome laadt pagina's soms onzichtbaar vooraf (prerender): pas meten als de pagina echt geopend is.
  const run = () => ("requestIdleCallback" in window ? window.requestIdleCallback(go, { timeout: 3000 }) : setTimeout(go, 500));
  if ((document as Document & { prerendering?: boolean }).prerendering) document.addEventListener("prerenderingchange", run, { once: true });
  else run();
}
