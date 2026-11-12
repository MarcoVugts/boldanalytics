# Unlabeled contracts, check of 2026-11-12

Input: `/ops` export "Unlabeled contracts (top 25 by wallets)". Together these were ~45% of unlabeled wallets but only
~15% of unlabeled volume ($226M of $1.54B); the volume sits in contracts with few wallets (next: top 25 by volume).

Sources: Sourcify (verified source, chain 8453), Dune (`base.contracts`, `labels.addresses`, `base.creation_traces`;
one query, 5.1 credits), Basescan (no public name tags on any of them). Blockscout and the OLI parquet were not
reachable (bot check / access denied).

| tx_to | wallets | label | confidence | evidence |
|---|---|---|---|---|
| 0xccc88a9d…, 0xb92fe925…, 0x5567954c…, 0x0729e2a4… | 4,735 · 3,586 · 2,312 · 1,853 | Relay | confirmed | Sourcify RelayApprovalProxyV3 / RelayRouterV3 / RelayApprovalProxy / RelayRouter; Dune relay.RelayRouterV3 |
| 0xd6145b2d… | 2,289 | Uniswap | confirmed | UniversalRouter, same deployer as labeled Uniswap UR 0x6ff5693b |
| 0xfdf682f5… | 1,884 | Uniswap | confirmed | Dune uniswap.UniversalRouter |
| 0xc8f6b8ba… | 1,785 | OKX DEX | confirmed | Dune okx_dex.DexRouter |
| 0x89c6340b… | 3,206 | LI.FI | attributed | Sourcify src/Periphery/Permit2Proxy.sol (LI.FI layout) |
| 0x698cb2b6… | 5,997 | Aerodrome | suspected | Slipstream-style SwapRouter, Aerodrome only; unknown deployer |
| 0xbce80645…, 0x80656aa3…, 0xd0a40c65…, 0x9177309c…, 0x22380f85…, 0xf849e0d4… | 5,570 · 1,581 · 1,196 · 862 · 821 · 747 | Unknown app A | suspected | all created by 0x0bc6e9f2714e…edcd8, each active a few weeks (since May 2026), unverified |

Left unlabeled: 0xd8ba9d1a… (9,729 wallets; upgradeable proxy since 2024-06, implementation unverified),
0xcaf22ce3… (UniversalRouter copy, unknown deployer, top sender 40%), and eight small unverified contracts.
