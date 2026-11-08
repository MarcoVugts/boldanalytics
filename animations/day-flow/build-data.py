# Turn the Dune result of sql/dune/day_flow_minutes.sql (JSON rows) into data.js for index.html.
#   python3 build-data.py dayflow-2026-11-06.json   -> data.js
# Dots: 3-minute buckets x operator x DEX x stock (top 6 stocks + Other).
import json, sys
rows = json.load(open(sys.argv[1]))
ops = ["wm", "mma", "mmb", "ret"]; dexs = ["aero", "uni", "curve", "cake", "other"]
symv = {}
for r in rows: symv[r["symbol"]] = symv.get(r["symbol"], 0) + r["usd"]
top = [s for s, _ in sorted(symv.items(), key=lambda x: -x[1])[:6]]; syms = top + ["Other"]
agg = {}
for r in rows:
    k = (r["m"] // 3, ops.index(r["op"]), dexs.index(r["dex"]), syms.index(r["symbol"]) if r["symbol"] in top else 6)
    agg[k] = agg.get(k, 0) + r["usd"]
data = [[*k, round(v)] for k, v in sorted(agg.items())]
tot = lambda f, n: [sum(v for k, v in agg.items() if k[f] == i) for i in range(n)]
meta = {"syms": syms, "dexs": ["Aerodrome", "Uniswap", "Curve", "PancakeSwap", "Other DEXs"],
        "opTot": tot(1, 4), "dexTot": tot(2, 5), "symTot": tot(3, 7), "total": sum(agg.values())}
open("data.js", "w").write("window.DAYFLOW=" + json.dumps({"rows": data, "meta": meta}) + ";")
print(len(data), "dots", syms)
