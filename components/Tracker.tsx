"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackView } from "@/lib/tracking";

/** Meet elke paginaweergave (ook bij navigeren binnen de site). Zie lib/tracking.ts. */
export function Tracker() {
  const path = usePathname();
  useEffect(() => {
    if (path) trackView(path);
  }, [path]);
  return null;
}
