# The network grows (prototype)

Wallets → operator (market maker / app) → DEX → stock, built up day by day from `trades_daily` (no Dune credits).

1. Data: `node export.cjs growth.json` (local DuckDB via MD_LOCAL_URL; same SQL as `lib/queries/growth.ts`).
2. Layout (fixed positions, d3-force for the wallet clouds): `node layout.cjs growth.json graph.js`
3. Preview: open `growth.html?p=1` (end state), `?dark` for the dark version, `?p=0.3` for a moment in time.
4. Video: `node render.cjs dark 14` → frames, then
   `ffmpeg -framerate 30 -i frames-dark/f%05d.png -c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart growth-dark.mp4`
