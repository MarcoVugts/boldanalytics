// Bold Analytics logo set (cube + bars in slate blue; stacked lockup "option C, closest").
//   node scripts/build-brand.mjs          -> public/brand/*.svg, app/icon.svg
//   NODE_PATH=$(npm root -g) node scripts/render-brand-png.cjs   -> PNGs (needs Playwright)
// Text is converted to paths (Montserrat), so the SVGs need no font installed.
import { mkdir, writeFile } from "node:fs/promises";
import opentype from "opentype.js";

const F = (w) => opentype.loadSync(new URL(`../node_modules/@fontsource/montserrat/files/montserrat-latin-${w}-normal.woff`, import.meta.url).pathname);
const W800 = F(800), W700 = F(700), W600 = F(600);

export const COLORS = {
  navy: "#1e2a32", cream: "#f8f0e8", slate: "#4f7396", slateOnDark: "#7fa3c6",
};
const LIGHT = { fg: COLORS.navy, acc: COLORS.slate };
const DARK = { fg: COLORS.cream, acc: COLORS.slateOnDark };

const C30 = Math.cos(Math.PI / 6);
const r = (n) => Math.round(n * 100) / 100;
const pts = (a) => a.map(([x, y]) => `${r(x)},${r(y)}`).join(" ");

/** Cube + bars icon in a box of size h at (x, y). */
function icon(x, y, h, { fg, acc }, sw = 0.075) {
  const k = h / 100, s = 40 * k, cx = x + 50 * k, cy = y + 50 * k, a = s * C30, w = sw * 100 * k, pad = w * 0.7;
  const hexp = [[0, -s], [a, -s / 2], [a, s / 2], [0, s], [-a, s / 2], [-a, -s / 2]].map(([dx, dy]) => [cx + dx, cy + dy]);
  const bars = [0.15, 0.42, 0.69].map((t, i) => {
    const bh = [0.42, 0.66, 0.92][i] * (s - 2 * pad), bx = cx + t * a, by = cy + s - (t * s) / 2 - pad, dx = 0.24 * a, dy = -(0.24 * s) / 2;
    return `<path d="M${r(bx)},${r(by)} L${r(bx + dx)},${r(by + dy)} L${r(bx + dx)},${r(by + dy - bh)} L${r(bx)},${r(by - bh)} Z" fill="${acc}"/>`;
  }).join("");
  return `<g fill="none" stroke="${fg}" stroke-width="${r(w)}" stroke-linejoin="round" stroke-linecap="round"><polygon points="${pts(hexp)}"/><path d="M${r(cx - a)},${r(cy - s / 2)} L${r(cx)},${r(cy)} L${r(cx + a)},${r(cy - s / 2)} M${r(cx)},${r(cy)} L${r(cx)},${r(cy + s)}"/></g>${bars}`;
}

function text(font, str, x, baseline, size, tracking = 0) {
  let cur = x; const parts = [];
  for (const ch of str) {
    const g = font.charToGlyph(ch);
    parts.push(g.getPath(cur, baseline, size).toPathData(2));
    cur += (g.advanceWidth / font.unitsPerEm) * size + tracking;
  }
  return { d: parts.join(""), width: cur - x - tracking };
}
const width = (font, str, size, tr = 0) => text(font, str, 0, 0, size, tr).width;
// tight horizontal bounds of rendered text (ink), to align optically
const inkBounds = (font, str, size, tr = 0) => { const p = new opentype.Path(); let cur = 0;
  for (const ch of str) { const g = font.charToGlyph(ch); const gp = g.getPath(cur, 0, size); p.extend(gp); cur += (g.advanceWidth / font.unitsPerEm) * size + tr; }
  return p.getBoundingBox(); };

const svg = (w, h, body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r(w)} ${r(h)}" width="${Math.ceil(w)}" height="${Math.ceil(h)}">${bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : ""}${body}</svg>\n`;

/** Stacked: icon | BOLD over ANALYTICS, placed on the ink positions measured from the approved
 *  mockup (option C, closest), in units of the icon box height h:
 *    BOLD ink: top 0.1793h, left 1.250h · ANALYTICS ink: top 0.7554h, left 1.212h, width 1.674h. */
