"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type Tab = { href: string; label: string };

/** Section tabs inside one dashboard. Horizontally scrollable on phones; same weight in both states (no shift). */
export function DashboardTabs({ tabs }: { tabs: Tab[] }) {
  const path = usePathname();
  return <TabRow tabs={tabs} active={tabs.find((t) => t.href === path)?.href} />;
}

/** Static row without an active tab (Suspense fallback). */
export function TabRow({ tabs, active }: { tabs: Tab[]; active?: string }) {
  return (
    <nav aria-label="Dashboard sections" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex w-max gap-1 rounded-lg border border-border bg-surface-1 p-1">
        {tabs.map((t) => {
          const on = t.href === active;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? "page" : undefined}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${on ? "bg-series-1/10 text-ink" : "text-ink-2 hover:bg-surface-0 hover:text-ink"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
