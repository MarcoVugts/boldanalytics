/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

const STATS = [
  { value: "100K+", label: "views on a Dune dashboard" },
  { value: "$5B+", label: "tokenized-stock volume tracked" },
  { value: "272,679", label: "trades in one animation" },
  { value: "7", label: "web3 teams worked with" },
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

// Ordered: active teams first, sunset projects after, Abstract last.
const CLIENTS = [
  { name: "OpenSea", work: "User segmentation" },
  { name: "Layer3", work: "Quest dashboards" },
  { name: "Spindl", note: "acquired by Coinbase", work: "User retention and impact numbers (ROAS)" },
  { name: "Biconomy", work: "Multichain transaction tracking" },
  { name: "Tally", note: "sunset", work: "Governance analytics" },
  { name: "Protocolink", note: "sunset", work: "MEV: the most profitable trades" },
  { name: "Abstract", note: "sunsetting", work: "Chain analytics" },
];

export default function Home() {
  return (
    <div className="space-y-20 py-8 sm:py-12">
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

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="bg-surface-1 p-5">
            <div className="font-brand text-3xl font-extrabold tabular-nums">{s.value}</div>
            <div className="mt-1 text-sm text-ink-3">{s.label}</div>
          </div>
        ))}
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">What we build</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {SERVICES.map((s, i) => (
            <div key={s.title} className="rounded-lg border border-border bg-surface-1 p-5">
              <div className="text-xs font-medium text-ink-3">0{i + 1}</div>
              <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
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
        <ul className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {CLIENTS.map((c) => (
            <li key={c.name} className="bg-surface-1 p-5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-lg font-semibold">{c.name}</span>
                {c.note && <span className="text-xs text-ink-3">{c.note}</span>}
              </div>
              <div className="mt-1 text-sm text-ink-2">{c.work}</div>
            </li>
          ))}
          <li className="flex flex-col justify-center bg-surface-1 p-5">
            <span className="text-lg font-semibold text-ink-3">Your team next?</span>
            <span className="mt-1 text-sm text-ink-3">Get in touch</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
