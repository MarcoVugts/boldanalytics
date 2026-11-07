// Render PNGs from the brand SVGs (needs Playwright/Chromium):
//   node scripts/render-brand-png.mjs
// X avatar 400x400 (circle-safe), X header 1500x500, apple-touch icon 180x180.
import { createRequire } from "node:module";
// Playwright is preinstalled globally in the dev container; not a project dependency.
const { chromium } = createRequire(import.meta.url)("playwright");
import { readFile } from "node:fs/promises";

const svg = async (p) => `data:image/svg+xml;base64,${(await readFile(new URL(`../${p}`, import.meta.url))).toString("base64")}`;
const jobs = [
  { out: "public/brand/x-avatar-400.png", w: 400, h: 400,
    html: async () => `<img src="${await svg("public/brand/mark-circle.svg")}" style="width:400px;height:400px">` },
  { out: "app/apple-icon.png", w: 180, h: 180,
    html: async () => `<img src="${await svg("public/brand/mark.svg")}" style="width:180px;height:180px">` },
  { out: "public/brand/x-header-1500x500.png", w: 1500, h: 500,
    html: async () => `<div style="width:1500px;height:500px;background:#1f2b33;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:28px;font-family:Montserrat,Arial,sans-serif">
      <img src="${await svg("public/brand/logo-stacked-on-dark.svg")}" style="height:150px">
      <div style="color:#c4c3ba;font-size:30px;letter-spacing:0.02em">Onchain data stories &amp; custom dashboards</div></div>` },
];
const browser = await chromium.launch();
for (const j of jobs) {
  const page = await browser.newPage({ viewport: { width: j.w, height: j.h } });
  await page.setContent(`<body style="margin:0;background:transparent">${await j.html()}</body>`);
  await page.waitForTimeout(200);
  await page.screenshot({ path: new URL(`../${j.out}`, import.meta.url).pathname, omitBackground: true });
  console.log("wrote", j.out);
}
await browser.close();
