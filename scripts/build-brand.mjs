// Generate the Bold Analytics logo set as self-contained SVGs (text converted to paths).
//   node scripts/build-brand.mjs
// Outputs public/brand/*.svg and app/icon.svg. PNGs (avatar, banner, apple icon) are
// rendered from these by scripts/render-brand-png.mjs.
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import opentype from "opentype.js";

const require = createRequire(import.meta.url);
const font = (w) => opentype.loadSync(require.resolve(`@fontsource/montserrat/files/montserrat-latin-${w}-normal.woff`));
const HEAVY = font(800);
const MEDIUM = font(600);

export const BRAND = {
  navy: "#1f2b33",
  cream: "#f8f1e7",
  accent: "#2a78d6",
};

const r = (n) => Math.round(n * 100) / 100;

/**
 * Isometric cube with three rising bars on its right face.
 * Centered at (cx, cy), "radius" s (center to top vertex). Stroke scales with s.
 */
function cube(cx, cy, s, { stroke, bars, sw = s * 0.17 }) {
  const a = s * Math.cos(Math.PI / 6);
  const P = (x, y) => `${r(cx + x)},${r(cy + y)}`;
  const outline = [P(0, -s), P(a, -s / 2), P(a, s / 2), P(0, s), P(-a, s / 2), P(-a, -s / 2)].join(" ");
  const inner = `M${P(-a, -s / 2)} L${P(0, 0)} L${P(a, -s / 2)} M${P(0, 0)} L${P(0, s)}`;
  // bars on the right face: along the face's bottom edge, rising vertically
  const pad = sw * 0.75;
  const slots = [0.17, 0.43, 0.69];
  const heights = [0.4, 0.64, 0.9];
  const w = 0.21;
  const barPaths = slots.map((t, i) => {
    const bx = t * a, by = s - (t * s) / 2 - pad;
    const dx = w * a, dy = -(w * s) / 2;
    const h = heights[i] * (s - 2 * pad);
    return `M${P(bx, by)} L${P(bx + dx, by + dy)} L${P(bx + dx, by + dy - h)} L${P(bx, by - h)} Z`;
  });
  return `
  <g fill="none" stroke="${stroke}" stroke-width="${r(sw)}" stroke-linejoin="round" stroke-linecap="round">
    <polygon points="${outline}"/>
    <path d="${inner}"/>
  </g>
  <g fill="${bars}">${barPaths.map((d) => `<path d="${d}"/>`).join("")}</g>`;
}

/** Text as a path, with optional letter spacing (in font units of size). */
function textPath(f, text, x, y, size, tracking = 0) {
  let cursor = x;
  const parts = [];
  for (const ch of text) {
    const g = f.charToGlyph(ch);
    parts.push(g.getPath(cursor, y, size).toPathData(2));
    cursor += (g.advanceWidth / f.unitsPerEm) * size + tracking * size;
  }
  return { d: parts.join(""), width: cursor - x - tracking * size };
}

function measure(f, text, size, tracking = 0) {
  return textPath(f, text, 0, 0, size, tracking).width;
}

/** Stacked logo: icon left, BOLD over ANALYTICS right. */
function stacked({ fg, bg, accent }) {
  const H = 200;
  const boldSize = 112;
  const boldW = measure(HEAVY, "BOLD", boldSize);
  // fit ANALYTICS to the width of BOLD using tracking
  const aSize = 36;
  const base = measure(MEDIUM, "ANALYTICS", aSize);
  const tracking = (boldW - base) / (aSize * 8);
  const iconS = 78;
  const iconCx = 20 + iconS * Math.cos(Math.PI / 6) + 10;
  const textX = iconCx + iconS + 40;
  const bold = textPath(HEAVY, "BOLD", textX, 112, boldSize);
  const ana = textPath(MEDIUM, "ANALYTICS", textX + 3, 170, aSize, tracking);
  const W = Math.ceil(textX + boldW + 24);
  return svg(W, H, bg, `
  ${cube(iconCx, H / 2, iconS, { stroke: fg, bars: accent })}
  <path d="${bold.d}" fill="${fg}"/>
  <path d="${ana.d}" fill="${fg}"/>`);
}

/** One-line logo: icon | BOLD ANALYTICS (BOLD heavy, ANALYTICS medium). */
function horizontal({ fg, bg, accent }) {
  const H = 120;
  const size = 56;
  const iconS = 44;
  const iconCx = 16 + iconS * Math.cos(Math.PI / 6) + 6;
  const x0 = iconCx + iconS + 30;
  const bold = textPath(HEAVY, "BOLD", x0, 80, size, 0.02);
  const ana = textPath(MEDIUM, "ANALYTICS", x0 + bold.width + size * 0.38, 80, size, 0.08);
  const W = Math.ceil(x0 + bold.width + size * 0.38 + ana.width + 20);
  return svg(W, H, bg, `
  ${cube(iconCx, H / 2, iconS, { stroke: fg, bars: accent })}
  <path d="${bold.d}" fill="${fg}"/>
  <path d="${ana.d}" fill="${fg}"/>`);
}

/** Compact mark for favicon / avatar: cream cube on a navy tile (rounded or circle). */
function mark({ size = 512, shape = "rounded" }) {
  const s = size * (size <= 64 ? 0.34 : 0.31);
  const tile =
    shape === "circle"
      ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${BRAND.navy}"/>`
      : `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${BRAND.navy}"/>`;
  return svg(size, size, null, `${tile}${cube(size / 2, size / 2, s, { stroke: BRAND.cream, bars: "#4b93e6", sw: s * (size <= 64 ? 0.24 : 0.2) })}`);
}

/** Icon only, transparent (for inline use). */
function icon({ fg, accent }) {
  const size = 200;
  return svg(size, size, null, cube(size / 2, size / 2, 80, { stroke: fg, bars: accent }));
}

function svg(w, h, bg, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${
    bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ""
  }${body}
</svg>
`;
}

const light = { fg: BRAND.navy, bg: null, accent: BRAND.accent };
const dark = { fg: BRAND.cream, bg: null, accent: "#4b93e6" };

await mkdir(new URL("../public/brand/", import.meta.url), { recursive: true });
const out = {
  "public/brand/logo-stacked.svg": stacked(light),
  "public/brand/logo-stacked-on-dark.svg": stacked(dark),
  "public/brand/logo-horizontal.svg": horizontal(light),
  "public/brand/logo-horizontal-on-dark.svg": horizontal(dark),
  "public/brand/icon.svg": icon(light),
  "public/brand/icon-on-dark.svg": icon(dark),
  "public/brand/mark.svg": mark({ shape: "rounded" }),
  "public/brand/mark-circle.svg": mark({ shape: "circle" }),
  "app/icon.svg": mark({ size: 64, shape: "rounded" }),
};
for (const [p, content] of Object.entries(out)) await writeFile(new URL(`../${p}`, import.meta.url), content);
console.log("wrote", Object.keys(out).join(", "));
