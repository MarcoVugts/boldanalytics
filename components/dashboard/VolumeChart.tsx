"use client";

import { useMemo, useState } from "react";
import { BarChart, type Series } from "../BarChart";
import { useWidth } from "../useWidth";

type Day = { x: string; y: number; parts: Record<string, number> };
type Period = "day" | "week" | "month";

const PERIODS: { key: Period; label: string }[] = [
  { key: "day", label: "Daily" },
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
];

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const fmtDay = (d: string) =>
  `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;

/** Bucket key: the day itself, the Monday of its ISO week, or YYYY-MM. */
function bucket(day: string, p: Period) {
  if (p === "day") return day;
  if (p === "month") return day.slice(0, 7);
  const t = new Date(`${day}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
}

function aggregate(days: Day[], p: Period): Day[] {
  if (p === "day") return days;
  const m = new Map<string, Day>();
  for (const d of days) {
    const k = bucket(d.x, p);
    const cur = m.get(k) ?? { x: k, y: 0, parts: {} };
    cur.y += d.y;
    for (const [s, v] of Object.entries(d.parts))
      cur.parts[s] = (cur.parts[s] ?? 0) + v;
    m.set(k, cur);
  }
  return [...m.values()];
}

function Toggle<T>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex rounded-md border border-border p-0.5 text-xs"
    >
      {options.map((o) => (
        <button
          key={String(o.key)}
          type="button"
          role="radio"
          aria-checked={value === o.key}
          onClick={() => onChange(o.key)}
          className={`rounded px-2.5 py-1 font-medium ${value === o.key ? "bg-series-1/10 text-ink" : "text-ink-3 hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Volume per day, week or month, as one total bar or split by stock (top N + Other). */
export function VolumeChart({
  days,
  symbols,
  markMax = true,
}: {
  days: Day[];
  symbols: string[];
  markMax?: boolean;
}) {
  const [split, setSplit] = useState(true);
  const [period, setPeriod] = useState<Period>("day");
  const [ref, width] = useWidth<HTMLDivElement>(720);
  const data = useMemo(() => aggregate(days, period), [days, period]);

  // Colour follows the stock (fixed order by total volume); Other is neutral and sits on top.
  const series: Series[] = [
    ...symbols.map((s, i) => ({ key: s, color: `var(--cat-${i + 1})` })),
    { key: "Other", color: "var(--neutral-mark)" },
  ];
  const first = days[0]?.x,
    last = days[days.length - 1]?.x;
  const partial = (x: string) =>
    period !== "day" &&
    (x === bucket(first, period) || x === bucket(last, period))
      ? " (partial)"
      : "";
  const tick =
    period === "month"
      ? (x: string) => `${MONTHS[Number(x.slice(5, 7)) - 1]}`
      : (x: string) => x.slice(5);
  const long =
    period === "day"
      ? (x: string) => `${fmtDay(x)} ${x.slice(0, 4)} (UTC)`
      : period === "week"
        ? (x: string) => `Week of ${fmtDay(x)}${partial(x)}`
        : (x: string) =>
            `${MONTHS[Number(x.slice(5, 7)) - 1]} ${x.slice(0, 4)}${partial(x)}`;

  return (
    <div ref={ref} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Toggle
          label="Period"
          options={PERIODS}
          value={period}
          onChange={setPeriod}
        />
        <Toggle
          label="View"
          options={[
            { key: false, label: "Total" },
            { key: true, label: "By stock" },
          ]}
          value={split}
          onChange={setSplit}
        />
      </div>
      {split && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-sm"
                style={{ background: s.color }}
              />
              {s.key}
            </li>
          ))}
        </ul>
      )}
      <BarChart
        key={period}
        unit="usd"
        height={width < 500 ? 260 : 320}
        label={`${PERIODS.find((p) => p.key === period)!.label} DEX volume${split ? " by stock" : ""} in USD`}
        markMax={markMax ? `record ${period}` : undefined}
        series={split ? series : undefined}
        tickLabel={tick}
        longLabel={long}
        data={data}
      />
    </div>
  );
}
