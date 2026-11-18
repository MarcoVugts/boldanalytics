import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { PeriodStack } from "@/components/dashboard/PeriodStack";
import { NotCounted } from "@/components/NotCounted";
import { Stat } from "@/components/Stat";
import { int } from "@/lib/format";
import { getBeheer, PERIODS, type Period, type Row } from "@/lib/queries/beheer";

export const metadata: Metadata = { title: "Beheer", robots: { index: false, follow: false } };

const regionNames = new Intl.DisplayNames(["nl"], { type: "region" });
const country = (k: string) => { try { return k === "?" ? "Onbekend" : `${regionNames.of(k)} (${k})`; } catch { return k; } };


function List({ title, note, rows, label = (k: string) => k }: { title: string; note?: string; rows: Row[]; label?: (k: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <section className="rounded-lg border border-border bg-surface-1 p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      {note && <p className="text-xs text-ink-3">{note}</p>}
      <ul className="mt-3 space-y-1.5 text-sm">
        {rows.map((r) => (
          <li key={r.k} className="grid grid-cols-[1fr_auto] items-center gap-3">
            <div className="relative min-w-0">
              <div className="absolute inset-y-0 left-0 rounded-sm bg-series-1/15" style={{ width: `${(r.n / max) * 100}%` }} />
              <span className="relative block truncate px-1.5 py-0.5">{label(r.k)}</span>
            </div>
            <span className="tabular-nums text-ink-2">
              {int(r.n)}
              {r.m != null && <span className="text-ink-3"> · {int(r.m)}</span>}
            </span>
          </li>
        ))}
        {!rows.length && <li className="text-ink-3">Nog niets gemeten.</li>}
      </ul>
    </section>
  );
}

const pctChange = (now: number, was: number | undefined) => {
  if (was == null) return undefined;
  if (!was) return now ? "nieuw t.o.v. vorige periode" : "gelijk aan vorige periode";
  const d = Math.round(((now - was) / was) * 100);
  return `${d > 0 ? "+" : ""}${d}% t.o.v. vorige periode (${int(was)})`;
};

function Chart({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-border bg-surface-1 p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="text-xs text-ink-3">{sub}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const ramp = (n: number) => Array.from({ length: n }, (_, i) => `var(--bk-${Math.round((i * 5) / Math.max(1, n - 1))})`);
const cats = (keys: string[]) => [...keys.map((k, i) => ({ key: k, color: `var(--cat-${i + 1})` })), { key: "Other", label: "Overig", color: "var(--neutral-mark)" }];

async function Stats({ period }: { period: Period }) {
  await connection(); // altijd actueel, niet gecachet
  const s = await getBeheer(period);
  if (!s) return <p className="text-sm text-ink-3">Geen database.</p>;
  const t = s.tiles, p = s.prev ?? undefined;
  const range = { first: s.first, last: s.last, defaultGrain: (period === "90" || period === "alles" ? "week" : "day") as "day" | "week" };
  const L = s.lists;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Unieke bezoekers" value={int(t.visitors)} note={pctChange(t.visitors, p?.visitors)} />
        <Stat label="Bezoeken" value={int(t.visits)} note={pctChange(t.visits, p?.visits)} />
        <Stat label="Weergaven" value={int(t.views)} note={pctChange(t.views, p?.views)} />
        <Stat label="Interacties" value={int(t.interactions)} note={pctChange(t.interactions, p?.interactions)} />
        <Stat label="Downloads" value={int(t.downloads)} note={pctChange(t.downloads, p?.downloads)} />
      </div>
      <Chart title="Verloop" sub="Unieke bezoekers, bezoeken of weergaven per dag, week of maand. Unieke bezoekers: het eerste bezoek van een browser in die dag, week of maand.">
        <PeriodStack
          {...range}
          stacked={false}
          groupLabel="meting"
          groups={[{ key: "Unieke bezoekers", color: "var(--series-1)" }, { key: "Bezoeken", color: "var(--series-1)" }, { key: "Weergaven", color: "var(--series-1)" }]}
          measures={[
            { key: "visitors", label: "Unieke bezoekers", unit: "count", rows: s.trend.visitors },
            { key: "visits", label: "Bezoeken", unit: "count", rows: s.trend.visits },
            { key: "views", label: "Weergaven", unit: "count", rows: s.trend.views },
          ]}
        />
      </Chart>
      <div className="grid gap-4 lg:grid-cols-2">
        <Chart title="Nieuw of terugkerend" sub="Bezoeken naar het hoeveelste bezoek in die browser.">
          <PeriodStack {...range} groupLabel="bezoek" measures={[{ key: "r", label: "Bezoeken", unit: "count", rows: s.returning }]}
            groups={[{ key: "v_new", label: "Nieuw", color: "var(--bk-0)" }, { key: "v_2", label: "2e keer", color: "var(--bk-2)" }, { key: "v_3", label: "3e–5e keer", color: "var(--bk-4)" }, { key: "v_6", label: "6e keer of vaker", color: "var(--bk-5)" }]} />
        </Chart>
        <Chart title="Tijd tussen bezoeken" sub="Terugkerende bezoeken naar de tijd sinds het vorige bezoek in die browser.">
          <PeriodStack {...range} groupLabel="tijd" measures={[{ key: "g", label: "Bezoeken", unit: "count", rows: s.gaps }]}
            groups={["g_0", "g_1", "g_3", "g_7", "g_28", "g_long"].map((k, i) => ({ key: k, label: ["Zelfde dag", "1 dag", "2–3 dagen", "4–7 dagen", "8–28 dagen", "Langer"][i], color: ramp(6)[i] }))} />
        </Chart>
        <Chart title="Herkomst" sub="Bezoeken per kanaal: campagne (utm_source), anders de verwijzende site gegroepeerd.">
          <PeriodStack {...range} groupLabel="kanaal" measures={[{ key: "c", label: "Bezoeken", unit: "count", rows: s.channels.rows }]} groups={cats(s.channels.top)} />
        </Chart>
        <Chart title="Weergaven per pagina" sub="De acht meest bekeken pagina's in deze periode, de rest als overig.">
          <PeriodStack {...range} groupLabel="pagina" measures={[{ key: "p", label: "Weergaven", unit: "count", rows: s.pages.rows }]} groups={cats(s.pages.top)} />
        </Chart>
        <Chart title="Interactie met grafieken" sub="Schakelaars, eerste hover per grafiek per pagina, klikken, afspelen, downloads en uitgaande links.">
          <PeriodStack {...range} groupLabel="soort" measures={[{ key: "e", label: "Acties", unit: "count", rows: s.events }]}
            groups={["download", "toggle", "click", "play", "hover", "outbound"].map((k, i) => ({ key: k, label: ["Download", "Schakelaar", "Klik", "Afspelen", "Hover", "Uitgaande link"][i], color: `var(--cat-${i + 1})` }))} />
        </Chart>
        <Chart title="Niet meegeteld" sub="Paginaweergaven van jezelf, bots en geautomatiseerde browsers.">
          <PeriodStack {...range} groupLabel="reden" measures={[{ key: "x", label: "Weergaven", unit: "count", rows: s.excludedDays }]}
            groups={[{ key: "self", label: "Eigen apparaat", color: "var(--cat-1)" }, { key: "bot", label: "Bots", color: "var(--cat-2)" }, { key: "auto", label: "Geautomatiseerd", color: "var(--cat-3)" }]} />
        </Chart>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <List title="Pagina's" note="weergaven · binnenkomst" rows={L.pages} />
        <div className="space-y-4">
          <List title="Kanalen" note="bezoeken" rows={L.channels} />
          <List title="Verwijzende sites" note="bezoeken" rows={L.refs} />
          <List title="Campagnes" note="utm_source / medium / campaign" rows={L.campaigns} />
        </div>
        <div className="space-y-4">
          <List title="Landen" note="bezoeken" rows={L.countries} label={country} />
          <List title="Apparaat" note="bezoeken" rows={L.devices} />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <List title="Downloads" note="per grafiek · soort" rows={L.downloads} />
        <List title="Interactie per grafiek" note="acties · bezoeken met interactie" rows={L.charts} />
        <div className="space-y-4">
          <List title="Gekozen schakelaars en klikken" note="per grafiek · keuze" rows={L.choices} />
          <List title="Uitgaande links" note="klikken naar andere sites" rows={L.outbound} />
        </div>
      </div>
    </div>
  );
}

async function Body({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const q = await searchParams;
  const period: Period = q.periode && q.periode in PERIODS ? (q.periode as Period) : "30";
  return (
    <>
      <nav className="flex flex-wrap gap-1 text-sm" aria-label="Periode">
        {(Object.keys(PERIODS) as Period[]).map((k) => (
          <Link key={k} href={`/beheer?periode=${k}`} className={`rounded-md border px-3 py-1 ${k === period ? "border-series-1 bg-series-1/10 font-medium text-ink" : "border-border text-ink-2 hover:text-ink"}`}>
            {PERIODS[k]}
          </Link>
        ))}
      </nav>
      <Stats period={period} />
    </>
  );
}

export default function Beheer({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Beheer</h1>
          <p className="mt-1 text-sm text-ink-2">Bezoekers zonder cookies of IP-adressen. Jijzelf, bots en geautomatiseerde browsers tellen niet mee.</p>
        </div>
        <Link href="/ops" className="rounded-md border border-border px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-1 hover:text-ink">Dune-runs & kosten →</Link>
      </header>
      <NotCounted />
      <Suspense fallback={<p className="text-sm text-ink-3">Laden…</p>}>
        <Body searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
