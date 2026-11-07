"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";

const EXPORT_WIDTH = 1200; // X shows 1200px-wide images crisply; exported at 2x

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
  children,
}: {
  title: string;
  sub?: string;
  slug: string;
  asOf?: string;
  children: React.ReactNode;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [placeholderH, setPlaceholderH] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function exportImage() {
    if (!frame.current || exporting) return;
    setError(null);
    setPlaceholderH(frame.current.offsetHeight);
    setExporting(true);
    try {
      // let charts re-measure at the export width (ResizeObserver) before capturing
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((r) => setTimeout(r, 300));
      const node = frame.current!;
      const bg = getComputedStyle(document.body).backgroundColor;
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: bg,
        // the live node sits off-screen; render the clone in normal flow
        style: { position: "static", left: "auto", top: "auto", zIndex: "auto" },
        width: EXPORT_WIDTH,
        filter: (n) => !(n instanceof HTMLElement && n.dataset.noExport !== undefined),
      });
      const name = `boldanalytics-${slug}${asOf ? `-${asOf}` : ""}.png`;
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
      className={`min-w-0 rounded-lg border border-border bg-surface-1 ${exporting ? "p-10" : "p-4"}`}
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
          <span>Data via Dune{asOf ? ` · through ${asOf} UTC` : ""} · Not financial advice</span>
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
