// Persona icon per trader type (24px line art, stroke = currentColor), keyed by the group's strongest word
// from the naming vocabulary in lib/queries/clusters.ts (WORDS). Unknown keys fall back to a generic trader.
const P: Record<string, React.ReactNode> = {
  whale: <><path d="M3 13c0 3.5 3.5 6 8 6 5 0 8.5-3 9-7 .2-1.5 1.5-2.5 2-3-1.5 0-2.5.5-3 1.5C17.5 8 15 7 12 7c-4.5 0-9 2.5-9 6z" /><circle cx="8" cy="12.5" r=".8" /><path d="M11 4.5c0 1 .5 2 1.5 2.5M13.5 3.5c-.5 1-.5 2.5 0 3.5" /></>,
  big: <><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M9 7V5h6v2M3 12h18" /></>,
  small: <><circle cx="9" cy="14" r="3" /><circle cx="15.5" cy="12" r="2" /></>,
  dust: <><path d="M4 18c2-1 4-1 6 0s4 1 6 0 3-1 4-.5" /><circle cx="7" cy="12" r="1" /><circle cx="12" cy="9" r="1.3" /><circle cx="17" cy="12.5" r=".9" /><circle cx="14.5" cy="5.5" r=".7" /></>,
  oneTime: <><circle cx="12" cy="7" r="3" /><path d="M6 20c0-3.5 2.5-6 6-6s6 2.5 6 6" /><path d="M18 4l2 2-2 2" /></>,
  regular: <><path d="M3 17l5-5 4 3 7-8" /><path d="M15 7h4v4" /></>,
  steady: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4M8 14l2 2 4-4" /></>,
  sporadic: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /><circle cx="9" cy="14.5" r="1" /><circle cx="15" cy="16" r="1" /></>,
  hf: <path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" />,
  bots: <><rect x="5" y="8" width="14" height="11" rx="3" /><path d="M12 8V5M10 4h4" /><circle cx="9.5" cy="13" r="1" /><circle cx="14.5" cy="13" r="1" /><path d="M9.5 16.5h5M3 12v3M21 12v3" /></>,
  largeTicket: <><ellipse cx="12" cy="6" rx="7" ry="2.5" /><path d="M5 6v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6" /></>,
  micro: <><circle cx="8" cy="15" r="3" /><circle cx="15" cy="9" r="2" /><circle cx="17.5" cy="16" r="1.5" /></>,
  multi: <><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5M3 17l9 5 9-5" /></>,
  single: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></>,
  weekend: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  crypto: <><circle cx="12" cy="12" r="9" /><path d="M10 7.5v9M10 7.5h3a2 2 0 010 4h-3m0 0h3.5a2.25 2.25 0 010 4.5H10M11.5 6v1.5M11.5 16.5V18" /></>,
  meme: <><path d="M14 4c3 .5 5.5 3 6 6l-6 6-6-6 6-6z" /><circle cx="15" cy="9" r="1.3" /><path d="M8 10l-3 1-1 3 3-1M14 16l-1 3-3 1 1-3M7 17l-3 3" /></>,
  mm: <><path d="M4 8h13l-3-3M20 16H7l3 3" /><circle cx="4" cy="16" r="1.2" /><circle cx="20" cy="8" r="1.2" /></>,
  app: <><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2M10 8l2 2 2-2M12 10V6" /></>,
  buy: <><path d="M5 8h14l-1 12H6L5 8z" /><path d="M9 8V6a3 3 0 016 0v2" /></>,
  sell: <><path d="M14 4h5v16h-5" /><path d="M4 12h11M11 8l4 4-4 4" /></>,
  typical: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-4 3-7 7-7s7 3 7 7" /></>,
};

/** Round persona badge in the type's colour. */
export function PersonaIcon({ persona, color, size = 40 }: { persona: string; color: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, color, background: `color-mix(in oklab, ${color} 16%, transparent)` }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {P[persona] ?? P.typical}
      </svg>
    </span>
  );
}

// Small icon per trait (for the "Why this group" bullets).
const TRAIT: Record<string, React.ReactNode> = {
  volume: <><ellipse cx="12" cy="6" rx="7" ry="2.5" /><path d="M5 6v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6" /></>,
  trades: <><path d="M6 5v14M10 5v14M14 5v14M18 5v14M4 15l16-6" /></>,
  days: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  perDay: <path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" />,
  avgTrade: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" /><path d="M9 8h6M9 12h6" /></>,
  stocks: <><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></>,
  weekend: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  agg: <><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2" /></>,
  mm: <><path d="M4 8h13l-3-3M20 16H7l3 3" /></>,
  regularity: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M8 14l2 2 4-4" /></>,
  netBuy: <><path d="M7 17l5-5 5 5M7 11l5-5 5 5" /></>,
  crypto: <><circle cx="12" cy="12" r="9" /><path d="M10 7.5v9M10 7.5h3a2 2 0 010 4h-3m0 0h3.5a2.25 2.25 0 010 4.5H10" /></>,
  meme: <><path d="M14 4c3 .5 5.5 3 6 6l-6 6-6-6 6-6z" /><path d="M8 10l-3 1-1 3 3-1M14 16l-1 3-3 1 1-3" /></>,
  none: <><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></>,
};

export function TraitIcon({ k, text, color }: { k: string; text: string; color: string }) {
  // net buying vs selling: arrows up or down
  const down = k === "netBuy" && /sell/i.test(text);
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-px shrink-0" style={down ? { transform: "rotate(180deg)" } : undefined}>
      {TRAIT[k] ?? TRAIT.none}
    </svg>
  );
}
