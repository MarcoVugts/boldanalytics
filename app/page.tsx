import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-2xl space-y-6 py-12">
      <h1 className="text-4xl font-bold tracking-tight">Onchain data, explained.</h1>
      <p className="text-lg text-ink-2">
        Custom dashboards and research for blockchain companies — flows, cohorts and wallet labels, not just another chart.
      </p>
      <Link
        href="/stories/tokenized-stocks"
        className="inline-block rounded-md bg-ink px-4 py-2 text-sm font-medium text-surface-1 hover:opacity-90"
      >
        Data story: Tokenized Stocks →
      </Link>
    </div>
  );
}
