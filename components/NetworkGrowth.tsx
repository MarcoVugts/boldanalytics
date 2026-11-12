"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GH, GW, type GrowthGraph } from "@/lib/growth-layout";
import { usd } from "@/lib/format";

const DURATION = 16000; // ms for the full timeline

type Theme = { bg: string; ink: string; ink2: string; mm: string; app: string; other: string; stock: string; dex: string };
const readTheme = (): Theme => {
  const s = getComputedStyle(document.documentElement);
  const v = (k: string) => s.getPropertyValue(k).trim();
  return { bg: v("--surface-1"), ink: v("--text-primary"), ink2: v("--text-secondary"), mm: v("--series-1"), app: v("--series-2"), other: v("--neutral-mark"), stock: v("--text-primary"), dex: v("--text-secondary") };
};
const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "The network grows": wallets → operator → DEX → stock, built up day by day. Canvas, play/pause and a time slider. */
export function NetworkGrowth({ g }: { g: GrowthGraph }) {
  const N = g.days.length;
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(1); // 0..1 position on the timeline
  const [playing, setPlaying] = useState(false);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [w, setW] = useState(720);
  const started = useRef(false);

  // cumulative series per edge / node / total, computed once
  const prep = useMemo(() => {
    const cum = (edges: [number, number, number, number][]) => {
      const m = new Map<string, { a: number; b: number; d: Float64Array; c: Float64Array }>();
      for (const [a, b, day, v] of edges) {
        const k = `${a}|${b}`;
        if (!m.has(k)) m.set(k, { a, b, d: new Float64Array(N), c: new Float64Array(N) });
        m.get(k)!.d[day] += v;
      }
      for (const e of m.values()) { let s = 0; for (let i = 0; i < N; i++) { s += e.d[i]; e.c[i] = s; } }
      return [...m.values()];
    };
    const OD = cum(g.opDex), DS = cum(g.dexStock);
    const node = (edges: typeof OD, side: "a" | "b", n: number) => {
      const arr = Array.from({ length: n }, () => new Float64Array(N));
      for (const e of edges) for (let i = 0; i < N; i++) arr[e[side]][i] += e.c[i];
      return arr;
    };
    const dayTot = new Float64Array(N);
    for (const e of OD) for (let i = 0; i < N; i++) dayTot[i] += e.d[i];
    const cumTot = new Float64Array(N);
    { let s = 0; for (let i = 0; i < N; i++) { s += dayTot[i]; cumTot[i] = s; } }
    const walletsBy = new Int32Array(N);
    for (const wl of g.wallets) walletsBy[wl[1]]++;
    const walletsCum = new Int32Array(N);
    { let s = 0; for (let i = 0; i < N; i++) { s += walletsBy[i]; walletsCum[i] = s; } }
    const maxEdge = Math.max(1, ...OD.map((e) => e.c[N - 1]), ...DS.map((e) => e.c[N - 1]));
    return { OD, DS, opC: node(OD, "a", g.ops.length), dexC: node(OD, "b", g.dexes.length), stC: node(DS, "b", g.stocks.length), dayTot, cumTot, walletsCum, maxEdge };
  }, [g, N]);

  // theme colours (device setting or the visitor's choice) and container width
  useEffect(() => {
    const update = () => setTheme(readTheme());
    update();
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    if (box.current) ro.observe(box.current);
    return () => { mo.disconnect(); mq.removeEventListener("change", update); ro.disconnect(); };
  }, []);

  // start playing the first time the chart scrolls into view
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) { started.current = true; setT(0); setPlaying(true); }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // animation loop
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const step = (now: number) => {
      const dt = now - last; last = now;
      setT((cur) => {
        const next = Math.min(1, Math.max(0, cur + Math.max(0, dt) / DURATION));
        if (next >= 1) setPlaying(false);
        return next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // draw
  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !theme) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const scale = w / GW;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(GH * scale * dpr);
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    const T = theme;
    const f = Math.max(0, Math.min(N - 1, t * (N - 1))), i = Math.floor(f), frac = f - i;
    const at = (arr: Float64Array) => arr[i] + (i + 1 < N ? (arr[i + 1] - arr[i]) * frac : 0);
    const kc = (k?: string) => (k === "market_maker" ? T.mm : k === "unknown" || k === "other" || k === "bot" ? T.other : T.app);
    const W = (v: number) => Math.max(0.6, Math.sqrt(v / prep.maxEdge) * 26);
    const curve = (x0: number, y0: number, x1: number, y1: number, lw: number, col: string, alpha: number) => {
      const mx = (x0 + x1) / 2;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.bezierCurveTo(mx, y0, mx, y1, x1, y1);
      ctx.strokeStyle = col; ctx.globalAlpha = alpha; ctx.lineWidth = lw; ctx.stroke(); ctx.globalAlpha = 1;
    };
    const dot = (x: number, y: number, r: number, col: string, a = 1) => { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; };
    const label = (text: string, x: number, y: number, font: string, col: string, align: CanvasTextAlign) => {
      ctx.font = font; ctx.textAlign = align; ctx.lineJoin = "round"; ctx.lineWidth = 4; ctx.strokeStyle = T.bg; ctx.strokeText(text, x, y); ctx.fillStyle = col; ctx.fillText(text, x, y);
    };
    const font = getComputedStyle(document.body).fontFamily;
    const fz = (px: number) => Math.round(px * (scale < 0.75 ? 1.2 : 1));

    ctx.clearRect(0, 0, GW, GH);
    for (const e of prep.OD) {
      const v = at(e.c); if (v <= 0) continue;
      const o = g.ops[e.a], d = g.dexes[e.b];
      curve(o.x + o.r * 0.6, o.y, d.x - d.r, d.y, W(v), kc(o.kind), 0.2 + Math.min(0.35, (e.d[i] / (prep.dayTot[i] || 1)) * 1.2));
    }
    for (const e of prep.DS) {
      const v = at(e.c); if (v <= 0) continue;
      const d = g.dexes[e.a], s = g.stocks[e.b];
      curve(d.x + d.r, d.y, s.x - s.r, s.y, W(v), T.dex, 0.14 + Math.min(0.3, (e.d[i] / (prep.dayTot[i] || 1)) * 1.2));
    }
    for (const [o, first, x, y, r] of g.wallets) {
      const age = f - first; if (age < 0) continue;
      const op = g.ops[o], c = kc(op.kind);
      const pop = Math.min(1, age / 0.6), fresh = Math.max(0, 1 - age / 2.5);
      if (fresh > 0) { ctx.globalAlpha = 0.25 * fresh; ctx.strokeStyle = c; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(op.x, op.y); ctx.stroke(); ctx.globalAlpha = 1; }
      dot(x, y, r * (0.4 + 0.6 * pop) + fresh * 1.2, c, 0.6 + 0.4 * fresh);
    }
    const hub = (n: { x: number; y: number; r: number; vol: number }, c: Float64Array, col: string, minR: number) => {
      const v = at(c); if (v <= 0) return 0;
      const r = Math.max(minR, n.r * Math.sqrt(v / n.vol));
      dot(n.x, n.y, r + 3, T.bg); dot(n.x, n.y, r, col); return r;
    };
    g.ops.forEach((o, k) => { const r = hub(o, prep.opC[k], kc(o.kind), 4); if (r) label(o.name.replace("Unknown market maker", "Market maker"), o.x - r - 8, o.y + 5, `600 ${fz(17)}px ${font}`, T.ink, "right"); });
    g.dexes.forEach((d, k) => { const r = hub(d, prep.dexC[k], T.dex, 4); if (r) label(d.name, d.x, d.y - r - 7, `600 ${fz(13)}px ${font}`, T.ink2, "center"); });
    g.stocks.forEach((s, k) => { const r = hub(s, prep.stC[k], T.stock, 3); if (r) label(s.name, s.x + r + 8, s.y + 5, `600 ${fz(15)}px ${font}`, T.ink, "left"); });
  }, [t, theme, w, g, N, prep]);

  const i = Math.max(0, Math.min(N - 1, Math.floor(t * (N - 1))));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { if (t >= 1) setT(0); setPlaying((p) => !p || t >= 1); }}
            className="flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-ink-2 hover:bg-surface-0 hover:text-ink"
            aria-label={playing ? "Pause" : t >= 1 ? "Replay" : "Play"}
          >
            {playing ? "❚❚ Pause" : t >= 1 ? "↻ Replay" : "▶ Play"}
          </button>
        </div>
        <div className="text-right">
          <div className="font-brand text-xl font-extrabold tabular-nums sm:text-2xl">{fmtDate(g.days[i])}</div>
          <div className="text-xs text-ink-3 tabular-nums sm:text-sm">
            {prep.walletsCum[i].toLocaleString("en-US")} wallets · {usd(prep.cumTot[i])} traded
          </div>
        </div>
      </div>
      {/* phones: keep a readable minimum width and scroll sideways */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div ref={box} className="w-full min-w-[680px]">
          <canvas ref={canvas} style={{ width: "100%", height: (GH * w) / GW }} role="img" aria-label="Network of wallets, operators, DEXs and stocks growing day by day" />
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(t * 1000)}
        onChange={(e) => { setPlaying(false); setT(+e.target.value / 1000); }}
        aria-label="Timeline"
        className="w-full accent-[var(--series-1)]"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {[["var(--series-1)", "Market maker + its wallets"], ["var(--series-2)", "App / router + its users"], ["var(--neutral-mark)", "Unlabeled"], ["var(--text-primary)", "Stock"]].map(([c, l]) => (
            <li key={l} className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: c }} />{l}</li>
          ))}
        </ul>
        <span>{g.days[0]} → {g.days[N - 1]} (UTC){g.walletsTotal > g.wallets.length ? ` · largest ${g.wallets.length.toLocaleString("en-US")} of ${g.walletsTotal.toLocaleString("en-US")} wallets shown` : ""}</span>
      </div>
    </div>
  );
}
