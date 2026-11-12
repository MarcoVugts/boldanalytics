// Fixed positions for the growth network. Canvas 1080x1080, centre (540, 560).
// DEXs: small vertical column in the centre. Operators: arc on the left, their wallets as a cloud further out.
// Stocks: arc on the right. Wallets settle with d3-force (pull to their operator's cloud centre + collision).
const fs = require("fs");
const d3 = require("/home/user/boldanalytics/node_modules/d3-force");
const data = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const CX = 540, CY = 560;
const rad = (v, k, min) => Math.max(min, Math.sqrt(v) * k);
const maxVol = Math.max(...data.ops.map((o) => o.vol), ...data.stocks.map((o) => o.vol));
const K = 36 / Math.sqrt(maxVol);                         // biggest hub ≈ 36px radius
const arc = (n, r, a0, a1) => Array.from({ length: n }, (_, i) => (n === 1 ? (a0 + a1) / 2 : a0 + ((a1 - a0) * i) / (n - 1))).map((a) => [CX + r * Math.cos(a), CY + r * Math.sin(a)]);
const deg = (d) => (d * Math.PI) / 180;

const dexes = data.dexes.map((d, i, all) => ({ ...d, t: "dex", x: CX, y: CY - ((all.length - 1) * 70) / 2 + i * 70, r: rad(d.vol, K * 0.8, 6) }));
// operators: biggest in the middle of the left arc
const opsSorted = [...data.ops].sort((a, b) => b.vol - a.vol);
const order = []; opsSorted.forEach((o, i) => (i % 2 ? order.push(o) : order.unshift(o)));
const opPos = arc(order.length, 250, deg(205), deg(155) - 2 * Math.PI + 2 * Math.PI).reverse();
const ops = order.map((o, i) => {
  const a = deg(124 + (112 * i) / Math.max(1, order.length - 1)) + (order.length === 1 ? deg(56) : 0);
  return { ...o, t: "op", x: CX + 230 * Math.cos(a), y: CY + 230 * Math.sin(a), a, r: rad(o.vol, K, 7) };
});
const stocks = [...data.stocks].sort((a, b) => b.vol - a.vol).map((s, i, all) => {
  const a = deg(-66 + (132 * i) / Math.max(1, all.length - 1));
  return { ...s, t: "stock", x: CX + 300 * Math.cos(a), y: CY + 300 * Math.sin(a), r: rad(s.vol, K, 5) };
});
const opBy = Object.fromEntries(ops.map((o) => [o.name, o]));
const wv = Math.max(...data.wallets.map((w) => w.vol));
const wallets = data.wallets.map((w, i) => {
  const o = opBy[w.op]; const tx = CX + 335 * Math.cos(o.a), ty = CY + 335 * Math.sin(o.a);
  return { ...w, t: "w", i, x: tx + (Math.random() - 0.5) * 40, y: ty + (Math.random() - 0.5) * 40, tx, ty, r: 1.2 + 4.5 * Math.sqrt(w.vol / wv) };
});
const sim = d3.forceSimulation(wallets)
  .force("x", d3.forceX((d) => d.tx).strength(0.09))
  .force("y", d3.forceY((d) => d.ty).strength(0.09))
  .force("c", d3.forceCollide((d) => d.r + 0.8))
  .stop();
for (let i = 0; i < 400; i++) sim.tick();
const round = (n) => Math.round(n * 10) / 10;
const out = { ...data, dexes: dexes.map((n) => ({ ...n, x: round(n.x), y: round(n.y) })), ops: ops.map((n) => ({ ...n, x: round(n.x), y: round(n.y) })),
  stocks: stocks.map((n) => ({ ...n, x: round(n.x), y: round(n.y) })),
  wallets: wallets.map(({ op, first, vol, x, y, r }) => ({ op, first, vol, x: round(x), y: round(y), r: round(r) })) };
fs.writeFileSync(process.argv[3], "window.G=" + JSON.stringify(out) + ";");
console.log("ok", wallets.length);
