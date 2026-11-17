import { cacheLife, cacheTag } from "next/cache";
import { hasMd, mdQuery } from "../md";

// "Trader types": k-means on per-wallet behaviour over all loaded days. Features are computed in MotherDuck, the
// clustering runs here (cached per hour). Only cluster summaries and a sample of points go to the browser.

type WalletRow = {
  v: number; tr: number; d: number; span: number; ns: number; we: number | null; mm: number; agg: number; dir: number | null;
  top: string; topshare: number;
};

export type TraderType = {
  id: number; name: string; desc: string;
  wallets: number; walletShare: number; volume: number; volumeShare: number;
  med: { volume: number; trades: number; days: number; stocks: number; avgTrade: number };
  mean: { weekend: number; mm: number; agg: number; topShare: number; direction: number; activeShare: number };
  topStocks: { symbol: string; share: number }[];
};
export type TraderTypes = { types: TraderType[]; points: [number, number, number][]; wallets: number; k: number };

const K = 6;
const VOL = "COALESCE(t.buy_usd,0) + COALESCE(t.sell_usd,0) - COALESCE(t.cross_usd,0)";

export async function getTraderTypes(): Promise<TraderTypes | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("trades");
  if (!hasMd()) return null;
  const rows = await mdQuery<WalletRow>(`
    WITH w AS (
      SELECT t.wallet,
             SUM(${VOL})::float8 AS v,
             SUM(t.trades)::float8 AS tr,
             COUNT(DISTINCT t.day)::float8 AS d,
             (date_diff('day', MIN(t.day), MAX(t.day)) + 1)::float8 AS span,
             COUNT(DISTINCT t.symbol)::float8 AS ns,
             (SUM(CASE WHEN dayofweek(t.day) IN (0, 6) THEN ${VOL} ELSE 0 END) / NULLIF(SUM(${VOL}), 0))::float8 AS we,
             (SUM(CASE WHEN r.app_kind = 'market_maker' THEN t.trades ELSE 0 END) / NULLIF(SUM(t.trades), 0))::float8 AS mm,
             (SUM(CASE WHEN r.app_kind IN ('aggregator', 'app', 'smart_wallet') THEN t.trades ELSE 0 END) / NULLIF(SUM(t.trades), 0))::float8 AS agg,
             (ABS(SUM(COALESCE(t.buy_usd,0)) - SUM(COALESCE(t.sell_usd,0))) / NULLIF(SUM(COALESCE(t.buy_usd,0) + COALESCE(t.sell_usd,0)), 0))::float8 AS dir
      FROM trades_daily t LEFT JOIN routes_labeled r USING (route)
      GROUP BY 1
      HAVING SUM(${VOL}) > 0
    ),
    s AS (
      SELECT t.wallet, t.symbol, SUM(${VOL}) AS sv, ROW_NUMBER() OVER (PARTITION BY t.wallet ORDER BY SUM(${VOL}) DESC, t.symbol) AS rn
      FROM trades_daily t GROUP BY 1, 2
    )
    SELECT w.v, w.tr, w.d, w.span, w.ns, w.we, w.mm, w.agg, w.dir, s.symbol AS top, (s.sv / w.v)::float8 AS topshare
    FROM w JOIN s ON s.wallet = w.wallet AND s.rn = 1`);
  if (rows.length < K * 10) return null;
  return cluster(rows);
}

/* ---------- clustering ---------- */

const lg = (x: number) => Math.log10(Math.max(1, x));
function features(r: WalletRow): number[] {
  return [
    lg(r.v),                       // size
    lg(r.tr),                      // activity
    lg(r.d),                       // persistence
    r.d / Math.max(1, r.span),     // regularity: share of days active between first and last trade
    lg(r.ns),                      // breadth
    r.topshare,                    // concentration in one stock
    lg(r.v / Math.max(1, r.tr)),   // trade size
    r.we ?? 0,                     // weekend share
    r.mm,                          // trades through market-maker contracts
    r.agg,                         // trades through apps / aggregators / smart wallets
  ];
}

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function kmeans(X: number[][], k: number, iters = 40) {
  const n = X.length, dim = X[0].length, rand = rng(42);
  const d2 = (a: number[], b: number[]) => { let s = 0; for (let j = 0; j < dim; j++) { const t = a[j] - b[j]; s += t * t; } return s; };
  // k-means++ init on a sample (fast and deterministic)
  const sample = X.length > 20000 ? Array.from({ length: 20000 }, () => X[Math.floor(rand() * n)]) : X;
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
    if (it > 0 && moved < n * 0.001) break;
  }
  return lab;
}

