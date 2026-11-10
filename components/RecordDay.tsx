/* eslint-disable @next/next/no-img-element */
// "A closer look: the record day" — pre-rendered video and charts for 6 Nov 2026 (animations/day-flow,
// data from sql/dune/day_trades.sql, day_flow_minutes.sql and day_sides_minutes.sql). Static files in
// public/stories/record-day, so this section costs no database or Dune queries.
const BASE = "/stories/record-day";

function Figure({ children, caption }: { children: React.ReactNode; caption: string }) {
  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-surface-1">
      {children}
      <figcaption className="px-4 py-3 text-xs text-ink-3">{caption}</figcaption>
    </figure>
  );
}

export function RecordDay() {
  return (
    <section className="space-y-4" id="record-day">
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight">A closer look: the record day (6 Nov)</h2>
        <p className="max-w-2xl text-sm text-ink-2">
          $150M of on-chain DEX volume across 272,679 trades. 98% went through Aerodrome, about two thirds came from three
          market makers, and trading ran around the clock, busiest at the NYSE open.
        </p>
      </div>

      <div className="mx-auto max-w-3xl">
      <Figure caption="Every on-chain DEX trade on 6 Nov, one dot per trade, sized by volume: operator → DEX → stock. 30 seconds for 24 hours (UTC).">
        <video
          className="block w-full bg-[#f8f0e8]"
          src={`${BASE}/day-in-motion.mp4`}
          poster={`${BASE}/day-in-motion-poster.jpg`}
          autoPlay
          muted
          loop
          playsInline
          controls
          preload="metadata"
          aria-label="Animation of every tokenized-stock DEX trade on Base on 6 November 2026"
        />
      </Figure>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Figure caption="Volume per hour by operator. Trading never stops; every operator peaks at the NYSE open.">
          <a href={`${BASE}/trading-never-sleeps.jpg`} target="_blank">
            <img className="block w-full" src={`${BASE}/trading-never-sleeps.jpg`} alt="Heatmap of DEX volume per hour by operator on 6 November" loading="lazy" />
          </a>
        </Figure>
        <Figure caption="Unknown market maker A on SNDK: $5.5M traded, bought and sold in equal amounts, never more than $5K held.">
          <a href={`${BASE}/how-a-market-maker-trades.jpg`} target="_blank">
            <img className="block w-full" src={`${BASE}/how-a-market-maker-trades.jpg`} alt="Buys and sells per 5 minutes and net position of a market maker on SNDK" loading="lazy" />
          </a>
        </Figure>
        <Figure caption="Cumulative volume per stock through the day (top 8).">
          <video
            className="block w-full bg-[#f8f0e8]"
            src={`${BASE}/stock-race.mp4`}
            poster={`${BASE}/stock-race-poster.jpg`}
            muted
            loop
            playsInline
            controls
            preload="none"
            aria-label="Bar chart race of cumulative volume per stock on 6 November"
          />
        </Figure>
      </div>
    </section>
  );
}
