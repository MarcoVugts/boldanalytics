// Persona per trader type: an icon (24px line art, stroke = currentColor) and a one-line character sketch.
// Names come from lib/queries/clusters.ts; unknown names fall back to a generic trader.
type Persona = { icon: React.ReactNode; line: string };

const P: Record<string, Persona> = {
  "Market-maker fleets": {
    line: "Always on: quotes both sides of every stock, around the clock, through its own contract.",
    icon: <><path d="M4 8h13l-3-3M20 16H7l3 3" /><circle cx="4" cy="16" r="1.2" /><circle cx="20" cy="8" r="1.2" /></>,
  },
  "High-frequency bots": {
    line: "A machine with a strategy: dozens of trades a day, every day, at speed.",
    icon: <><rect x="5" y="8" width="14" height="11" rx="3" /><path d="M12 8V5M10 4h4" /><circle cx="9.5" cy="13" r="1" /><circle cx="14.5" cy="13" r="1" /><path d="M9.5 16.5h5M3 12v3M21 12v3" /></>,
  },
  Whales: {
    line: "Few wallets, big money: moves a million dollars or more and sets the tone.",
    icon: <><path d="M3 13c0 3.5 3.5 6 8 6 5 0 8.5-3 9-7 .2-1.5 1.5-2.5 2-3-1.5 0-2.5.5-3 1.5C17.5 8 15 7 12 7c-4.5 0-9 2.5-9 6z" /><circle cx="8" cy="12.5" r=".8" /><path d="M11 4.5c0 1 .5 2 1.5 2.5M13.5 3.5c-.5 1-.5 2.5 0 3.5" /></>,
  },
  "Big traders": {
    line: "Serious size per trade, without the volume of a whale.",
    icon: <><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M9 7V5h6v2M3 12h18" /></>,
  },
  "Active traders": {
    line: "Comes back day after day: a regular who trades several stocks and knows the market.",
    icon: <><path d="M3 17l5-5 4 3 7-8" /><path d="M15 7h4v4" /></>,
  },
  "App users": {
    line: "Trades from a wallet app or aggregator: convenience first, a tap and done.",
    icon: <><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2M10 8l2 2 2-2M12 10V6" /></>,
  },
  "Micro-traders": {
    line: "Tiny trades of a few dollars: testing, quests or farming rather than investing.",
    icon: <><circle cx="8" cy="15" r="3" /><circle cx="15" cy="9" r="2" /><circle cx="17.5" cy="16" r="1.5" /></>,
  },
  "Crypto-stock traders": {
    line: "Lives at the crossroads of crypto and equities: MSTR, HOOD, CRCL and friends.",
    icon: <><circle cx="12" cy="12" r="9" /><path d="M10 7.5v9M10 7.5h3a2 2 0 010 4h-3m0 0h3.5a2.25 2.25 0 010 4.5H10M11.5 6v1.5M11.5 16.5V18" /></>,
  },
  "Meme-stock traders": {
    line: "Here for the story and the ride: GME, AMC and the next one to the moon.",
    icon: <><path d="M14 4c3 .5 5.5 3 6 6l-6 6-6-6 6-6z" /><circle cx="15" cy="9" r="1.3" /><path d="M8 10l-3 1-1 3 3-1M14 16l-1 3-3 1 1-3M7 17l-3 3" /></>,
  },
  "One-time buyers": {
    line: "Bought once to own a piece of a stock onchain, and has not been back since.",
    icon: <><path d="M5 8h14l-1 12H6L5 8z" /><path d="M9 8V6a3 3 0 016 0v2" /></>,
  },
  "One-time sellers": {
    line: "Came in to sell: one or two trades, out of the position, gone.",
    icon: <><path d="M14 4h5v16h-5" /><path d="M4 12h11M11 8l4 4-4 4" /></>,
  },
  "One-time traders": {
    line: "Tried it once: a single visit, a couple of trades.",
    icon: <><circle cx="12" cy="7" r="3" /><path d="M6 20c0-3.5 2.5-6 6-6s6 2.5 6 6" /><path d="M18 4l2 2-2 2" /></>,
  },
  Buyers: { line: "Builds positions: buys far more than it sells.", icon: <><path d="M12 19V5M6 11l6-6 6 6" /></> },
  Sellers: { line: "Reduces positions: sells far more than it buys.", icon: <><path d="M12 5v14M6 13l6 6 6-6" /></> },
  "Weekend traders": {
    line: "Trades when the exchanges are closed: weekends are this group's market.",
    icon: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  },
  "Casual traders": {
    line: "Drops in now and then: a handful of trades spread over a few weeks.",
    icon: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /><circle cx="9" cy="14.5" r="1" /><circle cx="15" cy="16" r="1" /></>,
  },
  "Mixed traders": {
    line: "A bit of everything: no single habit sets these wallets apart.",
    icon: <><circle cx="8" cy="9" r="3" /><circle cx="16" cy="9" r="3" /><path d="M3 19c0-3 2.5-5 5-5s5 2 5 5M11 19c0-3 2.5-5 5-5s5 2 5 5" /></>,
  },
  "Other traders": {
    line: "The middle of the road: close to the typical wallet on most habits.",
    icon: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-4 3-7 7-7s7 3 7 7" /></>,
  },
  "Dust & test trades": {
    line: "Pocket change: under ten dollars in total, tests and leftovers.",
    icon: <><path d="M4 18c2-1 4-1 6 0s4 1 6 0 3-1 4-.5" /><circle cx="7" cy="12" r="1" /><circle cx="12" cy="9" r="1.3" /><circle cx="17" cy="12.5" r=".9" /><circle cx="14.5" cy="5.5" r=".7" /></>,
  },
};
const FALLBACK: Persona = {
  line: "A bit of everything: no single habit sets these wallets apart.",
  icon: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-4 3-7 7-7s7 3 7 7" /></>,
};

export const persona = (name: string) => P[name] ?? FALLBACK;

/** Round persona badge in the type's colour. */
export function PersonaIcon({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, color, background: `color-mix(in oklab, ${color} 16%, transparent)` }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {persona(name).icon}
      </svg>
    </span>
  );
}
