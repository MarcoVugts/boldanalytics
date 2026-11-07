// Render brand/brand-sheet.html to brand/brand-sheet.png (2x) and brand/brand-sheet.pdf.
//   NODE_PATH=$(npm root -g) node scripts/render-brand-sheet.cjs
const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const file = "file://" + path.join(__dirname, "../brand/brand-sheet.html");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 });
  await page.goto(file);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(__dirname, "../brand/brand-sheet.png"), fullPage: true });
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.pdf({ path: path.join(__dirname, "../brand/brand-sheet.pdf"), width: "1600px", height: `${height}px`, printBackground: true });
  await browser.close();
  console.log("wrote brand/brand-sheet.png and brand/brand-sheet.pdf");
})();
