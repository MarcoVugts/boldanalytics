"use client";

import { useEffect, useState } from "react";

type Choice = "system" | "light" | "dark";
const NEXT: Record<Choice, Choice> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Choice, string> = { system: "System theme", light: "Light theme", dark: "Dark theme" };

const ICON: Record<Choice, React.ReactNode> = {
  light: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  dark: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  system: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
};

/** One button that cycles system → light → dark. The icon shows the current setting. A light/dark choice is
 *  remembered in localStorage and applied before paint by the inline script in app/layout.tsx (no flash);
 *  "system" removes it, so the CSS follows prefers-color-scheme. */
export function ThemeToggle() {
  const [choice, setChoice] = useState<Choice | null>(null);

  useEffect(() => {
    const set = document.documentElement.dataset.theme;
    setChoice(set === "light" || set === "dark" ? set : "system");
  }, []);

  const cycle = () => {
    const next = NEXT[choice ?? "system"];
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

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={choice ? `${LABEL[choice]} (click to change)` : "Change theme"}
      title={choice ? LABEL[choice] : undefined}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-ink-2 transition-colors hover:bg-surface-1 hover:text-ink"
    >
      {/* render nothing until mounted, so server and client markup match */}
      {choice && (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {ICON[choice]}
        </svg>
      )}
    </button>
  );
}
