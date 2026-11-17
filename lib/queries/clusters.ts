import { cacheLife, cacheTag } from "next/cache";
import { hasMd, mdQuery } from "../md";

// "Trader types". Two steps:
//  1) clear-cut groups by rule: market makers' fleets, high-frequency bots, whales ($1M+), dust/test wallets;
//  2) k-means on everyone else (the actual traders), on behaviour features, with k (4–6) chosen by silhouette.
// Features are computed in MotherDuck; clustering runs here and is cached per hour. Only summaries go to the browser.

export type WalletRow = {
  v: number; tr: number; d: number; span: number; ns: number; we: number | null; mm: number; agg: number;
  buy: number; sell: number; crypto: number; meme: number; joined: number; topshare: number; top: string;
};

export type TraderType = {
  id: number; name: string; desc: string; rule: boolean;
  /** plain-language reasons why these wallets form this group (rule first, then the most distinctive traits) */
  why: string[];
  wallets: number; walletShare: number; volume: number; volumeShare: number;
  med: { volume: number; trades: number; days: number; perDay: number; avgTrade: number; stocks: number };
  mean: { weekend: number; mm: number; agg: number; topShare: number; netBuy: number; crypto: number; meme: number };
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
    r.meme,                           // meme stocks
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

function summarize(g: WalletRow[], totW: number, totV: number): Omit<TraderType, "id" | "name" | "desc" | "rule" | "why"> {
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
      netBuy: mean(g.map(netBuy)), crypto: mean(g.map((r) => r.crypto)), meme: mean(g.map((r) => r.meme)),
    },
    joinedDay: median(g.map((r) => r.joined)),
    topStocks: [...stockV.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([symbol, v]) => ({ symbol, share: v / sv })),
  };
}

