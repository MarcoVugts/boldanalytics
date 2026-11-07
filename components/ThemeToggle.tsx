"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const systemTheme = (): Theme => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

/** Light/dark switch. Starts from the device setting; a choice is remembered in localStorage
 *  and applied before paint by the inline script in app/layout.tsx (no flash). */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const set = document.documentElement.dataset.theme as Theme | undefined;
    setTheme(set ?? systemTheme());
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch { /* private mode: not remembered */ }
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      className="ml-auto flex h-8 w-8 items-center justify-center rounded-md border border-border text-ink-2 hover:bg-surface-1 hover:text-ink"
    >
      {/* render nothing until mounted, so server and client markup match */}
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      ) : theme === "light" ? (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      ) : null}
    </button>
  );
}
