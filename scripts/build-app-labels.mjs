// Build sql/md/seed/app_labels.sql from the tx_to label check(s) in data/labels/*.csv
// plus the manual overrides below. Re-run after adding a new label CSV:
//   node scripts/build-app-labels.mjs
// The seed is applied on every build (scripts/migrate.mjs), so edits here ship with a deploy.
import { readdir, readFile, writeFile } from "node:fs/promises";

// Manual labels win over everything. confidence: confirmed | attributed | suspected
const MANUAL = {
  "0x83d55acdc72027ed339d267eebaf9a41e47490d5": { label: "Wintermute", kind: "market_maker", confidence: "attributed",
    note: "I2604Ctrl; owner Safe 0x8ad1 also owns vault 0x51c7 (Arkham, Etherscan tag/Dune list, OLI: Wintermute); deployer funded via the Safe's creator" },
  "0x51c72848c68a965f66fa7a88855f9f7784502a7f": { label: "Wintermute", kind: "market_maker", confidence: "attributed",
    note: "Arkham: Wintermute; public posts list it as Wintermute EVM address" },
  // I2451* were "suspected Wintermute" by naming only. On-chain checks (2026-11-07) point away:
  // different owners, no shared multisig signers, different compiler/proxy patterns.
  // Identity unknown; "market maker" from behaviour (2026-11-08, 84 days): inventory-neutral per stock and per day,
  // one swap per tx, bot fleet of own senders. Same pattern as Wintermute. See data/labels/operator-I2xxx.md.
  "0x278d858f05b94576c1e6f73285886876ff6ef8d2": { label: "Unknown market maker A", kind: "market_maker", confidence: "suspected",
    note: "I2451B; proxy owned by Safe 0xe2963654 (2-of-4), no signer overlap with Wintermute Safe 0x8ad1; net 0.0% per stock over 84 days" },
  "0x08fb33543ad633db94282df364ad80feb8d9fc35": { label: "Unknown market maker B", kind: "market_maker", confidence: "suspected",
    note: "I2451D; admin is EOA 0x00ff842be7e390605e7e3664ebfa0e432806500d; net 0.3% per stock, active since mid-Oct" },
  "0x61040e143a77f165ba44543af4a079f2c809d14b": { label: "Unlabeled bot", kind: "bot", confidence: "suspected",
    note: "I2451bt; EIP-1967 proxy -> 0x8077dc1b, admin slot empty" },
};

// Dune contract namespace -> [label, kind]
const NAMESPACE = {
  aero: ["Aerodrome", "dex_router"], aerodrome: ["Aerodrome", "dex_router"],
  uniswap: ["Uniswap", "dex_router"], pancakeswap_hub: ["PancakeSwap", "aggregator"],
  kyber: ["KyberSwap", "aggregator"], zeroex: ["0x", "aggregator"], oneinch: ["1inch", "aggregator"],
  okx: ["OKX DEX", "aggregator"], okx_intent_swap_v1: ["OKX DEX", "aggregator"],
  paraswap: ["Velora (ParaSwap)", "aggregator"], paraswapdelta: ["Velora (ParaSwap)", "aggregator"],
  gnosis_protocol_v2: ["CoW Protocol", "aggregator"], cow_protocol: ["CoW Protocol", "aggregator"],
  openocean_v2: ["OpenOcean", "aggregator"], lifi: ["LI.FI", "aggregator"], rango_exchange: ["Rango", "aggregator"],
  bwaggregator: ["Bitget Wallet", "aggregator"], fly_trade: ["Fly", "aggregator"], krystal: ["Krystal", "aggregator"],
  sushiswap: ["Sushi", "aggregator"], liquidmesh: ["LiquidMesh", "aggregator"], fynd: ["Fynd", "aggregator"],
  wallet_api: ["Wallet API", "aggregator"], metamask: ["MetaMask Swaps", "aggregator"],
  erc4337: ["Smart wallets (ERC-4337)", "smart_wallet"], monsta_vault: ["Safe multisig", "multisig"],
  debridge: ["deBridge", "bridge"], mayan: ["Mayan", "bridge"], across_v2: ["Across", "bridge"], decent_mp: ["Decent", "bridge"],
  beefy: ["Beefy", "defi_protocol"], pendle: ["Pendle", "defi_protocol"], arcadia_v2: ["Arcadia", "defi_protocol"],
  stockify: ["Stockify", "defi_protocol"], base1: ["Multicall", "other"],
};

// dex_aggregator.trades project -> label
const AGGREGATOR = {
  sushiswap: "Sushi", "0x API": "0x", kyberswap: "KyberSwap", cow_protocol: "CoW Protocol",
  velora: "Velora (ParaSwap)", "1inch-LOP": "1inch", openocean: "OpenOcean",
};

const parseCsv = (text) => {
  const [head, ...lines] = text.trim().split("\n");
  const cols = head.split(",");
  return lines.map((line) => {
    const out = [];
    let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c;
    }
    out.push(cur);
    return Object.fromEntries(cols.map((k, i) => [k, out[i] ?? ""]));
  });
};

const dir = new URL("../data/labels/", import.meta.url);
const labels = new Map();
for (const f of (await readdir(dir)).filter((f) => f.startsWith("tx_to_") && f.endsWith(".csv")).sort()) {
  for (const r of parseCsv(await readFile(new URL(f, dir), "utf8"))) {
    const addr = r.tx_to.toLowerCase();
    let entry = null;
    const ns = NAMESPACE[r.contract_namespace];
    if (ns) entry = { label: ns[0], kind: ns[1], confidence: "confirmed", note: `${r.contract_namespace}.${r.contract_name}` };
    else if (AGGREGATOR[r.aggregator]) entry = { label: AGGREGATOR[r.aggregator], kind: "aggregator", confidence: "confirmed", note: `dex_aggregator: ${r.aggregator}` };
    else if (Number(r.senders) <= 3 && Number(r.txs) >= 50)
      entry = { label: "Unlabeled bot", kind: "bot", confidence: "suspected", note: `${r.txs} txs from ${r.senders} sender(s) on ${f.slice(6, 16)}` };
    if (entry) labels.set(addr, { ...entry, source: `seed:${f}` });
  }
}
for (const [addr, m] of Object.entries(MANUAL)) labels.set(addr, { ...m, source: "seed:manual" });

const esc = (s) => String(s).replace(/'/g, "''");
const values = [...labels]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([a, l]) => `  ('${a}', '${esc(l.label)}', '${l.kind}', '${l.confidence}', '${esc(l.source)}', '${esc(l.note)}')`);

const sql = `-- GENERATED by scripts/build-app-labels.mjs. Do not edit by hand; edit the script and re-run.
-- Applied to MotherDuck on every build (idempotent). Rows with source 'seed:%' are replaced; other rows are kept.
DELETE FROM app_labels WHERE source LIKE 'seed:%';
INSERT INTO app_labels (tx_to, label, kind, confidence, source, note) VALUES
${values.join(",\n")}
ON CONFLICT (tx_to) DO NOTHING;
`;
await writeFile(new URL("../sql/md/seed/app_labels.sql", import.meta.url), sql);
const byKind = {};
for (const l of labels.values()) byKind[l.kind] = (byKind[l.kind] ?? 0) + 1;
console.log(`wrote ${labels.size} labels`, byKind);