export function buildTraderTypes(rows: WalletRow[], firstDay: string | null): TraderTypes {
  const totW = rows.length, totV = rows.reduce((s, r) => s + r.v, 0) || 1;

  // 1) rule groups
  const isMM = (r: WalletRow) => r.mm > 0.8;
  const isBot = (r: WalletRow) => !isMM(r) && perDay(r) >= 20 && r.d >= 5;
  const isWhale = (r: WalletRow) => !isMM(r) && !isBot(r) && r.v >= 1_000_000;
  const isDust = (r: WalletRow) => !isMM(r) && !isBot(r) && r.v < 10;
  const mm = rows.filter(isMM), bots = rows.filter(isBot), whales = rows.filter(isWhale), dust = rows.filter(isDust);
  const rest = rows.filter((r) => !isMM(r) && !isBot(r) && !isWhale(r) && !isDust(r));

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
  const members = new Map<Draft, WalletRow[]>();
  const add = (g: WalletRow[], name: string, rule: boolean) => { if (g.length) { const d = { id: 0, name, desc: "", rule, why: [] as string[], ...summarize(g, totW, totV) }; drafts.push(d); members.set(d, g); } };
  add(mm, "Market-maker fleets", true);
  add(bots, "High-frequency bots", true);
  add(whales, "Whales", true);
  const clustered: Draft[] = [];
  for (const g of clusters) if (g.length) { const d = { id: 0, name: "", desc: "", rule: false, why: [] as string[], ...summarize(g, totW, totV) }; clustered.push(d); members.set(d, g); }

  // names for the clustered groups: most distinctive trait first, each name once
  const restMed = summarize(rest, totW, totV);
  const rules: { name: string; score: (t: Draft) => number }[] = [
    { name: "Big traders", score: (t) => (t.med.volume >= Math.max(50_000, restMed.med.volume * 20) ? 6 + lg(t.med.volume) / 3 : -1) },
    { name: "Crypto-stock traders", score: (t) => (t.mean.crypto > 0.5 ? 5 + t.mean.crypto : -1) },
    { name: "Meme-stock traders", score: (t) => (t.mean.meme > 0.4 ? 5 + t.mean.meme : -1) },
    { name: "Active traders", score: (t) => (t.med.days >= Math.max(5, restMed.med.days * 3) ? 4.5 + lg(t.med.days) : -1) },
    { name: "Buyers", score: (t) => (t.mean.netBuy > 0.6 ? 4 + t.mean.netBuy : -1) },
    { name: "Sellers", score: (t) => (t.mean.netBuy < -0.6 ? 4 - t.mean.netBuy : -1) },
    { name: "Weekend traders", score: (t) => (t.mean.weekend > 0.45 ? 3.5 + t.mean.weekend : -1) },
    { name: "App users", score: (t) => (t.mean.agg > 0.6 ? 3 + t.mean.agg : -1) },
    { name: "One-time traders", score: (t) => (t.med.days <= 1 && t.med.trades <= 3 ? 2.5 : -1) },
    { name: "Micro-traders", score: (t) => (t.med.avgTrade < 25 ? 3 + (25 - t.med.avgTrade) / 25 : -1) },
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
    if (t.mean.meme > 0.3) bits.push(`${pct(t.mean.meme)} meme stocks`);
    if (Math.abs(t.mean.netBuy) > 0.5) bits.push(t.mean.netBuy > 0 ? "mostly buys" : "mostly sells");
    t.desc = `Typically ${bits.join(" · ")}`;
  }
  const types = drafts.map((t, i) => ({ ...t, id: i }));

  // t-SNE map on a stratified sample (up to 100 wallets per type), on all features plus market-maker share and trade count
  const emb = (r: WalletRow) => [...features(r), r.mm, lg(r.tr)];
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
  const col = (key: string, label: string, get: (t: Omit<TraderType, "id" | "name" | "desc" | "rule" | "why">) => number, fmt: (v: number) => string, kind: "log" | "share" | "signed"): Trait => {
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
  type G = Omit<TraderType, "id" | "name" | "desc" | "rule" | "why">;
  const facts: { key: string; get: (t: G) => number; kind: "log" | "share" | "signed"; say: (v: number, b: number, t: G) => string }[] = [
    { key: "volume", get: (t) => t.med.volume, kind: "log", say: (v, b) => `Typical total volume ${usd(v)}, ${times(v, b)} the typical wallet (${usd(b)})` },
    { key: "trades", get: (t) => t.med.trades, kind: "log", say: (v, b) => `${num(v)} trades per wallet, ${times(v, b)} the typical wallet (${num(b)})` },
    { key: "days", get: (t) => t.med.days, kind: "log", say: (v, b) => `Active on ${num(v)} days, ${times(v, b)} the typical wallet (${num(b)})` },
    { key: "perDay", get: (t) => t.med.perDay, kind: "log", say: (v, b) => `${num(v)} trades per active day, ${times(v, b)} the typical wallet (${num(b)})` },
    { key: "avgTrade", get: (t) => t.med.avgTrade, kind: "log", say: (v, b) => `Average trade ${usd(v)}, ${times(v, b)} the typical wallet (${usd(b)})` },
    { key: "stocks", get: (t) => t.med.stocks, kind: "log", say: (v, b) => `Trades ${num(v)} different stock${v === 1 ? "" : "s"} (typical wallet: ${num(b)})` },
    { key: "weekend", get: (t) => t.mean.weekend, kind: "share", say: (v, b) => `${pct(v)} of volume on weekends (all wallets: ${pct(b)})` },
    { key: "agg", get: (t) => t.mean.agg, kind: "share", say: (v, b) => `${pct(v)} of trades via apps and aggregators (all wallets: ${pct(b)})` },
    { key: "mm", get: (t) => t.mean.mm, kind: "share", say: (v, b) => `${pct(v)} of trades via market-maker contracts (all wallets: ${pct(b)})` },
    { key: "netBuy", get: (t) => t.mean.netBuy, kind: "signed", say: (v) => (Math.abs(v) > 0.95 ? (v > 0 ? "Only buys, no sells" : "Only sells, no buys") : v > 0 ? `Mostly buys (net buying ${pct(v)} of their volume)` : `Mostly sells (net selling ${pct(-v)} of their volume)`) },
    { key: "crypto", get: (t) => t.mean.crypto, kind: "share", say: (v, b) => `${pct(v)} of volume in crypto stocks like MSTR and HOOD (all wallets: ${pct(b)})` },
    { key: "meme", get: (t) => t.mean.meme, kind: "share", say: (v, b) => `${pct(v)} of volume in meme stocks like GME and AMC (all wallets: ${pct(b)})` },
  ];
  const ruleOf: Record<string, { text: (t: G) => string; skip: string }> = {
    "Market-maker fleets": { text: (t) => `${pct(t.mean.mm)} of trades through a market maker's contract (rule: more than 80%)`, skip: "mm" },
    "High-frequency bots": { text: (t) => `${num(t.med.perDay)} trades per active day (rule: 20+ per day on at least 5 days)`, skip: "perDay" },
    Whales: { text: (t) => `Traded $1M or more (typical wallet in this group: ${usd(t.med.volume)})`, skip: "volume" },
    "Dust & test trades": { text: (t) => `Traded less than $10 in total (typical: ${usd(t.med.volume)})`, skip: "volume" },
  };
  // the trait a clustered group is named after always comes first
  const nameKey: Record<string, string> = {
    "Weekend traders": "weekend", "Crypto-stock traders": "crypto", "Meme-stock traders": "meme", "App users": "agg", "Micro-traders": "avgTrade",
    "Active traders": "days", "Big traders": "volume", Buyers: "netBuy", Sellers: "netBuy", "One-time buyers": "netBuy", "One-time sellers": "netBuy", "One-time traders": "days",
  };
  for (const t of types) {
    const rule = ruleOf[t.name];
    const ranked = facts
      .filter((f) => f.key !== rule?.skip)
      .map((f) => {
        const v = f.get(t), b = f.get(all);
        const mag = f.kind === "log" ? Math.abs(lg(v + 1) - lg(b + 1)) : f.kind === "signed" ? Math.max(0, Math.abs(v) - 0.3) * 2 : Math.abs(v - b) * 2;
        return { f, v, b, mag };
      })
      .filter((x) => x.mag >= 0.3 || x.f.key === nameKey[t.name])
      .sort((a, b) => (b.f.key === nameKey[t.name] ? 1 : 0) - (a.f.key === nameKey[t.name] ? 1 : 0) || b.mag - a.mag)
      .slice(0, rule ? 2 : 3);
    t.why = [...(rule ? [rule.text(t)] : []), ...ranked.map((x) => x.f.say(x.v, x.b, t))];
    if (!t.why.length) t.why = ["No single trait stands out: these wallets sit close to the typical wallet on every feature"];
  }

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
