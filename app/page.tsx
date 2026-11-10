/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

const STATS = [
  { value: "5+", label: "years in onchain data" },
  { value: "125+", label: "dashboards built on Dune" },
  { value: "150K+", label: "views on our Dune dashboards" },
];

const SERVICES = [
  {
    title: "Custom dashboards",
    text: "Your own dashboard on your own site: public for your community or private for your team, updated automatically from onchain data.",
  },
  {
    title: "Visualizations",
    text: "Charts and animations people actually share: flows, networks, a whole trading day in thirty seconds.",
  },
  {
    title: "Reports",
    text: "Deep dives that answer one question well: who trades, who stays, who the market makers are, and what it means for you.",
  },
];

// Ordered: active teams first, sunset projects after, Abstract last. Logos are monochrome masks in public/clients
// (CSS mask, so they take the text colour in light and dark mode). `mark` = icon only, shown with the name next to it;
// `word` = full wordmark [file, width/height ratio, height in px to balance visual weight].
type Client = { name: string; work: string; mark?: string; word?: [string, number, number] };
const CLIENTS: Client[] = [
  { name: "OpenSea", mark: "opensea.svg", work: "User segmentation" },
  { name: "Layer3", word: ["layer3.svg", 4752 / 792, 21], work: "Quest dashboards" },
  { name: "Spindl", word: ["spindl.svg", 2668 / 768, 28], work: "Attribution and churn" },
  { name: "Biconomy", word: ["biconomy.svg", 4284 / 846, 23], work: "Multichain transactions" },
  { name: "ZK Nation", word: ["zknation.svg", 5112 / 817, 21], work: "Governance overview" },
  { name: "Tally", word: ["tally.svg", 2124 / 782, 26], work: "Governance analytics" },
  { name: "Protocolink", word: ["protocolink.svg", 4418 / 768, 21], work: "MEV: top trades" },
  { name: "Abstract", word: ["abstract.svg", 5995 / 850, 19], work: "Chain analytics" },
];

const maskStyle = (file: string) => {
  const m = `url(/clients/${file}) left center/contain no-repeat`;
  return { mask: m, WebkitMask: m };
};

export default function Home() {
  return (
    <div className="space-y-14 py-6 sm:space-y-20 sm:py-12">
      <section className="max-w-3xl space-y-6">
        <h1 className="font-brand text-4xl font-extrabold tracking-tight sm:text-5xl">Onchain data, made visible.</h1>
        <p className="text-lg text-ink-2">
          Dashboards, visualizations and reports that make an impact. Built on onchain data, made for the people who need to
          understand it.
        </p>
        <div className="flex flex-wrap gap-3">
          <a href="#work" className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-surface-1 hover:opacity-90">See our work</a>
          <Link href="/stories/tokenized-stocks" className="rounded-md border border-border px-4 py-2 text-sm font-medium text-ink-2 hover:bg-surface-1 hover:text-ink">
            Data story: Tokenized Stocks →
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border">
        {STATS.map((s) => (
          <div key={s.label} className="bg-surface-1 p-4 sm:p-5">
            <div className="font-brand text-2xl font-extrabold tabular-nums sm:text-3xl">{s.value}</div>
            <div className="mt-1 text-xs text-ink-3 sm:text-sm">{s.label}</div>
          </div>
        ))}
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">What we build</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {SERVICES.map((s, i) => (
            <div key={s.title} className="rounded-lg border border-border bg-surface-1 p-4 sm:p-5">
              <h3 className="text-lg font-semibold"><span className="mr-2 text-xs font-medium text-ink-3">0{i + 1}</span>{s.title}</h3>
              <p className="mt-2 text-sm text-ink-2">{s.text}</p>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-dashed border-border p-5 text-sm text-ink-2">
          <span className="font-semibold text-ink">Prefer Dune?</span> We also build and maintain dashboards on{" "}
          <a href="https://dune.com" className="underline hover:text-ink">Dune</a>, public or private, including the queries behind them.
        </div>
      </section>

      <section id="work" className="scroll-mt-24 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Latest work</h2>
        <Link href="/stories/tokenized-stocks" className="group grid overflow-hidden rounded-lg border border-border bg-surface-1 md:grid-cols-2">
          <img src="/stories/record-day/day-in-motion-poster.jpg" alt="Every tokenized-stock trade on Base on one day, one dot per trade" className="block w-full bg-[#f8f0e8]" />
          <div className="flex flex-col justify-center gap-3 p-6">
            <div className="text-xs font-medium uppercase tracking-wider text-ink-3">Data story</div>
            <h3 className="text-xl font-bold tracking-tight">Tokenized stocks on Base</h3>
            <p className="text-sm text-ink-2">
              Who trades tokenized stocks onchain? Daily volume, the market makers behind it and a record day of $150M, shown
              trade by trade.
            </p>
            <span className="text-sm font-medium group-hover:underline">Read the story →</span>
          </div>
        </Link>
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Teams we worked with</h2>
          <p className="mt-1 text-sm text-ink-3">Dashboards and analysis built for:</p>
        </div>
        <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4">
          {CLIENTS.map((c) => (
            <li key={c.name} className="bg-surface-1 p-4 sm:p-5">
              <div className="flex h-8 items-center gap-2 text-ink">
                {c.word ? (
                  <span role="img" aria-label={c.name} className="block max-w-full bg-current" style={{ height: c.word[2], aspectRatio: c.word[1], ...maskStyle(c.word[0]) }} />
                ) : (
                  <>
                    {c.mark && <span aria-hidden className="inline-block size-6 shrink-0 bg-current" style={maskStyle(c.mark)} />}
                    <span className="font-brand text-lg font-bold tracking-tight">{c.name}</span>
                  </>
                )}
              </div>
              <div className="mt-1 text-xs text-ink-3 sm:text-sm">{c.work}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
