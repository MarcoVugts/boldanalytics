import { forceCollide, forceSimulation, forceX, forceY, type SimulationNodeDatum } from "d3-force";
import type { Growth } from "./queries/growth";

// Fixed positions for the "network grows" visual, computed once on the server (cached with the data).
// Logical canvas W x H. DEXs: column in the centre; operators: arc on the left with their wallets as a cloud further
// out; stocks: arc on the right. Compact arrays keep the payload small (wallets can run into the thousands).

export const GW = 1200, GH = 860;
export type Hub = { name: string; kind?: string; x: number; y: number; r: number; vol: number; first: number };
/** wallets: one dot per `perDot` wallets: [opIndex, firstDayIndex, x, y, r]; edges: [aIndex, bIndex, dayIndex, volume]
 *  newWallets: real number of new wallets per day (for the counter). */
export type GrowthGraph = {
  days: string[];
  ops: Hub[];
  dexes: Hub[];
  stocks: Hub[];
  wallets: [number, number, number, number, number][];
  opDex: [number, number, number, number][];
  dexStock: [number, number, number, number][];
  walletsTotal: number;
  perDot: number;
  newWallets: number[];
};

const MAX_DOTS = 7000;
const r1 = (n: number) => Math.round(n * 10) / 10;
const TOP = 70, BOTTOM = GH - 40;
const OP_X = 520, DEX_X = 700, ST_X = 930;
const CLUSTER_RIGHT = 285, CLUSTER_LEFT = 16; // wallet clouds live left of the operator labels

/** Stack hubs vertically in the given order: gaps follow their radii, the whole column is centred. */
function column<T extends { r: number }>(items: T[], gap: number) {
  const total = items.reduce((s, n) => s + 2 * n.r, 0) + gap * Math.max(0, items.length - 1);
  const span = BOTTOM - TOP;
  const g = items.length > 1 && total > span ? Math.max(4, gap - (total - span) / (items.length - 1)) : gap;
  const used = items.reduce((s, n) => s + 2 * n.r, 0) + g * Math.max(0, items.length - 1);
  let y = TOP + (span - used) / 2;
  return items.map((n) => { const cy = y + n.r; y += 2 * n.r + g; return cy; });
}

