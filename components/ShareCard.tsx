"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";

const EXPORT_WIDTH = 1200; // layout width; exported at 3x = 3600px (X accepts up to 4096px)
const PIXEL_RATIO = 3;

const fmtDay = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "5 – 6 Nov 2026", "28 Oct – 6 Nov 2026" or "6 Nov 2026" */
export function formatPeriod(from?: string | null, to?: string | null) {
  if (!from && !to) return "";
  if (!from || !to || from === to) return fmtDay((from ?? to)!);
  const [a, b] = [new Date(`${from}T00:00:00Z`), new Date(`${to}T00:00:00Z`)];
  const sameYear = a.getUTCFullYear() === b.getUTCFullYear();
  const sameMonth = sameYear && a.getUTCMonth() === b.getUTCMonth();
  const left = a.toLocaleDateString("en-GB", { day: "numeric", ...(sameMonth ? {} : { month: "short" }), ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC" });
  return `${left} – ${fmtDay(to)}`;
}

/**
 * A chart card with an "Image" button. On export the card is re-rendered off-screen at a
 * fixed width with Bold Analytics branding, captured as PNG, then shared (mobile share
 * sheet) or downloaded.
 */
export function ShareCard({
  title,
  sub,
  slug,
  asOf,
  from,
  children,
}: {
  title: string;
  sub?: string;
  slug: string;
  /** last day covered (YYYY-MM-DD) */
  asOf?: string;
  /** first day covered (YYYY-MM-DD) */
  from?: string;
  children: React.ReactNode;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [placeholderH, setPlaceholderH] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // A chart can narrow the period (e.g. a single selected day) via data-period-from/-to.
  const [period, setPeriod] = useState("");

  async function exportImage() {
    if (!frame.current || exporting) return;
    setError(null);
    setPlaceholderH(frame.current.offsetHeight);
    const narrowed = frame.current.querySelector<HTMLElement>("[data-period-from]");
    const pf = narrowed?.dataset.periodFrom || from;
    const pt = narrowed?.dataset.periodTo || asOf;
    setPeriod(formatPeriod(pf, pt));
    setExporting(true);
    try {
      // let charts re-measure at the export width (ResizeObserver) before capturing
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((r) => setTimeout(r, 300));
      const node = frame.current!;
      const bg = getComputedStyle(node).getPropertyValue("--surface-0").trim() || "#f6f6f4";
      const dataUrl = await toPng(node, {
        pixelRatio: PIXEL_RATIO,
        cacheBust: true,
        backgroundColor: bg,
        // the live node sits off-screen; render the clone in normal flow
        style: { position: "static", left: "auto", top: "auto", zIndex: "auto" },
        width: EXPORT_WIDTH,
        filter: (n) => !(n instanceof HTMLElement && n.dataset.noExport !== undefined),
      });
      const name = `boldanalytics-${slug}-${(pf ?? "")}${pt && pt !== pf ? `_${pt}` : ""}.png`.replace(/-\.png$/, ".png");
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], name, { type: "image/png" });
      const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
      if (touch && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title });
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = name;
        a.click();
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setError("Could not create image");
      console.error(e);
    } finally {
      setExporting(false);
    }
  }

  const card = (
    <section
      ref={frame}
      className={`min-w-0 rounded-lg border border-border bg-surface-1 ${exporting ? "export-light p-10 text-ink" : "p-4"}`}
      style={exporting ? { position: "fixed", left: -20000, top: 0, width: EXPORT_WIDTH, zIndex: -1 } : undefined}
    >
      {exporting && (
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-bold tracking-tight text-ink">Bold Analytics</span>
          <span className="text-ink-3">Tokenized Stocks on Base</span>
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={`${exporting ? "text-2xl font-semibold" : "text-sm font-medium"} text-ink`}>{title}</h2>
          {sub && (
            <p className={`mt-0.5 ${exporting ? "text-sm" : "text-xs"} text-ink-3`}>
              {/* interaction hints make no sense in a static image */}
              {exporting ? sub.replace(/\s*Hover[^.]*\./g, "") : sub}
            </p>
          )}
        </div>
        {exporting && period && (
          <div className="shrink-0 rounded-md bg-surface-0 px-3 py-1.5 text-right">
            <div className="text-base font-semibold text-ink">{period}</div>
            <div className="text-xs text-ink-3">UTC · daily data</div>
          </div>
        )}
        <button
          data-no-export
          onClick={exportImage}
          disabled={exporting}
          title="Download as image (for X)"
          className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-ink-2 hover:bg-surface-0 hover:text-ink disabled:opacity-50"
        >
          {exporting ? "…" : "↓ Image"}
        </button>
      </div>
      <div className="mt-4">{children}</div>
      {exporting && (
        <div className="mt-6 flex items-center justify-between border-t border-border pt-3 text-xs text-ink-3">
          <span>boldanalytics.io/stories/tokenized-stocks</span>
          <span>Data via Dune{period ? ` · ${period} (UTC)` : ""} · Not financial advice</span>
        </div>
      )}
      {error && <p data-no-export className="mt-2 text-xs text-critical">{error}</p>}
    </section>
  );

  // Placeholder keeps the page layout stable while the card renders off-screen. The card
  // stays at the same position in the tree, so chart state (toggles) survives the export.
  return (
    <>
      {exporting && <div style={{ height: placeholderH }} className="rounded-lg border border-dashed border-border" />}
      {card}
    </>
  );
}
