import { EntityLogo } from "../EntityLogo";
import { Delta } from "./Kpi";
import { usd } from "@/lib/format";
import type { KeyStat } from "@/app/dashboards/tokenized-stocks/shared";

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const W = 72, H = 20, max = Math.max(...values, 1);
  const d = values.map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * W).toFixed(1)} ${(H - 1 - (v / max) * (H - 2)).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden className="inline-block">
      <path d={d} fill="none" stroke="var(--series-1)" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function Change({ v, ch }: { v: number; ch: number | null }) {
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <span className="tabular-nums">{usd(v)}</span>
      {ch != null && Number.isFinite(ch) ? <Delta value={ch} /> : <span className="text-xs text-ink-3">–</span>}
    </span>
  );
}

/** Volume per stock or DEX: logo, total, share, last 7 / 30 days with change, 30-day trend. Long lists fold away. */
export function KeyTable({ rows, kind, label, show = 12 }: { rows: KeyStat[]; kind: "stock" | "dex"; label: string; show?: number }) {
  const head = rows.slice(0, show), rest = rows.slice(show);
  const Row = ({ r }: { r: KeyStat }) => (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-3">
        <span className="flex items-center gap-2 font-medium">
          <EntityLogo kind={kind} name={r.key} />
          {r.key}
        </span>
      </td>
      <td className="py-2 pr-3 text-right tabular-nums">{usd(r.total)}</td>
      <td className="hidden py-2 pr-3 text-right tabular-nums text-ink-2 sm:table-cell">{(r.share * 100).toFixed(1)}%</td>
      <td className="py-2 pr-3 text-right"><Change v={r.v7} ch={r.ch7} /></td>
      <td className="py-2 pr-3 text-right"><Change v={r.v30} ch={r.ch30} /></td>
      <td className="hidden py-2 text-right sm:table-cell"><Spark values={r.spark} /></td>
    </tr>
  );
  const thead = (
    <thead className="text-left text-xs text-ink-3">
      <tr className="border-b border-border">
        <th className="py-2 pr-3 font-normal">{label}</th>
        <th className="py-2 pr-3 text-right font-normal">Volume</th>
        <th className="hidden py-2 pr-3 text-right font-normal sm:table-cell">Share</th>
        <th className="py-2 pr-3 text-right font-normal" title="Last 7 days vs the 7 days before">7 days</th>
        <th className="py-2 pr-3 text-right font-normal" title="Last 30 days vs the 30 days before">30 days</th>
        <th className="hidden py-2 text-right font-normal sm:table-cell">Last 30 days</th>
      </tr>
    </thead>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        {thead}
        <tbody>{head.map((r) => <Row key={r.key} r={r} />)}</tbody>
      </table>
      {rest.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-ink-3 hover:text-ink-2">Show all {rows.length}</summary>
          <table className="mt-1 w-full text-sm">
            <tbody>{rest.map((r) => <Row key={r.key} r={r} />)}</tbody>
          </table>
        </details>
      )}
      <p className="mt-2 text-xs text-ink-3">Change: last 7 / 30 days compared with the 7 / 30 days before (up to the latest loaded day).</p>
    </div>
  );
}
