"use client";

import { useEffect, useRef, useState } from "react";

/** Width of a container element, kept in sync with ResizeObserver. */
export function useWidth<T extends HTMLElement>(initial = 640) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export const shortAddr = (a: string) => (a.startsWith("0x") && a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