export function layoutGrowth(g: Growth): GrowthGraph {
  const dayIx = new Map(g.days.map((d, i) => [d, i]));
  const maxVol = Math.max(1, ...g.ops.map((o) => o.vol), ...g.stocks.map((o) => o.vol), ...g.dexes.map((o) => o.vol));
  const K = 30 / Math.sqrt(maxVol); // biggest hub ≈ 30px radius
  const rad = (v: number, min: number) => Math.max(min, Math.sqrt(Math.max(0, v)) * K);

  const dexR = g.dexes.map((d) => rad(d.vol, 5));
  const dexY = column(dexR.map((r) => ({ r })), 34);
  const dexes: Hub[] = g.dexes.map((d, i) => ({ name: d.name, x: DEX_X, y: r1(dexY[i]), r: r1(dexR[i]), vol: d.vol, first: dayIx.get(d.first) ?? 0 }));

  // stocks: column on a gentle arc (centre bulges right), largest on top
  const st = [...g.stocks].sort((a, b) => b.vol - a.vol);
  const stR = st.map((s) => rad(s.vol, 4));
  const stY = column(stR.map((r) => ({ r })), 12);
  const midY = (TOP + BOTTOM) / 2, half = (BOTTOM - TOP) / 2;
  const stocks: Hub[] = st.map((s, i) => ({ name: s.name, x: r1(ST_X + 50 * (1 - ((stY[i] - midY) / half) ** 2)), y: r1(stY[i]), r: r1(stR[i]), vol: s.vol, first: dayIx.get(s.first) ?? 0 }));

  // operators + wallet clouds: one sunflower (phyllotaxis) cloud per operator, oldest wallets in the centre and the
  // newest on the rim, so each cloud grows outward ring by ring. Clouds are packed in the left band; the operator
  // column is then re-ordered to match the clouds' vertical order, so every cloud sits next to its own hub.
  let order: typeof g.ops = [];
  [...g.ops].sort((a, b) => b.vol - a.vol).forEach((o, i) => (i % 2 ? order.push(o) : order.unshift(o)));
  // one dot per `perDot` wallets (a round number), so every wallet is represented while the canvas stays fast
  const walletsTotal = g.wallets.reduce((a, w) => a + w.n, 0);
  const perDot = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000].find((k) => walletsTotal / k <= MAX_DOTS) ?? Math.ceil(walletsTotal / MAX_DOTS);
  const newWallets = g.days.map(() => 0);
  const byOp = new Map<string, { f: number; vol: number }[]>(g.ops.map((o) => [o.name, []]));
  for (const w of g.wallets) {
    const f = dayIx.get(w.first) ?? 0;
    newWallets[f] += w.n;
    const dots = Math.max(1, Math.round(w.n / perDot));
    for (let k = 0; k < dots; k++) (byOp.get(w.op) ?? byOp.set(w.op, []).get(w.op)!).push({ f, vol: w.vol / dots });
  }
  const walletsIn = [...byOp.values()].flat();
  const bandArea = (CLUSTER_RIGHT - CLUSTER_LEFT) * (BOTTOM - TOP + 40);
  const s = Math.min(9, Math.max(2.6, Math.sqrt((bandArea * 0.5) / Math.max(1, walletsIn.length))));
  const c = 0.53 * s; // sunflower: radius of point k = c * sqrt(k)
  const wv = Math.max(1, ...walletsIn.map((w) => w.vol));
  const opRad = (o: (typeof g.ops)[number]) => rad(o.vol, 5);
  const placeOps = () => {
    const rs = order.map(opRad);
    const gap = Math.min(58, Math.max(18, (BOTTOM - TOP - rs.reduce((a, r) => a + 2 * r, 0)) / Math.max(1, rs.length - 1)));
    const ys = column(rs.map((r) => ({ r })), gap);
    return new Map(order.map((o, i) => [o.name, ys[i]]));
  };
  type CN = SimulationNodeDatum & { name: string; R: number; ty: number };
  let opYBy = placeOps();
  const clusters: CN[] = g.ops.map((o) => ({ name: o.name, R: c * Math.sqrt(byOp.get(o.name)!.length) + s, ty: opYBy.get(o.name)!, x: CLUSTER_RIGHT - 40, y: opYBy.get(o.name)! }));
  const live = clusters.filter((n) => n.R > s);
  const settle = () => {
    const sim = forceSimulation(live)
      .force("x", forceX<CN>((n) => Math.max(CLUSTER_LEFT + n.R, CLUSTER_RIGHT - n.R)).strength(0.2))
      .force("y", forceY<CN>((n) => n.ty).strength(0.12))
      .force("c", forceCollide<CN>((n) => n.R + 5).strength(1))
      .stop();
    for (let k = 0; k < 400; k++) {
      sim.tick();
      for (const n of live) {
        n.x = Math.min(CLUSTER_RIGHT - n.R, Math.max(CLUSTER_LEFT + n.R, n.x ?? 0));
        n.y = Math.min(GH - 10 - n.R, Math.max(TOP - 30 + n.R, n.y ?? 0));
      }
    }
  };
  for (let pass = 0; pass < 3; pass++) {
    settle();
    const cy = new Map(clusters.map((n) => [n.name, n.R > s ? (n.y ?? 0) : opYBy.get(n.name)!]));
    order = [...order].sort((a, b) => cy.get(a.name)! - cy.get(b.name)!);
    opYBy = placeOps();
    for (const n of clusters) n.ty = opYBy.get(n.name)!;
  }
  const ops: Hub[] = order.map((o) => ({ name: o.name, kind: o.kind, x: OP_X, y: r1(opYBy.get(o.name)!), r: r1(opRad(o)), vol: o.vol, first: dayIx.get(o.first) ?? 0 }));
  const opIx = new Map(ops.map((o, i) => [o.name, i]));
  const clusterBy = new Map(clusters.map((n) => [n.name, n]));

  const GOLD = Math.PI * (3 - Math.sqrt(5));
  const wallets: GrowthGraph["wallets"] = [];
  ops.forEach((o, i) => {
    const cl = clusterBy.get(o.name)!;
    const grp = byOp.get(o.name)!.sort((a, b) => a.f - b.f || b.vol - a.vol);
    grp.forEach((w, k) => {
      const rr = c * Math.sqrt(k + 0.5), th = k * GOLD;
      wallets.push([i, w.f, r1((cl.x ?? 0) + rr * Math.cos(th)), r1((cl.y ?? 0) + rr * Math.sin(th)), r1(s * (0.22 + 0.22 * Math.sqrt(w.vol / wv)))]);
    });
  });

  const dexIx = new Map(dexes.map((d, i) => [d.name, i]));
  const stIx = new Map(stocks.map((x, i) => [x.name, i]));
  return {
    days: g.days,
    ops,
    dexes,
    stocks,
    wallets,
    opDex: g.opDex.map((e) => [opIx.get(e.a) ?? 0, dexIx.get(e.b) ?? 0, dayIx.get(e.day) ?? 0, Math.round(e.vol)]),
    dexStock: g.dexStock.map((e) => [dexIx.get(e.a) ?? 0, stIx.get(e.b) ?? 0, dayIx.get(e.day) ?? 0, Math.round(e.vol)]),
    walletsTotal,
    perDot,
    newWallets,
  };
}
