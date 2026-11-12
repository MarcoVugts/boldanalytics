const { Pool } = require("/home/user/boldanalytics/node_modules/pg");
const fs = require("fs");
(async () => {
const src = fs.readFileSync("/home/user/boldanalytics/lib/queries/growth.ts", "utf8");
const base = src.slice(src.indexOf("const base = `") + 14, src.indexOf("`;\n  const q"))
  .replace("${Number(opts.ops)}", "12").replace("${Number(opts.dexes)}", "5").replace("${Number(opts.stocks)}", "14");
const sels = [...src.matchAll(/q<[^(]*?>\(`([\s\S]*?)`\)/g)].map((m) => m[1]);
const pool = new Pool({ connectionString: "postgres://local@localhost:5433/local", max: 1 });
const out = [];
for (const s of sels) out.push((await pool.query(`${base} ${s}`)).rows);
const [days, ops, dexes, stocks, wallets, opDex, dexStock] = out;
const data = { days: days.map((d) => d.day), ops, dexes, stocks, wallets, opDex, dexStock };
fs.writeFileSync(process.argv[2], JSON.stringify(data));
console.log({ days: data.days.length, ops: ops.length, dexes: dexes.length, stocks: stocks.length, wallets: wallets.length, opDex: opDex.length, dexStock: dexStock.length });
await pool.end();
})();
