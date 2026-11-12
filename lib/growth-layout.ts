import { forceCollide, forceSimulation, forceX, forceY, type SimulationNodeDatum } from "d3-force";
import type { Growth } from "./queries/growth";

// Fixed positions for the "network grows" visual, computed once on the server (cached with the data).
// Logical canvas W x H. DEXs: column in the centre; operators: arc on the left with their wallets as a cloud further
// out; stocks: arc on the right. Compact arrays keep the payload small (wallets can run into the thousands).

export const GW = 1080, GH = 760;
export type Hub = { name: string; kind?: string; x: number; y: number; r: number; vol: number; first: number };
/** wallets: [opIndex, firstDayIndex, x, y, r]; edges: [aIndex, bIndex, dayIndex, volume] */
export type GrowthGraph = {
  days: string[];
  ops: Hub[];
  dexes: Hub[];
  stocks: Hub[];
  wallets: [number, number, number, number, number][];
  opDex: [number, number, number, number][];
  dexStock: [number, number, number, number][];
  walletsTotal: number;
};

const MAX_WALLETS = 8000;
const r1 = (n: number) => Math.round(n * 10) / 10;

export function layoutGrowth(g: Growth): GrowthGraph {
  const CX = GW / 2, CY = GH / 2 + 10;
  const dayIx = new Map(g.days.map((d, i) => [d, i]));
  const deg = (d: number) => (d * Math.PI) / 180;
  const maxVol = Math.max(1, ...g.ops.map((o) => o.vol), ...g.stocks.map((o) => o.vol));
  const K = 36 / Math.sqrt(maxVol);
  const rad = (v: number, k: number, min: number) => Math.max(min, Math.sqrt(Math.max(0, v)) * k);

  const dexes: Hub[] = g.dexes.map((d, i, all) => ({ name: d.name, x: CX, y: r1(CY - ((all.length - 1) * 70) / 2 + i * 70), r: r1(rad(d.vol, K * 0.8, 6)), vol: d.vol, first: dayIx.get(d.first) ?? 0 }));
  // operators: biggest in the middle of the left arc
  const order: typeof g.ops = [];
  [...g.ops].sort((a, b) => b.vol - a.vol).forEach((o, i) => (i % 2 ? order.push(o) : order.unshift(o)));
  const opAngle = order.map((_, i) => deg(124 + (112 * i) / Math.max(1, order.length - 1)) + (order.length === 1 ? deg(56) : 0));
  const ops: Hub[] = order.map((o, i) => ({ name: o.name, kind: o.kind, x: r1(CX + 230 * Math.cos(opAngle[i])), y: r1(CY + 230 * Math.sin(opAngle[i])), r: r1(rad(o.vol, K, 7)), vol: o.vol, first: dayIx.get(o.first) ?? 0 }));
  const stocks: Hub[] = [...g.stocks].sort((a, b) => b.vol - a.vol).map((s, i, all) => {
    const a = deg(-66 + (132 * i) / Math.max(1, all.length - 1));
    return { name: s.name, x: r1(CX + 300 * Math.cos(a)), y: r1(CY + 300 * Math.sin(a)), r: r1(rad(s.vol, K, 5)), vol: s.vol, first: dayIx.get(s.first) ?? 0 };
  });

  const opIx = new Map(ops.map((o, i) => [o.name, i]));
  const walletsIn = [...g.wallets].sort((a, b) => b.vol - a.vol).slice(0, MAX_WALLETS);
  const wv = Math.max(1, ...walletsIn.map((w) => w.vol));
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; // deterministic layout
  type WN = SimulationNodeDatum & { o: number; f: number; r: number; tx: number; ty: number };
  const nodes: WN[] = walletsIn.map((w) => {
    const o = opIx.get(w.op) ?? 0;
    const tx = CX + 335 * Math.cos(opAngle[o]), ty = CY + 335 * Math.sin(opAngle[o]);
    return { o, f: dayIx.get(w.first) ?? 0, r: 1.2 + 4.5 * Math.sqrt(w.vol / wv), tx, ty, x: tx + (rnd() - 0.5) * 40, y: ty + (rnd() - 0.5) * 40 };
  });
  const sim = forceSimulation(nodes)
    .randomSource(rnd)
    .force("x", forceX<WN>((d) => d.tx).strength(0.09))
    .force("y", forceY<WN>((d) => d.ty).strength(0.09))
    .force("c", forceCollide<WN>((d) => d.r + 0.8))
    .stop();
  for (let i = 0; i < 300; i++) sim.tick();

  const dexIx = new Map(dexes.map((d, i) => [d.name, i]));
  const stIx = new Map(stocks.map((s, i) => [s.name, i]));
  return {
    days: g.days,
    ops,
    dexes,
    stocks,
    wallets: nodes.map((n) => [n.o, n.f, r1(n.x ?? 0), r1(n.y ?? 0), r1(n.r)]),
    opDex: g.opDex.map((e) => [opIx.get(e.a) ?? 0, dexIx.get(e.b) ?? 0, dayIx.get(e.day) ?? 0, Math.round(e.vol)]),
    dexStock: g.dexStock.map((e) => [dexIx.get(e.a) ?? 0, stIx.get(e.b) ?? 0, dayIx.get(e.day) ?? 0, Math.round(e.vol)]),
    walletsTotal: g.wallets.length,
  };
}
