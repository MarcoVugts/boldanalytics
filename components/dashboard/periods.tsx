"use client";

export type Grain = "day" | "week" | "month";
export const GRAINS: { key: Grain; label: string }[] = [
  { key: "day", label: "Daily" },
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dm = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;

/** Axis tick and tooltip label for a period key (YYYY-MM-DD; week = its Monday, month = its first day). */
export function periodLabels(g: Grain, first?: string, last?: string) {
  const bucket = (d?: string) => {
    if (!d) return "";
    if (g === "day") return d;
    if (g === "month") return `${d.slice(0, 7)}-01`;
    const t = new Date(`${d}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
    return t.toISOString().slice(0, 10);
  };
  const partial = (x: string) => (g !== "day" && (x === bucket(first) || x === bucket(last)) ? " (partial)" : "");
  return {
    tick: g === "month" ? (x: string) => MONTHS[Number(x.slice(5, 7)) - 1] : (x: string) => x.slice(5),
    long:
      g === "day"
        ? (x: string) => `${dm(x)} ${x.slice(0, 4)} (UTC)`
        : g === "week"
          ? (x: string) => `Week of ${dm(x)}${partial(x)}`
          : (x: string) => `${MONTHS[Number(x.slice(5, 7)) - 1]} ${x.slice(0, 4)}${partial(x)}`,
  };
}

/** Small segmented control. */
export function Toggle<T>({ label, options, value, onChange }: { label: string; options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-md border border-border p-0.5 text-xs">
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
