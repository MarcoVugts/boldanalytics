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
  // 2026-11-12: top unlabeled contracts by wallets (/ops export). Sources: Sourcify verified source, Dune base.contracts /
  // labels.addresses / creation_traces, Basescan creator. See data/labels/unlabeled-2026-11-12.md.
  ...Object.fromEntries([
    "0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f", "0xccc88a9d1b4ed6b0eaba998850414b24f1c315be",
    "0x5567954cd026cebfe486062cb75848e0f1c12e58", "0x0729e2a4716d9f7dd17858d5d504426d228697f7",
  ].map((a) => [a, { label: "Relay", kind: "aggregator", confidence: "confirmed",
    note: "Sourcify: RelayRouter(V3) / RelayApprovalProxy(V3); Dune: relay.RelayRouterV3 (labels: Relay); CREATE2 deployer" }])),
  "0xd6145b2d3f379919e8cdeda7b97e37c4b2ca9c40": { label: "Uniswap", kind: "dex_router", confidence: "confirmed",
    note: "Sourcify: UniversalRouter; same deployer 0x2179a608 as labeled Uniswap UniversalRouter 0x6ff5693b" },
  "0xfdf682f51fe81aa4898f0ae2163d8a55c127fbc7": { label: "Uniswap", kind: "dex_router", confidence: "confirmed",
    note: "Dune: uniswap.UniversalRouter (labels: Uniswap: UniversalRouter)" },
  "0xc8f6b8ba0dc0f175b568b99440b0867f69a29265": { label: "OKX DEX", kind: "aggregator", confidence: "confirmed",
    note: "Dune: okx_dex.DexRouter; Sourcify: contracts/8/DexRouter.sol" },
  "0x89c6340b1a1f4b25d36cd8b063d49045caf3f818": { label: "LI.FI", kind: "aggregator", confidence: "attributed",
    note: "Sourcify: src/Periphery/Permit2Proxy.sol (LI.FI contracts layout); no Dune/Basescan name" },
  "0x698cb2b6dd822994581fea6ea4fc755d1363a92f": { label: "Aerodrome", kind: "dex_router", confidence: "suspected",
    note: "Sourcify: contracts/periphery/SwapRouter.sol (Slipstream layout), Aerodrome-only; deployer 0x2bbfa3f3 differs from known Aerodrome deployers" },
  // One deployer (0x0bc6e9f2714ef2f3d586e5167dc282119a0edcd8) rolls out a new unverified router every few weeks since May
  // 2026; each has thousands of wallets with small trades. Identity unknown.
  ...Object.fromEntries([
    "0xd0a40c6526acdebd4f6d87931098ff37a9f8e4bf", "0xbce80645b0e9b0ab52648b0d23f37db56616ea93",
    "0x22380f853f01059cc3775a83f66fadd43d435e67", "0x9177309cf7b963378943c680f4557b520683653b",
    "0x80656aa3142a935c25f730ea82de114ef4a57479", "0xf849e0d4a7a1d74cb278361ff29967dfb5a22c67",
  ].map((a) => [a, { label: "Unknown app A", kind: "app", confidence: "suspected",
    note: "rotating router, deployer 0x0bc6e9f2 (Dune creation_traces/Basescan); unverified; many wallets, small trades" }])),
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
