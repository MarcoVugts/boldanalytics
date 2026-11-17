/* eslint-disable @next/next/no-img-element */
import logos from "@/lib/logos.json";

const STOCKS = new Set(logos.stocks);
const DEXES = new Set(logos.dex);

/** Small round logo for a stock (by ticker) or a DEX (by grouped name); a neutral ticker badge when we have none. */
export function EntityLogo({ kind, name, size = 18 }: { kind: "stock" | "dex"; name: string; size?: number }) {
  const has = kind === "stock" ? STOCKS.has(name) : DEXES.has(name);
  if (has)
    return <img src={`/logos/${kind === "stock" ? "stocks" : "dex"}/${name}.svg`} alt="" width={size} height={size} className="inline-block shrink-0 rounded-full ring-1 ring-border" />;
  const text = name.startsWith("Other") ? "…" : name.replace(/[^A-Za-z0-9]/g, "").slice(0, kind === "stock" ? 2 : 1).toUpperCase();
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-0 font-semibold text-ink-2 ring-1 ring-border"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {text}
    </span>
  );
}
