"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackEvent, trackView } from "@/lib/tracking";

/** Meet elke paginaweergave (ook bij navigeren binnen de site). Zie lib/tracking.ts. */
export function Tracker() {
  const path = usePathname();
  useEffect(() => {
    if (path) trackView(path);
  }, [path]);
  // chart interactions, without touching every chart: switches (role=radio) inside a [data-chart] card, the first
  // hover on a chart per page view, and clicks on links to other sites
  useEffect(() => {
    const hovered = new Set<string>();
    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el?.closest) return;
      const chart = el.closest<HTMLElement>("[data-chart]")?.dataset.chart;
      const radio = el.closest<HTMLElement>('[role="radio"]');
      if (radio && chart && radio.getAttribute("aria-checked") !== "true") {
        const group = radio.closest<HTMLElement>('[role="radiogroup"]')?.getAttribute("aria-label");
        trackEvent("toggle", chart, `${group ? `${group}: ` : ""}${radio.textContent?.trim() ?? ""}`);
        return;
      }
      const a = el.closest<HTMLAnchorElement>("a[href]");
      if (a && a.host && a.host !== window.location.host && /^https?:$/.test(a.protocol)) trackEvent("outbound", a.host, a.pathname.slice(0, 60));
    };
    const onOver = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el?.closest || !el.closest("svg, canvas")) return;
      const chart = el.closest<HTMLElement>("[data-chart]")?.dataset.chart;
      if (chart && !hovered.has(chart)) { hovered.add(chart); trackEvent("hover", chart); }
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("pointerover", onOver, { passive: true });
    return () => { document.removeEventListener("click", onClick, true); document.removeEventListener("pointerover", onOver); };
  }, [path]);
  return null;
}
