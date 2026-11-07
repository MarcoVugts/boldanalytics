// Render PNGs from the brand SVGs in public/brand (run scripts/build-brand.mjs first).
//   NODE_PATH=$(npm root -g) node scripts/render-brand-png.cjs
// Playwright/Chromium is preinstalled globally in the dev container; it is not a project dependency.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const BRAND = path.join(ROOT, "public/brand");
const uri = (f) => "data:image/svg+xml;base64," + fs.readFileSync(path.join(BRAND, f)).toString("base64");
const NAVY = "#1e2a32", CREAM = "#f8f0e8", MUTED = "#c4c3ba";
const TAGLINE = "Onchain data stories &amp; custom dashboards";

const center = (w, h, bg, inner) =>
  `<div style="width:${w}px;height:${h}px;background:${bg};display:flex;align-items:center;justify-content:center">${inner}</div>`;

const jobs = [
  // LinkedIn company logo: square, LinkedIn crops/rounds it itself. Cube on cream, like the profile tile.
  ["public/brand/linkedin-logo-400.png", 400, 400, center(400, 400, CREAM, `<img src="${uri("icon.svg")}" style="width:290px">`)],
  // LinkedIn company page cover (1128x191) and personal profile banner (1584x396)
  ["public/brand/linkedin-cover-1128x191.png", 1128, 191,
    center(1128, 191, NAVY, `<img src="${uri("logo-horizontal-on-dark.svg")}" style="height:58px">`)],
  ["public/brand/linkedin-banner-1584x396.png", 1584, 396,
    `<div style="width:1584px;height:396px;background:${NAVY};display:flex;align-items:center;justify-content:flex-end;padding-right:120px;box-sizing:border-box;gap:28px;flex-direction:column;align-items:flex-end;justify-content:center;font-family:Helvetica,Arial,sans-serif">
      <img src="${uri("logo-stacked-on-dark.svg")}" style="height:120px"><div style="color:${MUTED};font-size:26px">${TAGLINE}</div></div>`],
  // X
  ["public/brand/x-avatar-400.png", 400, 400, center(400, 400, NAVY, `<img src="${uri("icon-on-dark.svg")}" style="width:290px">`)],
  ["public/brand/x-header-1500x500.png", 1500, 500,
    `<div style="width:1500px;height:500px;background:${NAVY};display:flex;align-items:center;justify-content:center;flex-direction:column;gap:26px;font-family:Helvetica,Arial,sans-serif">
      <img src="${uri("logo-stacked-on-dark.svg")}" style="height:150px"><div style="color:${MUTED};font-size:30px;letter-spacing:.02em">${TAGLINE}</div></div>`],
  // App icons
  ["app/apple-icon.png", 180, 180, `<img src="${uri("mark-navy-rounded.svg")}" style="width:180px;height:180px;display:block">`],
  ["public/brand/favicon-32.png", 32, 32, `<img src="${uri("favicon.svg")}" style="width:32px;height:32px;display:block">`],
  // Large logos for documents and presentations (transparent background for the light one)
  ["public/brand/logo-stacked-2000.png", 2000, 0, `<img src="${uri("logo-stacked.svg")}" style="width:2000px;display:block">`],
  ["public/brand/logo-stacked-on-dark-2000.png", 2000, 0, `<div style="background:${NAVY}"><img src="${uri("logo-stacked-on-dark.svg")}" style="width:2000px;display:block"></div>`],
];

(async () => {
  const browser = await chromium.launch();
  for (const [out, w, h, html] of jobs) {
    const page = await browser.newPage({ viewport: { width: w, height: h || 800 } });
    await page.setContent(`<body style="margin:0;background:transparent">${html}</body>`);
    await page.waitForTimeout(150);
    const file = path.join(ROOT, out);
    if (h) await page.screenshot({ path: file, omitBackground: true });
    else await (await page.$("body > *")).screenshot({ path: file, omitBackground: true });
    console.log("wrote", out);
  }
  await browser.close();
})();
