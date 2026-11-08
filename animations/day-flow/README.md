# Day of trades in motion (video for X)

1. Run `sql/dune/day_flow_minutes.sql` for one day (`start_date`/`end_date`), save the result rows as JSON.
   6 Nov 2026: 53k rows, 1.8 MB, ~18 credits.
2. `python3 build-data.py dayflow-YYYY-MM-DD.json` → `data.js`
3. Preview: open `index.html` in a browser. Video: `NODE_PATH=$(npm root -g) node render-frames.cjs` (30 fps frames), then
   `ffmpeg -framerate 30 -i frames/f%05d.png -vf format=yuv420p -c:v libx264 -crf 19 -movflags +faststart day-flow.mp4`

Operators are matched by `tx_to` in the SQL (Wintermute 0x83d5, unknown market makers A 0x278d and B 0x08fb); the
title and date in `index.html` are written for 6 Nov 2026.