const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const fmtUsd = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}K` : `$${Math.round(v)}`);

function cluster(rows: WalletRow[]): TraderTypes {
  const F = rows.map(features), dim = F[0].length;
  const mu = Array.from({ length: dim }, (_, j) => mean(F.map((f) => f[j])));
  const sd = Array.from({ length: dim }, (_, j) => Math.sqrt(mean(F.map((f) => (f[j] - mu[j]) ** 2))) || 1);
  const X = F.map((f) => f.map((v, j) => (v - mu[j]) / sd[j]));
  const lab = kmeans(X, K);

  const totV = rows.reduce((s, r) => s + r.v, 0) || 1;
  const groups = Array.from({ length: K }, () => [] as WalletRow[]);
  rows.forEach((r, i) => groups[lab[i]].push(r));

  let types: TraderType[] = groups.map((g, id) => {
    const vol = g.reduce((s, r) => s + r.v, 0);
    const stockV = new Map<string, number>();
    for (const r of g) stockV.set(r.top, (stockV.get(r.top) ?? 0) + r.v * r.topshare);
    const sv = [...stockV.values()].reduce((a, b) => a + b, 0) || 1;
    return {
      id, name: "", desc: "",
      wallets: g.length, walletShare: g.length / rows.length, volume: vol, volumeShare: vol / totV,
      med: { volume: median(g.map((r) => r.v)), trades: median(g.map((r) => r.tr)), days: median(g.map((r) => r.d)), stocks: median(g.map((r) => r.ns)), avgTrade: median(g.map((r) => r.v / Math.max(1, r.tr))) },
      mean: { weekend: mean(g.map((r) => r.we ?? 0)), mm: mean(g.map((r) => r.mm)), agg: mean(g.map((r) => r.agg)), topShare: mean(g.map((r) => r.topshare)), direction: mean(g.map((r) => r.dir ?? 0)), activeShare: mean(g.map((r) => r.d / Math.max(1, r.span))) },
      topStocks: [...stockV.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([symbol, v]) => ({ symbol, share: v / sv })),
    };
  }).filter((t) => t.wallets > 0);

  // name each group by its most distinctive trait (each name used once; biggest volume chooses first)
  const rules: { name: string; score: (t: TraderType) => number }[] = [
    { name: "Market-maker fleets", score: (t) => (t.mean.mm > 0.8 ? 10 + t.mean.mm : -1) },
    { name: "High-frequency bots", score: (t) => (t.med.trades >= 200 ? 5 + Math.log10(t.med.trades) : -1) },
    { name: "Whales", score: (t) => (t.med.volume >= 250_000 ? 4 + Math.log10(t.med.volume) / 2 : -1) },
    { name: "Regular traders", score: (t) => (t.med.days >= 5 ? 3 + t.mean.activeShare + Math.log10(t.med.days) : -1) },
    { name: "App users", score: (t) => (t.mean.agg > 0.5 ? 2.5 + t.mean.agg : -1) },
    { name: "Weekend traders", score: (t) => (t.mean.weekend > 0.45 ? 2.5 + t.mean.weekend : -1) },
    { name: "Single-stock traders", score: (t) => (t.mean.topShare > 0.9 && t.med.stocks <= 1 ? 2 + t.mean.topShare : -1) },
    { name: "One-time traders", score: (t) => (t.med.days <= 1 && t.med.trades <= 3 ? 2 + (1 / Math.max(1, t.med.trades)) : -1) },
    { name: "Occasional traders", score: () => 0.5 },
    { name: "Mixed traders", score: () => 0.1 },
  ];
  const used = new Set<string>();
  // decide names in order of how strongly a group matches its best rule
  const order = [...types].sort((a, b) => Math.max(...rules.map((r) => r.score(b))) - Math.max(...rules.map((r) => r.score(a))));
  for (const t of order) {
    const pick = rules.filter((r) => !used.has(r.name)).map((r) => ({ r, s: r.score(t) })).sort((a, b) => b.s - a.s)[0];
    t.name = pick.r.name;
    used.add(t.name);
    const bits = [
      `typically ${t.med.days <= 1 ? "1 day" : `${Math.round(t.med.days)} active days`}`,
      `${Math.round(t.med.trades).toLocaleString("en-US")} trade${t.med.trades === 1 ? "" : "s"}`,
      `${fmtUsd(t.med.avgTrade)} per trade`,
      t.med.stocks <= 1 ? "one stock" : `${Math.round(t.med.stocks)} stocks`,
    ];
    if (t.mean.mm > 0.3) bits.push(`${Math.round(t.mean.mm * 100)}% via market-maker contracts`);
    else if (t.mean.agg > 0.4) bits.push(`${Math.round(t.mean.agg * 100)}% via apps and aggregators`);
    if (t.mean.weekend > 0.35) bits.push(`${Math.round(t.mean.weekend * 100)}% of volume on weekends`);
    t.desc = bits.join(" · ");
  }
  // biggest volume first; ids follow that order (= colour order)
  types = types.sort((a, b) => b.volume - a.volume);
  const remap = new Map(types.map((t, i) => [t.id, i]));
  types.forEach((t, i) => (t.id = i));

  // scatter sample: up to 400 wallets per group, log10(trades) vs log10(volume)
  const rand = rng(7), perGroup = new Map<number, number>();
  const idx = rows.map((_, i) => i).sort(() => rand() - 0.5);
  const points: [number, number, number][] = [];
  for (const i of idx) {
    const c = remap.get(lab[i])!;
    if ((perGroup.get(c) ?? 0) >= 400) continue;
    perGroup.set(c, (perGroup.get(c) ?? 0) + 1);
    points.push([Math.round(lg(rows[i].tr) * 1000) / 1000, Math.round(lg(rows[i].v) * 1000) / 1000, c]);
  }
  return { types, points, wallets: rows.length, k: types.length };
}
