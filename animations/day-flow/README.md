# Day of trades in motion (video for X)

1. Run `sql/dune/day_flow_minutes.sql` for one day (`start_date`/`end_date`), save the result rows as JSON.
   6 Nov 2026: 53k rows, 1.8 MB, ~18 credits.
2. `python3 build-data.py dayflow-YYYY-MM-DD.json` → `data.js`
3. Preview: open `index.html` in a browser. Video: `NODE_PATH=$(npm root -g) node render-frames.cjs` (30 fps frames), then
   `ffmpeg -framerate 30 -i frames/f%05d.png -vf format=yuv420p -c:v libx264 -crf 19 -movflags +faststart day-flow.mp4`

Operators are matched by `tx_to` in the SQL (Wintermute 0x83d5, unknown market makers A 0x278d and B 0x08fb); the
title and date in `index.html` are written for 6 Nov 2026.

## Still charts and the stock race (charts.html)
- `sql/dune/day_sides_minutes.sql` (params `start_date`, `end_date`, `symbol`): buys/sells per minute per operator for one
  stock (6 Nov, SNDK: 4k rows, ~1 credit).
- `python3 build-charts-data.py dayflow-….json sides-….json` → `charts-data.js`
- `charts.html?v=1` heatmap per hour · `?v=2` how a market maker trades · `?v=3` stock race (call `window.frame(0..1)` per
  video frame, same frame-capture approach as `render-frames.cjs`).
