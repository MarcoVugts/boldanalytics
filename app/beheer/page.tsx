import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { BarChart } from "@/components/BarChart";
import { NotCounted } from "@/components/NotCounted";
import { Stat } from "@/components/Stat";
import { int } from "@/lib/format";
import { getVisitStats, type Row } from "@/lib/queries/visits";

export const metadata: Metadata = { title: "Beheer", robots: { index: false, follow: false } };

const EXCLUDED: Record<string, string> = { self: "Eigen apparaat", bot: "Bots", auto: "Geautomatiseerde browser" };

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

async function Stats() {
  await connection(); // altijd actueel, niet gecachet
  const s = await getVisitStats();
  if (!s) return <p className="text-sm text-ink-3">Geen database.</p>;
  const t = (k: string) => s.totals.find((x) => x.k === k) ?? { views: 0, visits: 0, visitors: 0, fresh: 0 };
  return (
    <div className="space-y-6">
      {(["today", "7d", "30d"] as const).map((k) => (
        <div key={k}>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-3">{k === "today" ? "Vandaag" : k === "7d" ? "Laatste 7 dagen" : "Laatste 30 dagen"}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Unieke bezoekers" value={int(t(k).visitors)} />
            <Stat label="Bezoeken" value={int(t(k).visits)} />
            <Stat label="Paginaweergaven" value={int(t(k).views)} />
            <Stat label="Nieuwe bezoekers" value={int(t(k).fresh)} note="eerste bezoek in die browser" />
          </div>
        </div>
      ))}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface-1 p-4">
          <h2 className="text-sm font-medium">Unieke bezoekers per dag</h2>
          <div className="mt-3"><BarChart unit="count" label="Unieke bezoekers per dag" data={s.days.map((d) => ({ x: d.day, y: d.visitors }))} /></div>
        </section>
        <section className="rounded-lg border border-border bg-surface-1 p-4">
          <h2 className="text-sm font-medium">Paginaweergaven per dag</h2>
          <div className="mt-3"><BarChart unit="count" label="Paginaweergaven per dag" data={s.days.map((d) => ({ x: d.day, y: d.views }))} /></div>
        </section>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <List title="Pagina's" note="weergaven · binnenkomst (30 dagen)" rows={s.pages} />
        <List title="Herkomst" note="bezoeken per bron (30 dagen)" rows={s.sources} label={(k) => (k === "direct" ? "Direct / onbekend" : k)} />
        <div className="space-y-4">
          <List title="Apparaat" note="bezoeken (30 dagen)" rows={s.devices} />
          <List title="Niet meegeteld" note="paginaweergaven (30 dagen)" rows={s.excluded} label={(k) => EXCLUDED[k] ?? k} />
        </div>
      </div>
    </div>
  );
}

export default function Beheer() {
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
        <Stats />
      </Suspense>
    </div>
  );
}
