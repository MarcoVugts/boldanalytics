const { chromium } = require("playwright"); const fs = require("fs");
(async () => { const dark = process.argv[2] === "dark"; const secs = +process.argv[3] || 15, FPS = 30, n = secs * FPS;
 const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1080 } });
 await p.goto("file://" + process.cwd() + "/growth.html?" + (dark ? "dark&" : "") + "p=0"); await p.waitForFunction(() => window.ready);
 const dir = "frames-" + (dark ? "dark" : "light"); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
 for (let i = 0; i < n + FPS * 2; i++) { const t = Math.min(1, i / n); const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
   await p.evaluate((x) => window.frame(x), e * 0.15 + t * 0.85); await p.screenshot({ path: `${dir}/f${String(i).padStart(5, "0")}.png` }); }
 await b.close(); console.log("frames", n + FPS * 2); })();
