import { cacheLife, cacheTag } from "next/cache";
import { hasMd, mdQuery } from "../md";

// "Trader types". Two steps:
//  1) clear-cut groups by rule: market makers' fleets, high-frequency bots, dust/test wallets;
//  2) k-means on everyone else (the actual traders), on behaviour features, with k (4–6) chosen by silhouette.
// Features are computed in MotherDuck; clustering runs here and is cached per hour. Only summaries go to the browser.

export type WalletRow = {
  v: number; tr: number; d: number; span: number; ns: number; we: number | null; mm: number; agg: number;
  buy: number; sell: number; crypto: number; etf: number; joined: number; topshare: number; top: string;
};

export type TraderType = {
  id: number; name: string; desc: string; rule: boolean;
  wallets: number; walletShare: number; volume: number; volumeShare: number;
  med: { volume: number; trades: number; days: number; perDay: number; avgTrade: number; stocks: number };
  mean: { weekend: number; mm: number; agg: number; topShare: number; netBuy: number; crypto: number; etf: number };
  joinedDay: number;
  topStocks: { symbol: string; share: number }[];
};
/** One column of the "what sets each group apart" grid: display value per type and a score in [-1, 1] vs all wallets. */
export type Trait = { key: string; label: string; values: string[]; scores: number[] };
export type TraderTypes = { types: TraderType[]; traits: Trait[]; wallets: number; firstDay: string | null };

const VOL = "COALESCE(t.buy_usd,0) + COALESCE(t.sell_usd,0) - COALESCE(t.cross_usd,0)";
const CRYPTO = ["COIN", "MSTR", "HOOD", "CRCL", "GLXY", "BMNR", "SBET", "MARA", "RIOT", "CLSK", "HUT", "IREN", "CORZ", "BTDR", "CIFR", "WULF", "BITF", "BLSH", "GEMI"];
const ETF = ["SPY", "QQQ", "QQQM", "IVV", "VOO", "VTI", "IWM", "DIA", "GLD", "SLV", "TLT", "IBIT", "ETHA", "GBTC", "ARKK", "XLK", "XLF", "XLE", "SMH", "SOXX", "EEM", "EFA", "AGG", "SCHD", "TQQQ", "SQQQ"];
const list = (xs: string[]) => xs.map((s) => `'${s}'`).join(",");

export async function getTraderTypes(): Promise<TraderTypes | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("trades");
  if (!hasMd()) return null;
  const rows = await mdQuery<WalletRow>(`
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
             COALESCE(SUM(CASE WHEN t.symbol IN (${list(ETF)}) THEN ${VOL} ELSE 0 END) / NULLIF(SUM(${VOL}), 0), 0)::float8 AS etf,
             date_diff('day', ANY_VALUE(m.d0), MIN(t.day))::float8 AS joined
      FROM trades_daily t CROSS JOIN m LEFT JOIN routes_labeled r USING (route)
      GROUP BY 1
      HAVING SUM(${VOL}) > 0
    ),
    s AS (
      SELECT t.wallet, t.symbol, SUM(${VOL}) AS sv, ROW_NUMBER() OVER (PARTITION BY t.wallet ORDER BY SUM(${VOL}) DESC, t.symbol) AS rn
      FROM trades_daily t GROUP BY 1, 2
    )
    SELECT w.v, w.tr, w.d, w.span, w.ns, w.we, w.mm, w.agg, w.buy, w.sell, w.crypto, w.etf, w.joined,
           s.symbol AS top, (s.sv / w.v)::float8 AS topshare
    FROM w JOIN s ON s.wallet = w.wallet AND s.rn = 1`);
  if (rows.length < 100) return null;
  const [first] = await mdQuery<{ d: string }>(`SELECT strftime(MIN(day), '%Y-%m-%d') AS d FROM trades_daily`);
  return buildTraderTypes(rows, first?.d ?? null);
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
    r.etf,                            // ETFs
  ];
}

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

/* ---------- build ---------- */

function summarize(g: WalletRow[], totW: number, totV: number): Omit<TraderType, "id" | "name" | "desc" | "rule"> {
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
      weekend: mean(g.map((r) => r.we ?? 0)), mm: mean(g.map((r) => r.mm)), agg: mean(g.map((r) => r.agg)), topShare: mean(g.map((r) => r.topshare)),
      netBuy: mean(g.map(netBuy)), crypto: mean(g.map((r) => r.crypto)), etf: mean(g.map((r) => r.etf)),
    },
    joinedDay: median(g.map((r) => r.joined)),
    topStocks: [...stockV.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([symbol, v]) => ({ symbol, share: v / sv })),
  };
}

