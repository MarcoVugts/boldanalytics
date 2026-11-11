/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Visualizations",
  description: "Charts and animations on onchain data that tell the story at a glance.",
};

const R = "/stories/record-day";
type Viz = { title: string; text: string; source: { href: string; label: string }; wide?: boolean } & (
  | { video: string; poster: string }
  | { img: string; alt: string }
);

const VIZ: Viz[] = [
  {
    title: "Every trade of a day, one dot each",
    text: "272,679 trades in 30 seconds: who traded, through which exchange, in which stock. You see the market wake up when New York opens.",
    video: `${R}/day-in-motion.mp4`,
    poster: `${R}/day-in-motion-poster.jpg`,
    source: { href: "/dashboards/tokenized-stocks", label: "Tokenized stocks on Base" },
    wide: true,
  },
  {
    title: "Trading never sleeps",
    text: "Volume per hour by operator: activity around the clock, with every operator peaking at the same moment.",
    img: `${R}/trading-never-sleeps.jpg`,
    alt: "Heatmap of volume per hour by operator",
    source: { href: "/dashboards/tokenized-stocks", label: "Tokenized stocks on Base" },
  },
  {
    title: "How a market maker trades",
    text: "Millions in volume, bought and sold in equal amounts, while the position never moves: a market maker's fingerprint in one chart.",
    img: `${R}/how-a-market-maker-trades.jpg`,
    alt: "Buys, sells and net position of one market-making wallet",
    source: { href: "/dashboards/tokenized-stocks", label: "Tokenized stocks on Base" },
  },
  {
    title: "The race through the day",
    text: "Cumulative volume per asset, minute by minute: which ones lead, and when the order changes.",
    video: `${R}/stock-race.mp4`,
    poster: `${R}/stock-race-poster.jpg`,
    source: { href: "/dashboards/tokenized-stocks", label: "Tokenized stocks on Base" },
  },
];

export default function Visualizations() {
  return (
    <div className="space-y-8 sm:space-y-10">
      <header className="max-w-2xl space-y-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Visualizations</h1>
        <p className="text-ink-2">Charts and animations that tell the story at a glance, made to be understood and shared.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        {VIZ.map((v) => (
          <figure key={v.title} className={`flex flex-col overflow-hidden rounded-lg border border-border bg-surface-1 ${v.wide ? "md:col-span-3 md:grid md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : ""}`}>
            {"video" in v ? (
              <video
                className="block aspect-square w-full bg-[#f8f0e8]"
                src={v.video}
                poster={v.poster}
                muted
                loop
                playsInline
                controls
                autoPlay={v.wide}
                preload={v.wide ? "metadata" : "none"}
                aria-label={v.title}
              />
            ) : (
              <a href={v.img} target="_blank">
                <img className="block aspect-square w-full bg-[#f8f0e8]" src={v.img} alt={v.alt} loading="lazy" />
              </a>
            )}
            <figcaption className={`flex flex-1 flex-col gap-2 p-5 ${v.wide ? "md:justify-center md:p-8" : ""}`}>
              <h2 className={`font-bold tracking-tight ${v.wide ? "text-2xl" : "text-lg"}`}>{v.title}</h2>
              <p className="text-sm text-ink-2">{v.text}</p>
              <Link href={v.source.href} className="mt-auto pt-2 text-xs text-ink-3 hover:text-ink-2">
                From: {v.source.label} →
              </Link>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
