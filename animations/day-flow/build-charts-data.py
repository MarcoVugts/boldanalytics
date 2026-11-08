# Data for charts.html (heatmap ?v=1, market-maker ping-pong ?v=2, stock race ?v=3) -> charts-data.js
#   python3 build-charts-data.py dayflow-2026-11-06.json sides-sndk-2026-11-06.json
# dayflow = result of sql/dune/day_flow_minutes.sql; sides = result of sql/dune/day_sides_minutes.sql (one stock).
import json, sys
rows = json.load(open(sys.argv[1])); sides = json.load(open(sys.argv[2]))
ops = ["wm", "mma", "mmb", "ret"]
hourly = {o: [0] * 24 for o in ops}
for r in rows: hourly[r["op"]][r["m"] // 60] += r["usd"]
b5 = {o: [[0, 0] for _ in range(288)] for o in ["mma", "ret", "wm"]}
net = {o: [0] * 1440 for o in b5}
for r in sides:
    if r["op"] in b5:
        b5[r["op"]][r["m"] // 5][0] += r["buy"]; b5[r["op"]][r["m"] // 5][1] += r["sell"]; net[r["op"]][r["m"]] += r["buy"] - r["sell"]
pos = {}
for o, arr in net.items():
    c, out = 0, []
    for v in arr: c += v; out.append(round(c))
    pos[o] = out[4::5]
symv = {}
for r in rows: symv[r["symbol"]] = symv.get(r["symbol"], 0) + r["usd"]
top = [s for s, _ in sorted(symv.items(), key=lambda x: -x[1])[:8]]
step = {s: [0] * 288 for s in top}
for r in rows:
    if r["symbol"] in top: step[r["symbol"]][r["m"] // 5] += r["usd"]
cum = {}
for s in top:
    c, out = 0, []
    for v in step[s]: c += v; out.append(round(c))
    cum[s] = out
data = {"hourly": hourly, "b5": {k: [[round(a), round(b)] for a, b in v] for k, v in b5.items()}, "pos": pos,
        "race": {"syms": top, "cum": cum}, "total": sum(symv.values())}
open("charts-data.js", "w").write("window.D2=" + json.dumps(data) + ";")
print("ok", top)