export function buildTraderTypes(rows: WalletRow[], firstDay: string | null): TraderTypes {
  const totW = rows.length, totV = rows.reduce((s, r) => s + r.v, 0) || 1;

  // 1) rule groups
  const isMM = (r: WalletRow) => r.mm > 0.8;
  const isBot = (r: WalletRow) => !isMM(r) && perDay(r) >= 50 && r.d >= 5;
  const isDust = (r: WalletRow) => !isMM(r) && !isBot(r) && r.v < 10;
  const mm = rows.filter(isMM), bots = rows.filter(isBot), dust = rows.filter(isDust);
  const rest = rows.filter((r) => !isMM(r) && !isBot(r) && !isDust(r));

  // 2) k-means on the rest, k by silhouette
  const F = rest.map(features), dim = F[0]?.length ?? 0;
  const mu = Array.from({ length: dim }, (_, j) => mean(F.map((f) => f[j])));
  const sd = Array.from({ length: dim }, (_, j) => Math.sqrt(mean(F.map((f) => (f[j] - mu[j]) ** 2))) || 1);
  const X = F.map((f) => f.map((v, j) => (v - mu[j]) / sd[j]));
  let best = { k: 4, lab: new Int32Array(rest.length), s: -Infinity };
  if (rest.length >= 200)
    for (const k of [4, 5, 6]) {
      const lab = kmeans(X, k);
      const s = silhouette(X, lab, k);
      if (s > best.s + 0.01) best = { k, lab, s };
    }
  const clusters = Array.from({ length: best.k }, () => [] as WalletRow[]);
  rest.forEach((r, i) => clusters[best.lab[i]].push(r));

  type Draft = TraderType;
  const drafts: Draft[] = [];
  const add = (g: WalletRow[], name: string, rule: boolean) => { if (g.length) drafts.push({ id: 0, name, desc: "", rule, ...summarize(g, totW, totV) }); };
  add(mm, "Market-maker fleets", true);
  add(bots, "High-frequency bots", true);
  const clustered: Draft[] = [];
  for (const g of clusters) if (g.length) clustered.push({ id: 0, name: "", desc: "", rule: false, ...summarize(g, totW, totV) });

  // names for the clustered groups: most distinctive trait first, each name once
  const restMed = summarize(rest, totW, totV);
  const rules: { name: string; score: (t: Draft) => number }[] = [
    { name: "Whales", score: (t) => (t.med.volume >= Math.max(50_000, restMed.med.volume * 20) ? 6 + lg(t.med.volume) / 3 : -1) },
    { name: "Crypto-stock traders", score: (t) => (t.mean.crypto > 0.5 ? 5 + t.mean.crypto : -1) },
    { name: "ETF traders", score: (t) => (t.mean.etf > 0.35 ? 5 + t.mean.etf : -1) },
    { name: "Active traders", score: (t) => (t.med.days >= Math.max(5, restMed.med.days * 3) ? 4.5 + lg(t.med.days) : -1) },
    { name: "Buyers", score: (t) => (t.mean.netBuy > 0.6 ? 4 + t.mean.netBuy : -1) },
    { name: "Sellers", score: (t) => (t.mean.netBuy < -0.6 ? 4 - t.mean.netBuy : -1) },
    { name: "Weekend traders", score: (t) => (t.mean.weekend > 0.45 ? 3.5 + t.mean.weekend : -1) },
    { name: "App users", score: (t) => (t.mean.agg > 0.6 ? 3 + t.mean.agg : -1) },
    { name: "One-time traders", score: (t) => (t.med.days <= 1 && t.med.trades <= 3 ? 2.5 : -1) },
    { name: "Casual traders", score: () => 1 },
    { name: "Mixed traders", score: () => 0.5 },
    { name: "Other traders", score: () => 0.1 },
  ];
  const used = new Set<string>();
  const strength = (t: Draft) => Math.max(...rules.map((r) => r.score(t)));
  for (const t of [...clustered].sort((a, b) => strength(b) - strength(a))) {
    const pick = rules.filter((r) => !used.has(r.name)).map((r) => ({ r, s: r.score(t) })).sort((a, b) => b.s - a.s)[0];
    used.add(pick.r.name);
    t.name = (pick.r.name === "Buyers" || pick.r.name === "Sellers") && t.med.days <= 1 ? `One-time ${pick.r.name.toLowerCase()}` : pick.r.name;
  }
  drafts.push(...clustered.sort((a, b) => b.volume - a.volume));
  add(dust, "Dust & test trades", true);

  // descriptions
  for (const t of drafts) {
    const bits = [
      t.med.days <= 1 ? "1 day" : `${num(t.med.days)} active days`,
      `${num(t.med.trades)} trade${t.med.trades === 1 ? "" : "s"}`,
      `${usd(t.med.avgTrade)} per trade`,
    ];
    if (t.med.perDay >= 20) bits.push(`${num(t.med.perDay)} trades per active day`);
    if (t.mean.mm > 0.5) bits.push(`${pct(t.mean.mm)} via market makers`);
    else if (t.mean.agg > 0.5) bits.push(`${pct(t.mean.agg)} via apps`);
    if (t.mean.crypto > 0.4) bits.push(`${pct(t.mean.crypto)} crypto stocks`);
    if (t.mean.etf > 0.3) bits.push(`${pct(t.mean.etf)} ETFs`);
    if (Math.abs(t.mean.netBuy) > 0.5) bits.push(t.mean.netBuy > 0 ? "mostly buys" : "mostly sells");
    t.desc = `Typically ${bits.join(" · ")}`;
  }
  const types = drafts.map((t, i) => ({ ...t, id: i }));

  // "what sets each group apart": value per type and a score vs all wallets (log ratio for sizes, difference for shares)
  const all = summarize(rows, totW, totV);
  const col = (key: string, label: string, get: (t: Omit<TraderType, "id" | "name" | "desc" | "rule">) => number, fmt: (v: number) => string, kind: "log" | "share" | "signed"): Trait => {
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
    col("etf", "ETFs", (t) => t.mean.etf, pct, "share"),
  ];
  return { types, traits, wallets: totW, firstDay };
}