function stacked(t, bg) {
  const h = 200, pad = 16;
  const boldSize = 0.56 * h, anaSize = 0.22 * h, boldTr = -0.01 * boldSize;
  const bInk = inkBounds(W800, "BOLD", boldSize, boldTr);
  const boldInkW = bInk.x2 - bInk.x1;
  const a0 = inkBounds(W700, "ANALYTICS", anaSize);
  const tracking = (1.674 * h - (a0.x2 - a0.x1)) / 8;
  const aInk = inkBounds(W700, "ANALYTICS", anaSize, tracking);
  const left = pad + 1.212 * h, boldLeft = pad + 1.25 * h;
  // inkBounds are relative to baseline 0, so baseline = desired ink top - y1
  const bold = text(W800, "BOLD", boldLeft - bInk.x1, 0.1793 * h - bInk.y1, boldSize, boldTr);
  const ana = text(W700, "ANALYTICS", left - aInk.x1, 0.7554 * h - aInk.y1, anaSize, tracking);
  const W = Math.max(left + 1.674 * h, boldLeft + boldInkW) + pad;
  return svg(W, h, `${icon(pad, 0, h, t)}<path d="${bold.d}" fill="${t.fg}"/><path d="${ana.d}" fill="${t.fg}"/>`, bg);
}

/** One line: icon BOLD ANALYTICS. */
function horizontal(t, bg) {
  const h = 100, pad = 8, size = 0.57 * h;
  const cap = (W800.tables.os2.sCapHeight / W800.unitsPerEm) * size;
  const baseline = (h + cap) / 2;
  const tx = pad + h + 0.28 * h;
  const bInk = inkBounds(W800, "BOLD", size);
  const bold = text(W800, "BOLD", tx - bInk.x1, baseline, size);
  const ax = tx + (bInk.x2 - bInk.x1) + 0.3 * size;
  const aInk = inkBounds(W600, "ANALYTICS", size, 0.06 * size);
  const ana = text(W600, "ANALYTICS", ax - aInk.x1, baseline, size, 0.06 * size);
  const W = ax + (aInk.x2 - aInk.x1) + pad;
  return svg(W, h, `${icon(pad, 0, h, t)}<path d="${bold.d}" fill="${t.fg}"/><path d="${ana.d}" fill="${t.fg}"/>`, bg);
}

const iconOnly = (t, bg) => svg(100, 100, icon(0, 0, 100, t), bg);
/** App mark: cream cube on navy (rounded tile or circle). Heavier stroke for small sizes. */
const mark = (shape, size = 512) => svg(size, size,
  (shape === "circle" ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${COLORS.navy}"/>` : `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${COLORS.navy}"/>`) +
  icon(size * 0.14, size * 0.14, size * 0.72, DARK, size <= 64 ? 0.095 : 0.08));
/** Favicon on cream tile (light), matches LinkedIn-style square. */
const markLight = (size = 512) => svg(size, size, `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${COLORS.cream}"/>` + icon(size * 0.1, size * 0.1, size * 0.8, LIGHT, size <= 64 ? 0.095 : 0.08));

const OUT = new URL("../public/brand/", import.meta.url);
await mkdir(OUT, { recursive: true });
const out = {
  "logo-stacked.svg": stacked(LIGHT),
  "logo-stacked-on-dark.svg": stacked(DARK),
  "logo-horizontal.svg": horizontal(LIGHT),
  "logo-horizontal-on-dark.svg": horizontal(DARK),
  "icon.svg": iconOnly(LIGHT),
  "icon-on-dark.svg": iconOnly(DARK),
  "mark-navy-rounded.svg": mark("rounded"),
  "mark-navy-circle.svg": mark("circle"),
  "mark-cream-rounded.svg": markLight(),
  "favicon.svg": mark("rounded", 64),
};
for (const [f, c] of Object.entries(out)) await writeFile(new URL(f, OUT), c);
await writeFile(new URL("colors.json", OUT), JSON.stringify(COLORS, null, 2) + "\n");
await writeFile(new URL("../app/icon.svg", import.meta.url), out["favicon.svg"]);
console.log("wrote", Object.keys(out).length, "files");
