"use client";

import { useEffect, useState } from "react";
import { OPT_OUT_KEY } from "@/lib/tracking";

/** Op /beheer: dit apparaat telt voortaan niet mee. Gaat vanzelf aan bij de eerste keer; met de knop terug te draaien. */
export function NotCounted() {
  const [off, setOff] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      if (localStorage.getItem(OPT_OUT_KEY) === null) localStorage.setItem(OPT_OUT_KEY, "1");
      setOff(localStorage.getItem(OPT_OUT_KEY) === "1");
    } catch {
      setOff(null);
    }
  }, []);
  const set = (v: boolean) => {
    try {
      localStorage.setItem(OPT_OUT_KEY, v ? "1" : "0");
      setOff(v);
    } catch {
      /* geen opslag */
    }
  };
  if (off === null) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface-1 px-4 py-2.5 text-sm">
      <span>{off ? "✓ Dit apparaat telt niet mee in de statistieken." : "Dit apparaat telt mee in de statistieken."}</span>
      <button type="button" onClick={() => set(!off)} className="font-semibold text-series-1 hover:underline">
        {off ? "Toch laten meetellen" : "Niet meer meetellen"}
      </button>
    </p>
  );
}
