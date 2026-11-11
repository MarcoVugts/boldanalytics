/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Dashboards",
  description: "Live dashboards on onchain data, updated automatically.",
};

const DASHBOARDS = [
  {
    href: "/dashboards/tokenized-stocks",
    title: "Tokenized stocks on Base",
    text: "Who trades Coinbase's tokenized stocks onchain: daily volume, active wallets, trader segments, market makers and how the volume flows.",
    img: "/stories/record-day/trading-never-sleeps-600.jpg",
    alt: "Heatmap of tokenized-stock volume per hour by operator",
  },
];

export default function Dashboards() {
  return (
    <div className="space-y-8 sm:space-y-10">
      <header className="max-w-2xl space-y-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Dashboards</h1>
        <p className="text-ink-2">Live dashboards on onchain data, built and hosted by us and updated automatically.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {DASHBOARDS.map((d) => (
          <Link key={d.href} href={d.href} className="group flex flex-col overflow-hidden rounded-lg border border-border bg-surface-1">
            <div className="relative">
              <img src={d.img} alt={d.alt} className="block aspect-[16/10] w-full bg-[#f8f0e8] object-cover object-top" />
              <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-surface-1/90 px-2.5 py-1 text-xs font-medium text-ink shadow-sm">
                <span className="size-1.5 rounded-full bg-good" /> Live
              </span>
            </div>
            <div className="space-y-2 p-5">
              <h2 className="text-xl font-bold tracking-tight">{d.title}</h2>
              <p className="text-sm text-ink-2">{d.text}</p>
              <span className="inline-block text-sm font-medium group-hover:underline">Open dashboard →</span>
            </div>
          </Link>
        ))}
        <div className="flex min-h-48 flex-col justify-center rounded-lg border border-dashed border-border p-6 text-ink-3">
          <div className="font-brand text-lg font-bold text-ink-2">More dashboards coming</div>
          <p className="mt-1 text-sm">Want one for your project? Custom dashboards can be public or private.</p>
        </div>
      </div>
    </div>
  );
}
