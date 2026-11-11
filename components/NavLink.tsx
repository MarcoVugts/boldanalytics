"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Header link with an accent underline when its section is active. */
const ICONS = {
  // dashboard: tiles of different sizes
  dashboards: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  // visualization: flowing lines with a point
  visualizations: (
    <>
      <path d="M3 17c3.5 0 4.5-10 9-10s5.5 6 9 6" />
      <path d="M3 21c4 0 5-5 9-5s5 3 9 3" opacity=".6" />
      <circle cx="12" cy="7" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
};

export function NavLink({ href, match, icon, children }: { href: string; match: string; icon?: keyof typeof ICONS; children: React.ReactNode }) {
  const active = usePathname()?.startsWith(match);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex h-full items-center whitespace-nowrap text-sm transition-colors ${active ? "font-semibold text-ink" : "text-ink-2 hover:text-ink"}`}
    >
      {icon && (
        <svg viewBox="0 0 24 24" aria-hidden className={`mr-1.5 size-4 shrink-0 fill-none max-[380px]:hidden stroke-current stroke-[1.8] ${active ? "text-series-1" : ""}`} strokeLinecap="round" strokeLinejoin="round">
          {ICONS[icon]}
        </svg>
      )}
      {children}
      {active && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-series-1" />}
    </Link>
  );
}
