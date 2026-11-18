import { cacheLife, cacheTag } from "next/cache";
import { hasMd, mdQuery } from "../md";

// "Trader types". The analysis leads:
//  1) k-means on all wallets, on behaviour features, with k (4–8) chosen by silhouette: no groups set by hand;
//  2) each group is then named from a fixed vocabulary (WORDS): a word per trait it clearly scores high or low on.
// Features are computed in MotherDuck; clustering runs here and is cached per hour. Only summaries go to the browser.

export type WalletRow = {
  v: number; tr: number; d: number; span: number; ns: number; we: number | null; mm: number; agg: number;
  buy: number; sell: number; crypto: number; meme: number; joined: number; topshare: number; top: string;
};

export type TraderType = {
  id: number; name: string; desc: string;
  /** persona icon key (the strongest word) and a one-line sketch built from the group's words */
  persona: string; line: string; tags: string[];
  /** plain-language reasons why these wallets form this group (rule first, then the most distinctive traits) */
  why: { key: string; text: string }[];
  wallets: number; walletShare: number; volume: number; volumeShare: number;
  med: { volume: number; trades: number; days: number; perDay: number; avgTrade: number; stocks: number };
  mean: { regularity: number; weekend: number; mm: number; agg: number; topShare: number; netBuy: number; crypto: number; meme: number };
  joinedDay: number;
  topStocks: { symbol: string; share: number }[];
};
/** One column of the "what sets each group apart" grid: display value per type and a score in [-1, 1] vs all wallets. */
export type Trait = { key: string; label: string; values: string[]; scores: number[] };
/** points: t-SNE map of a sample of wallets [x, y, typeId]; positions mean similarity only (no axes). */
export type TraderTypes = { types: TraderType[]; traits: Trait[]; points: [number, number, number][]; wallets: number; firstDay: string | null };

const VOL = "COALESCE(t.buy_usd,0) + COALESCE(t.sell_usd,0) - COALESCE(t.cross_usd,0)";
// Stock themes (Coinbase tokenized-stocks list, Nov 2026: 74 stocks, no ETFs). Extend when new stocks are listed.
const CRYPTO = ["MSTR", "HOOD", "CRCL", "BMNR", "COIN", "GLXY", "SBET", "MARA", "RIOT", "CLSK"];
const MEME = ["GME", "AMC", "DJT", "PTON", "BIRD", "HTZ", "WEN", "QUBT", "SOUN", "RDDT"];
const list = (xs: string[]) => xs.map((s) => `'${s}'`).join(",");

export async function getTraderTypes(): Promise<TraderTypes | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("trades");
  if (!hasMd()) return null;
  const rows = await walletRows();
  if (rows.length < 100) return null;
  const [first] = await mdQuery<{ d: string }>(`SELECT strftime(MIN(day), '%Y-%m-%d') AS d FROM trades_daily`);
  return buildTraderTypes(rows, first?.d ?? null);
}

/** One row of behaviour features per wallet (uncached; getTraderTypes caches the result). */
export function walletRows() {
  return mdQuery<WalletRow>(`
    WITH m AS (SELECT MIN(day) AS d0 FROM trades_daily),
    w AS (
      SELECT t.wallet,
             SUM(${VOL})::float8 AS v,
             SUM(t.trades)::float8 AS tr,
             COUNT(DISTINCT t.day)::float8 AS d,
             (date_diff('day', MIN(t.day), MAX(t.day)) + 1)::float8 AS span,
             COUNT(DISTINCT t.symbol)::float8 AS ns,
             (SUM(CASE WHEN dayofweek(t.day) IN (0, 6) THEN ${VOL} ELSE 0 END) / NULLIF(SUM(${VOL}), 0))::float8 AS we,
             COALESCE(SUM(CASE WHEN r.app_kind = 'market_maker' THEN t.trades ELSE 0 END) / NULLIF(SUM(t.trades), 0), 0)::float8 AS mm,
             COALESCE(SUM(CASE WHEN r.app_kind IN ('aggregator', 'app', 'smart_wallet') THEN t.trades ELSE 0 END) / NULLIF(SUM(t.trades), 0), 0)::float8 AS agg,
             SUM(COALESCE(t.buy_usd, 0))::float8 AS buy,
             SUM(COALESCE(t.sell_usd, 0))::float8 AS sell,
             COALESCE(SUM(CASE WHEN t.symbol IN (${list(CRYPTO)}) THEN ${VOL} ELSE 0 END) / NULLIF(SUM(${VOL}), 0), 0)::float8 AS crypto,
             COALESCE(SUM(CASE WHEN t.symbol IN (${list(MEME)}) THEN ${VOL} ELSE 0 END) / NULLIF(SUM(${VOL}), 0), 0)::float8 AS meme,
             date_diff('day', ANY_VALUE(m.d0), MIN(t.day))::float8 AS joined
      FROM trades_daily t CROSS JOIN m LEFT JOIN routes_labeled r USING (route)
      GROUP BY 1
      HAVING SUM(${VOL}) > 0
    ),
    s AS (
      SELECT t.wallet, t.symbol, SUM(${VOL}) AS sv, ROW_NUMBER() OVER (PARTITION BY t.wallet ORDER BY SUM(${VOL}) DESC, t.symbol) AS rn
      FROM trades_daily t GROUP BY 1, 2
    )
    SELECT w.v, w.tr, w.d, w.span, w.ns, w.we, w.mm, w.agg, w.buy, w.sell, w.crypto, w.meme, w.joined,
           s.symbol AS top, (s.sv / w.v)::float8 AS topshare
    FROM w JOIN s ON s.wallet = w.wallet AND s.rn = 1
    ORDER BY w.wallet`); // fixed order: same data → same groups
}

