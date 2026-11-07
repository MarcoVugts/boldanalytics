"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Header link with an accent underline when its section is active. */
export function NavLink({ href, match, children }: { href: string; match: string; children: React.ReactNode }) {
  const active = usePathname()?.startsWith(match);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex h-full items-center whitespace-nowrap text-sm transition-colors ${active ? "font-semibold text-ink" : "text-ink-2 hover:text-ink"}`}
    >
      {children}
      {active && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-series-1" />}
    </Link>
  );
}
