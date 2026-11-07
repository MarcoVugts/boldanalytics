// Constants shared by server queries and client charts (no server imports here).

// Wallets with this many trades on a day (all tokens together) count as
// "high-frequency" that day: bots / market makers / arbitrage.
export const HF_TRADES_PER_DAY = 100;

export type Dimension = "volume" | "trades" | "stocks";

export const BUCKETS: Record<Dimension, string[]> = {
  volume: ["< $100", "$100–1K", "$1K–10K", "$10K–100K", "$100K+"],
  trades: ["1 trade", "2–5", "6–20", "21–99", `${HF_TRADES_PER_DAY}+`],
  stocks: ["1 stock", "2 stocks", "3–5", "6+"],
};

export type SegmentRow = { day: string; dim: Dimension; bucket: number; wallets: number; volume: number; trades: number };