/* ---------- helpers ---------- */

const lg = (x: number) => Math.log10(Math.max(1, x));
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const usd = (v: number) => (v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}K` : `$${v >= 10 ? Math.round(v) : v.toFixed(1)}`);
const num = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e4 ? `${Math.round(v / 1e3)}K` : v >= 10 ? Math.round(v).toLocaleString("en-US") : String(Math.round(v * 10) / 10));
const pct = (v: number) => `${Math.round(v * 100)}%`;
const perDay = (r: WalletRow) => r.tr / Math.max(1, r.d);
const netBuy = (r: WalletRow) => (r.buy + r.sell > 0 ? (r.buy - r.sell) / (r.buy + r.sell) : 0);

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/** Features for clustering the actual traders (standardized later). Continuous where possible. */
function features(r: WalletRow): number[] {
  return [
    lg(r.v),                          // size
    lg(r.d),                          // persistence
    r.d / Math.max(1, r.span),        // regularity
    lg(perDay(r)),                    // intensity
    lg(r.v / Math.max(1, r.tr)),      // trade size
    lg(r.ns),                         // breadth
    r.topshare,                       // concentration
    r.we ?? 0,                        // weekend share
    r.agg,                            // via apps / aggregators / smart wallets
    netBuy(r),                        // net buyer (+1) … net seller (−1)
    r.crypto,                         // crypto-related stocks
    r.meme,                           // meme stocks
    r.mm,                             // via market makers' contracts
  ];
}
const FEATURES = ["volume", "days", "regularity", "perDay", "avgTrade", "stocks", "topshare", "weekend", "agg", "netBuy", "crypto", "meme", "mm"] as const;

function kmeans(X: number[][], k: number, seed = 42, iters = 50) {
  const n = X.length, dim = X[0].length, rand = rng(seed);
  const d2 = (a: number[], b: number[]) => { let s = 0; for (let j = 0; j < dim; j++) { const t = a[j] - b[j]; s += t * t; } return s; };
  const sample = n > 20000 ? Array.from({ length: 20000 }, () => X[Math.floor(rand() * n)]) : X;
  const C: number[][] = [sample[Math.floor(rand() * sample.length)].slice()];
  while (C.length < k) {
    const dist = sample.map((x) => Math.min(...C.map((c) => d2(x, c))));
    const tot = dist.reduce((a, b) => a + b, 0);
    let r = rand() * tot, i = 0;
    while (r > dist[i] && i < dist.length - 1) r -= dist[i++];
    C.push(sample[i].slice());
  }
  const lab = new Int32Array(n);
  for (let it = 0; it < iters; it++) {
    let moved = 0;
    for (let i = 0; i < n; i++) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < k; c++) { const dd = d2(X[i], C[c]); if (dd < bd) { bd = dd; best = c; } }
      if (lab[i] !== best) { lab[i] = best; moved++; }
    }
    const sum = Array.from({ length: k }, () => new Array(dim).fill(0)), cnt = new Array(k).fill(0);
    for (let i = 0; i < n; i++) { cnt[lab[i]]++; for (let j = 0; j < dim; j++) sum[lab[i]][j] += X[i][j]; }
    for (let c = 0; c < k; c++) if (cnt[c]) C[c] = sum[c].map((s) => s / cnt[c]);
    if (it > 0 && moved < n * 0.0005) break;
  }
  return lab;
}

/** Mean silhouette on a sample: how well separated the groups are (higher = cleaner groups). */
function silhouette(X: number[][], lab: Int32Array, k: number, m = 1500) {
  const rand = rng(11), idx = Array.from({ length: Math.min(m, X.length) }, () => Math.floor(rand() * X.length));
  const d = (a: number[], b: number[]) => Math.sqrt(a.reduce((s, v, j) => s + (v - b[j]) ** 2, 0));
  let tot = 0;
  for (const i of idx) {
    const sums = new Array(k).fill(0), cnt = new Array(k).fill(0);
    for (const j of idx) if (j !== i) { sums[lab[j]] += d(X[i], X[j]); cnt[lab[j]]++; }
    const a = cnt[lab[i]] ? sums[lab[i]] / cnt[lab[i]] : 0;
    let b = Infinity;
    for (let c = 0; c < k; c++) if (c !== lab[i] && cnt[c]) b = Math.min(b, sums[c] / cnt[c]);
    tot += b === Infinity ? 0 : (b - a) / Math.max(a, b);
  }
  return tot / idx.length;
}


/** Exact t-SNE (van der Maaten & Hinton) for a few thousand points: 2-D map where similar wallets end up close. */
function tsne(X: number[][], seed = 3, perplexity = 30, iters = 450): [number, number][] {
  const n = X.length, rand = rng(seed);
  const D = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    let s = 0; const a = X[i], b = X[j];
    for (let k = 0; k < a.length; k++) { const t = a[k] - b[k]; s += t * t; }
    D[i * n + j] = D[j * n + i] = s;
  }
  // conditional probabilities with per-point bandwidth matching the perplexity
  const P = new Float64Array(n * n), H = Math.log(perplexity);
  for (let i = 0; i < n; i++) {
    let lo = -Infinity, hi = Infinity, beta = 1;
    for (let it = 0; it < 50; it++) {
      let sum = 0, hsum = 0;
      for (let j = 0; j < n; j++) if (j !== i) { const p = Math.exp(-D[i * n + j] * beta); P[i * n + j] = p; sum += p; hsum += D[i * n + j] * p; }
      sum = sum || 1e-12;
      const h = Math.log(sum) + (beta * hsum) / sum;
      for (let j = 0; j < n; j++) P[i * n + j] /= sum;
      if (Math.abs(h - H) < 1e-4) break;
      if (h > H) { lo = beta; beta = hi === Infinity ? beta * 2 : (beta + hi) / 2; } else { hi = beta; beta = lo === -Infinity ? beta / 2 : (beta + lo) / 2; }
    }
  }
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const p = Math.max((P[i * n + j] + P[j * n + i]) / (2 * n), 1e-12); P[i * n + j] = P[j * n + i] = p; }
  // gradient descent with momentum, gains and early exaggeration
  const Y = new Float64Array(2 * n), U = new Float64Array(2 * n), G = new Float64Array(2 * n).fill(1), grad = new Float64Array(2 * n);
  for (let i = 0; i < 2 * n; i++) Y[i] = (rand() - 0.5) * 1e-2;
  const Q = new Float64Array(n * n), lr = Math.max(50, n / 12);
  for (let it = 0; it < iters; it++) {
    const exag = it < 120 ? 12 : 1, mom = it < 250 ? 0.5 : 0.8;
    let qsum = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dx = Y[2 * i] - Y[2 * j], dy = Y[2 * i + 1] - Y[2 * j + 1];
      const q = 1 / (1 + dx * dx + dy * dy); Q[i * n + j] = q; qsum += 2 * q;
    }
    grad.fill(0);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const q = Q[i * n + j], mult = 4 * (exag * P[i * n + j] - q / qsum) * q;
      const dx = Y[2 * i] - Y[2 * j], dy = Y[2 * i + 1] - Y[2 * j + 1];
      grad[2 * i] += mult * dx; grad[2 * i + 1] += mult * dy; grad[2 * j] -= mult * dx; grad[2 * j + 1] -= mult * dy;
    }
    for (let k = 0; k < 2 * n; k++) {
      G[k] = Math.sign(grad[k]) === Math.sign(U[k]) ? G[k] * 0.8 : G[k] + 0.2;
      if (G[k] < 0.01) G[k] = 0.01;
      U[k] = mom * U[k] - lr * G[k] * grad[k];
      Y[k] += U[k];
    }
  }
  return Array.from({ length: n }, (_, i) => [Y[2 * i], Y[2 * i + 1]] as [number, number]);
}

/* ---------- build ---------- */

function summarize(g: WalletRow[], totW: number, totV: number) {
  const vol = g.reduce((s, r) => s + r.v, 0);
  const stockV = new Map<string, number>();
  for (const r of g) stockV.set(r.top, (stockV.get(r.top) ?? 0) + r.v * r.topshare);
  const sv = [...stockV.values()].reduce((a, b) => a + b, 0) || 1;
  return {
    wallets: g.length, walletShare: g.length / totW, volume: vol, volumeShare: vol / totV,
    med: {
      volume: median(g.map((r) => r.v)), trades: median(g.map((r) => r.tr)), days: median(g.map((r) => r.d)),
      perDay: median(g.map(perDay)), avgTrade: median(g.map((r) => r.v / Math.max(1, r.tr))), stocks: median(g.map((r) => r.ns)),
    },
    mean: {
      regularity: mean(g.map((r) => r.d / Math.max(1, r.span))), weekend: mean(g.map((r) => r.we ?? 0)), mm: mean(g.map((r) => r.mm)), agg: mean(g.map((r) => r.agg)), topShare: mean(g.map((r) => r.topshare)),
      netBuy: mean(g.map(netBuy)), crypto: mean(g.map((r) => r.crypto)), meme: mean(g.map((r) => r.meme)),
    },
    joinedDay: median(g.map((r) => r.joined)),
    topStocks: [...stockV.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([symbol, v]) => ({ symbol, share: v / sv })),
  };
}

/* ---------- naming vocabulary ----------
 * Fixed up front: for every trait we measure, the word a group gets when it scores clearly high or low on it.
 * Not fixed up front: the groups themselves. They come out of the clustering; afterwards each group gets the words
 * whose condition its numbers meet. z = how far the group's centre sits from all wallets, in standard deviations.
 * A word needs both: a clear difference from all wallets (z ≥ 0.5, or a hard floor like "1 day") and, for shares, a real share.
 * A group takes at most one word per trait, at most one noun (else "traders") and its two strongest other words. */

type Summary = ReturnType<typeof summarize>;
type Z = Record<(typeof FEATURES)[number], number>;
type Word = {
  id: string; trait: string; fact: string; word: string; noun?: boolean;
  /** shown on the page: when a group gets this word */
  when: string;
  /** used in the persona line */
  phrase: string;
  /** > 0 = the group gets the word, with this strength */
  test: (t: Summary, z: Z) => number;
};
const hi = (v: number, min = 0.5) => (v >= min ? v : 0);
const WORDS: Word[] = [
  { id: "whale", trait: "Volume", fact: "volume", word: "Whale", when: "far more volume than other wallets (z ≥ 1.5) and $100K+ typical", phrase: "moves very large amounts", test: (t, z) => (z.volume >= 1.5 && t.med.volume >= 100_000 ? z.volume + 1 : 0) },
  { id: "big", trait: "Volume", fact: "volume", word: "Big", when: "more volume than other wallets (z ≥ 0.5)", phrase: "trades large amounts", test: (t, z) => hi(z.volume) },
  { id: "small", trait: "Volume", fact: "volume", word: "Small", when: "less volume than other wallets (z ≤ −0.5)", phrase: "trades small amounts", test: (t, z) => hi(-z.volume) },
  { id: "dust", trait: "Volume", fact: "volume", word: "Dust", when: "typical wallet traded under $10 in total", phrase: "trades pocket change, under $10 in total", test: (t, z) => (t.med.volume < 10 ? 1 + Math.abs(z.volume) : 0) },
  { id: "oneTime", trait: "Active days", fact: "days", word: "One-time", when: "typical wallet active on a single day", phrase: "came on a single day", test: (t, z) => (t.med.days <= 1 ? Math.max(1, -z.days) : 0) },
  { id: "regular", trait: "Active days", fact: "days", word: "Regular", when: "active on more days than other wallets (z ≥ 0.5, 3+ days)", phrase: "comes back on many days", test: (t, z) => (t.med.days >= 3 ? hi(z.days) : 0) },
  { id: "steady", trait: "Regularity", fact: "regularity", word: "Steady", when: "trades on most days between first and last trade (z ≥ 0.5, 3+ days)", phrase: "trades on most days between their first and last visit", test: (t, z) => (t.med.days >= 3 ? hi(z.regularity) * 0.9 : 0) },
  { id: "sporadic", trait: "Regularity", fact: "regularity", word: "Sporadic", when: "long gaps between trading days (z ≤ −0.5)", phrase: "drops in now and then, with long gaps", test: (t, z) => hi(-z.regularity) * 0.9 },
  { id: "hf", trait: "Trades / day", fact: "perDay", word: "High-frequency", when: "more trades per active day (z ≥ 0.5, 5+ a day)", phrase: "trades many times per active day", test: (t, z) => (t.med.perDay >= 5 ? hi(z.perDay) : 0) },
  { id: "bots", trait: "Trades / day", fact: "perDay", word: "bots", noun: true, when: "20+ trades per active day on 5+ days", phrase: "trades dozens of times a day, day after day, like a machine", test: (t, z) => (t.med.perDay >= 20 && t.med.days >= 5 ? Math.max(1, z.perDay) + 1 : 0) },
  { id: "largeTicket", trait: "Trade size", fact: "avgTrade", word: "Large-ticket", when: "bigger trades than other wallets (z ≥ 0.5)", phrase: "places big individual trades", test: (t, z) => hi(z.avgTrade) },
  { id: "micro", trait: "Trade size", fact: "avgTrade", word: "Micro", when: "smaller trades (z ≤ −0.5) under $50", phrase: "places tiny trades of a few dollars", test: (t, z) => (t.med.avgTrade < 50 ? hi(-z.avgTrade) : 0) },
  { id: "multi", trait: "Stocks", fact: "stocks", word: "Multi-stock", when: "more different stocks (z ≥ 0.5, 3+)", phrase: "spreads trades over many stocks", test: (t, z) => (t.med.stocks >= 3 ? hi(z.stocks) : 0) },
  { id: "single", trait: "Stocks", fact: "stocks", word: "Single-stock", when: "typical wallet trades one stock (z ≤ −0.5)", phrase: "sticks to one stock", test: (t, z) => (t.med.stocks <= 1 ? hi(-z.stocks, 0.5) : 0) },
  { id: "weekend", trait: "Weekend", fact: "weekend", word: "Weekend", when: "40%+ of volume on weekends (z ≥ 0.5)", phrase: "trades mostly on weekends, when exchanges are closed", test: (t, z) => (t.mean.weekend >= 0.4 ? hi(z.weekend) : 0) },
  { id: "crypto", trait: "Crypto stocks", fact: "crypto", word: "Crypto-stock", when: "30%+ of volume in crypto stocks (z ≥ 0.5)", phrase: "focuses on crypto stocks like MSTR and HOOD", test: (t, z) => (t.mean.crypto >= 0.3 ? hi(z.crypto) : 0) },
  { id: "meme", trait: "Meme stocks", fact: "meme", word: "Meme-stock", when: "25%+ of volume in meme stocks (z ≥ 0.5)", phrase: "focuses on meme stocks like GME and AMC", test: (t, z) => (t.mean.meme >= 0.25 ? hi(z.meme) : 0) },
  { id: "mm", trait: "Via market makers", fact: "mm", word: "market-maker wallets", noun: true, when: "half or more of trades through a market maker's contract (z ≥ 0.5)", phrase: "trades through a market maker's contract", test: (t, z) => (t.mean.mm >= 0.5 ? hi(z.mm) : 0) },
  { id: "app", trait: "Via apps", fact: "agg", word: "app users", noun: true, when: "half or more of trades through apps and aggregators (z ≥ 0.5)", phrase: "trades through wallet apps and aggregators", test: (t, z) => (t.mean.agg >= 0.5 ? hi(z.agg, 0.5) : 0) },
  { id: "buy", trait: "Net buying", fact: "netBuy", word: "buyers", noun: true, when: "buys at least 40% more than it sells (z ≥ 0.5)", phrase: "mostly buys", test: (t, z) => (t.mean.netBuy >= 0.4 ? hi(z.netBuy, 0.5) : 0) },
  { id: "sell", trait: "Net buying", fact: "netBuy", word: "sellers", noun: true, when: "sells at least 40% more than it buys (z ≤ −0.5)", phrase: "mostly sells", test: (t, z) => (t.mean.netBuy <= -0.4 ? hi(-z.netBuy, 0.5) : 0) },
];
/** The vocabulary as plain data, for the "how the names are made" table. */
export const NAMING = WORDS.map(({ trait, word, noun, when }) => ({ trait, word, noun: !!noun, when }));
// adjectives read in this order in a name ("Big regular crypto-stock traders")
const ADJ_ORDER = WORDS.filter((w) => !w.noun).map((w) => w.id);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const andList = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

function nameGroup(t: Summary, z: Z, nAdj = 2) {
  const hits = WORDS.map((w) => ({ w, s: w.test(t, z) })).filter((h) => h.s > 0);
  // one word per trait: the strongest
  const byFact = new Map<string, { w: Word; s: number }>();
  for (const h of hits) if ((byFact.get(h.w.fact)?.s ?? 0) < h.s) byFact.set(h.w.fact, h);
  const best = [...byFact.values()].sort((a, b) => b.s - a.s);
  const noun = best.find((h) => h.w.noun);
  const adjs = best.filter((h) => !h.w.noun).slice(0, nAdj);
  const used = [...(noun ? [noun] : []), ...adjs].sort((a, b) => b.s - a.s);
  const words = [...adjs].sort((a, b) => ADJ_ORDER.indexOf(a.w.id) - ADJ_ORDER.indexOf(b.w.id)).map((h) => h.w.word);
  const name = used.length ? cap([...words, noun?.w.word ?? "traders"].join(" ").toLowerCase()) : "Typical traders";
  const line = used.length ? `${cap(andList(used.slice(0, 3).map((h) => h.w.phrase)))}.` : "Close to the typical wallet on every habit: nothing stands out.";
  return { name, line, persona: used[0]?.w.id ?? "typical", used: used.map((h) => h.w), spare: best.length - used.length };
}

export function buildTraderTypes(rows: WalletRow[], firstDay: string | null): TraderTypes {
  const totW = rows.length, totV = rows.reduce((s, r) => s + r.v, 0) || 1;

  // 1) k-means on all wallets, k (4–8) chosen by silhouette: the data decides the groups
  const F = rows.map(features), dim = F[0].length;
  const mu = Array.from({ length: dim }, (_, j) => mean(F.map((f) => f[j])));
  const sd = Array.from({ length: dim }, (_, j) => Math.sqrt(mean(F.map((f) => (f[j] - mu[j]) ** 2))) || 1);
  const X = F.map((f) => f.map((v, j) => (v - mu[j]) / sd[j]));
  let best = { k: 4, lab: kmeans(X, 4), s: -Infinity };
  best.s = silhouette(X, best.lab, 4);
  for (const k of [5, 6, 7, 8]) {
    const lab = kmeans(X, k);
    const s = silhouette(X, lab, k);
    if (s > best.s + 0.01) best = { k, lab, s };
  }
  const idx = Array.from({ length: best.k }, () => [] as number[]);
  best.lab.forEach((c, i) => idx[c].push(i));

  // 2) per group: summary, centre in z-scores, then words from the vocabulary
  const groups = idx.filter((g) => g.length).map((g) => {
    const z = Object.fromEntries(FEATURES.map((f, j) => [f, mean(g.map((i) => X[i][j]))])) as Z;
    const sum = summarize(g.map((i) => rows[i]), totW, totV);
    return { g, z, sum, named: nameGroup(sum, z) };
  });
  // the same name twice: give those groups a third word, else number them
  for (let extra = 3; extra <= 4; extra++) {
    const count = new Map<string, number>();
    for (const x of groups) count.set(x.named.name, (count.get(x.named.name) ?? 0) + 1);
    for (const x of groups) if (count.get(x.named.name)! > 1 && x.named.spare > 0) x.named = nameGroup(x.sum, x.z, extra);
  }
  const seen = new Map<string, number>();
  for (const x of groups) { const n = (seen.get(x.named.name) ?? 0) + 1; seen.set(x.named.name, n); if (n > 1) x.named.name += ` ${n}`; }
  groups.sort((a, b) => b.sum.volume - a.sum.volume);
  if (process.env.TT_DEBUG)
    for (const x of groups) console.log(x.named.name, x.g.length, JSON.stringify(Object.fromEntries(Object.entries(x.z).map(([k, v]) => [k, Math.round(v * 100) / 100]))), JSON.stringify({ ...x.sum.med, ...x.sum.mean }));

  const drafts: TraderType[] = [], members = new Map<TraderType, WalletRow[]>(), usedWords: Word[][] = [];
  for (const x of groups) {
    const t = x.sum;
    const bits = [
      t.med.days <= 1 ? "1 day" : `${num(t.med.days)} active days`,
      `${num(t.med.trades)} trade${t.med.trades === 1 ? "" : "s"}`,
      `${usd(t.med.avgTrade)} per trade`,
    ];
    const d: TraderType = { id: drafts.length, name: x.named.name, desc: `Typically ${bits.join(" · ")}`, persona: x.named.persona, line: x.named.line, tags: x.named.used.map((w) => w.word), why: [], ...t };
    drafts.push(d);
    members.set(d, x.g.map((i) => rows[i]));
    usedWords.push(x.named.used);
  }
  const types = drafts;

  // t-SNE map on a stratified sample (up to 100 wallets per type), on all features plus market-maker share and trade count
  const emb = (r: WalletRow) => [...features(r), lg(r.tr)];
  const E = rows.map(emb), ed = E[0].length;
  const emu = Array.from({ length: ed }, (_, j) => mean(E.map((f) => f[j])));
  const esd = Array.from({ length: ed }, (_, j) => Math.sqrt(mean(E.map((f) => (f[j] - emu[j]) ** 2))) || 1);
  const pr = rng(19), sample: number[][] = [], sampleType: number[] = [];
  drafts.forEach((d, ti) => {
    const g = [...members.get(d)!];
    for (let i = g.length - 1; i > 0; i--) { const j = Math.floor(pr() * (i + 1)); [g[i], g[j]] = [g[j], g[i]]; }
    for (const r of g.slice(0, 100)) {
      // tiny jitter so wallets with identical counts (1 day, 1 stock…) don't collapse onto one spot
      sample.push(emb(r).map((v, j) => (v - emu[j]) / esd[j] + (pr() - 0.5) * 0.06));
      sampleType.push(ti);
    }
  });
  const Ymap = sample.length >= 30 ? tsne(sample) : [];
  const points = Ymap.map(([px, py], i) => [Math.round(px * 100) / 100, Math.round(py * 100) / 100, sampleType[i]] as [number, number, number]);

  // "what sets each group apart": value per type and a score vs all wallets (log ratio for sizes, difference for shares)
  const all = summarize(rows, totW, totV);
  const col = (key: string, label: string, get: (t: Summary) => number, fmt: (v: number) => string, kind: "log" | "share" | "signed"): Trait => {
    const base = get(all);
    const raw = types.map((t) => (kind === "log" ? lg(get(t) + 1) - lg(base + 1) : get(t) - base));
    const max = Math.max(...raw.map(Math.abs)) || 1;
    return { key, label, values: types.map((t) => fmt(get(t))), scores: raw.map((x) => Math.max(-1, Math.min(1, x / max))) };
  };
  const traits: Trait[] = [
    col("volume", "Volume", (t) => t.med.volume, usd, "log"),
    col("trades", "Trades", (t) => t.med.trades, num, "log"),
    col("days", "Active days", (t) => t.med.days, num, "log"),
    col("perDay", "Trades / day", (t) => t.med.perDay, num, "log"),
    col("avgTrade", "Trade size", (t) => t.med.avgTrade, usd, "log"),
    col("stocks", "Stocks", (t) => t.med.stocks, num, "log"),
    col("weekend", "Weekend", (t) => t.mean.weekend, pct, "share"),
    col("agg", "Via apps", (t) => t.mean.agg, pct, "share"),
    col("mm", "Via market makers", (t) => t.mean.mm, pct, "share"),
    col("netBuy", "Net buying", (t) => t.mean.netBuy, (v) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`, "signed"),
    col("crypto", "Crypto stocks", (t) => t.mean.crypto, pct, "share"),
    col("meme", "Meme stocks", (t) => t.mean.meme, pct, "share"),
  ];

  // why each group is a group: the rule (if any), then the 3 traits that differ most from the average wallet
  type G = Summary;
  const facts: { key: string; get: (t: G) => number; kind: "log" | "share" | "signed"; say: (v: number, b: number, t: G) => string }[] = [
    { key: "volume", get: (t) => t.med.volume, kind: "log", say: (v, b) => `Typical total volume ${usd(v)}, ${times(v, b)} the typical wallet (${usd(b)})` },
    { key: "trades", get: (t) => t.med.trades, kind: "log", say: (v, b) => `${num(v)} trades per wallet, ${times(v, b)} the typical wallet (${num(b)})` },
    { key: "days", get: (t) => t.med.days, kind: "log", say: (v, b) => `Active on ${num(v)} days, ${times(v, b)} the typical wallet (${num(b)})` },
    { key: "perDay", get: (t) => t.med.perDay, kind: "log", say: (v, b) => `${num(v)} trades per active day, ${times(v, b)} the typical wallet (${num(b)})` },
    { key: "avgTrade", get: (t) => t.med.avgTrade, kind: "log", say: (v, b) => `Average trade ${usd(v)}, ${times(v, b)} the typical wallet (${usd(b)})` },
    { key: "stocks", get: (t) => t.med.stocks, kind: "log", say: (v, b) => `Trades ${num(v)} different stock${v === 1 ? "" : "s"} (typical wallet: ${num(b)})` },
    { key: "regularity", get: (t) => t.mean.regularity, kind: "share", say: (v, b) => `Trades on ${pct(v)} of the days between first and last trade (all wallets: ${pct(b)})` },
    { key: "weekend", get: (t) => t.mean.weekend, kind: "share", say: (v, b) => `${pct(v)} of volume on weekends (all wallets: ${pct(b)})` },
    { key: "agg", get: (t) => t.mean.agg, kind: "share", say: (v, b) => `${pct(v)} of trades via apps and aggregators (all wallets: ${pct(b)})` },
    { key: "mm", get: (t) => t.mean.mm, kind: "share", say: (v, b) => `${pct(v)} of trades via market-maker contracts (all wallets: ${pct(b)})` },
    { key: "netBuy", get: (t) => t.mean.netBuy, kind: "signed", say: (v) => (Math.abs(v) > 0.95 ? (v > 0 ? "Only buys, no sells" : "Only sells, no buys") : v > 0 ? `Mostly buys (net buying ${pct(v)} of their volume)` : `Mostly sells (net selling ${pct(-v)} of their volume)`) },
    { key: "crypto", get: (t) => t.mean.crypto, kind: "share", say: (v, b) => `${pct(v)} of volume in crypto stocks like MSTR and HOOD (all wallets: ${pct(b)})` },
    { key: "meme", get: (t) => t.mean.meme, kind: "share", say: (v, b) => `${pct(v)} of volume in meme stocks like GME and AMC (all wallets: ${pct(b)})` },
  ];
  // why each group got its name: first the traits behind its words, then other traits that differ clearly from all wallets (max 4)
  types.forEach((t, ti) => {
    const nameFacts = usedWords[ti].map((w) => w.fact);
    const ranked = facts
      .map((f) => {
        const v = f.get(t), b = f.get(all);
        const mag = f.kind === "log" ? Math.abs(lg(v + 1) - lg(b + 1)) : f.kind === "signed" ? Math.max(0, Math.abs(v) - 0.3) * 2 : Math.abs(v - b) * 2;
        const named = nameFacts.indexOf(f.key);
        return { f, v, b, mag, named };
      })
      .filter((x) => x.named >= 0 || x.mag >= 0.3)
      .sort((a, b) => (a.named < 0 ? 99 : a.named) - (b.named < 0 ? 99 : b.named) || b.mag - a.mag)
      .slice(0, Math.max(4, nameFacts.length));
    t.why = ranked.map((x) => ({ key: x.f.key, text: x.f.say(x.v, x.b, t) }));
    if (!t.why.length) t.why = [{ key: "none", text: "No single trait stands out: these wallets sit close to the typical wallet on every feature" }];
  });

  return { types, traits, points, wallets: totW, firstDay };
}

/** "7× more than" / "7× less than" in words for a value vs a baseline. */
function times(v: number, b: number) {
  if (b <= 0) return "far above";
  const r = v / b;
  const fmt = (q: number) => (q >= 1000 ? "over 1,000×" : q >= 100 ? "over 100×" : `${q >= 10 ? Math.round(q) : Math.round(q * 10) / 10}×`);
  if (r >= 1.5) return `${fmt(r)} more than`;
  if (r <= 0.67) return `${fmt(1 / Math.max(r, 1e-9))} less than`;
  return "about the same as";
}
