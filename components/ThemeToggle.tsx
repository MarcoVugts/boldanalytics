"use client";

import { useEffect, useState } from "react";

type Choice = "light" | "system" | "dark";

/** Three-way theme switch: light, system (follow the device), dark. A light/dark choice is remembered in
 *  localStorage and applied before paint by the inline script in app/layout.tsx (no flash); "system" removes it,
 *  so the CSS falls back to prefers-color-scheme. */
export function ThemeToggle() {
  const [choice, setChoice] = useState<Choice | null>(null);

  useEffect(() => {
    const set = document.documentElement.dataset.theme;
    setChoice(set === "light" || set === "dark" ? set : "system");
  }, []);

  const pick = (next: Choice) => {
    const root = document.documentElement;
    try {
      if (next === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {
      /* private mode: not remembered */
    }
    if (next === "system") delete root.dataset.theme;
    else root.dataset.theme = next;
    setChoice(next);
  };

  const OPTIONS: { value: Choice; label: string; icon: React.ReactNode }[] = [
    {
      value: "light",
      label: "Light",
      icon: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    },
    {
      value: "system",
      label: "System",
      icon: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
    },
    { value: "dark", label: "Dark", icon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /> },
  ];

  return (
    <div role="radiogroup" aria-label="Theme" className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border p-0.5">
      {OPTIONS.map((o) => {
        const on = choice === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.label}
            title={o.label}
            onClick={() => pick(o.value)}
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${on ? "bg-series-1/10 text-ink" : "text-ink-3 hover:text-ink"}`}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {o.icon}
            </svg>
          </button>
        );
      })}
    </div>
  );
}
