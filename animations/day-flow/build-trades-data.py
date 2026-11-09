# Data for trades.html (one dot per trade) from the result of sql/dune/day_trades.sql -> trades.js
#   python3 build-trades-data.py trades-2026-11-06.json
import json, sys
rows = json.load(open(sys.argv[1]))
opi = {"w": 0, "a": 1, "b": 2, "r": 3}
symv = {}
for r in rows: symv[r["k"]] = symv.get(r["k"], 0) + r["u"]
top = [s for s, _ in sorted(symv.items(), key=lambda x: -x[1])[:6]]; syms = top + ["Other"]
out = sorted([[r["s"], opi[r["o"]], 0 if r["d"] == "A" else 1, syms.index(r["k"]) if r["k"] in top else 6, r["u"]] for r in rows])
tot = lambda f, n: [sum(x[4] for x in out if x[f] == i) for i in range(n)]
meta = {"syms": syms, "opTot": tot(1, 4), "dexTot": tot(2, 2), "symTot": tot(3, 7), "total": sum(x[4] for x in out), "n": len(out)}
flat = [v for x in out for v in x]
open("trades.js", "w").write("window.TR={meta:" + json.dumps(meta) + ",flat:" + json.dumps(flat, separators=(",", ":")) + "};")
print(len(out), "trades", syms)
