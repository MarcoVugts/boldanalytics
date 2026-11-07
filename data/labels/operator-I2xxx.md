# The "I2xxx" contracts (checked 2026-11-07, on-chain via Base RPC)

On 2026-11-05 four contracts with I2xxx-style names were `tx_to` for ~68% of tokenized-stock DEX volume.

| Contract | Dune name | Share of volume (5 Nov) | Txs | Senders | Notes |
|---|---|---|---|---|---|
| 0x83d55acdc72027ed339d267eebaf9a41e47490d5 | I2604Ctrl | 51.5% | 46,567 | 108 | private trading engine, see below |
| 0x278d858f05b94576c1e6f73285886876ff6ef8d2 | I2451B | 10.8% | 69,093 | 46 | not a proxy; link to the same owner not proven |
| 0x08fb33543ad633db94282df364ad80feb8d9fc35 | I2451D | 5.6% | 4,163 | 99 | reverts with short code "I"; link not proven |
| 0x61040e143a77f165ba44543af4a079f2c809d14b | a`b (I2451bt) | 0.1% | 113 | 3 | EIP-1967 proxy -> impl 0x8077dc1b6b289f77e7de52381be2c7c17be9563f |

## 0x83d5 (I2604Ctrl), from its bytecode
- Solidity 0.8.24; whitelisted callers only, pausable; swap callbacks for Uniswap v3/v4 (PoolManager 0x498581ff718922c3f8e6a244956af099b2652b2b), Aerodrome, others.
- Immutables:
  - 0x8ad1f3a165479a54a267d9a85be79f95a7dd51a0: owner/admin; **Gnosis Safe, 4-of-10**
  - 0x7ff4ed8ab94c849b812622eb462682208be06b93: role manager (AccessControl) with timelocks (1 day)
  - 0x51c72848c68a965f66fa7a88855f9f7784502a7f: inventory/vault; itself a trading contract (same owner and role manager), EIP-1271 signer, pays block.coinbase
  - 0x52aa899454998be5b000ad077a46bbe360f4e497: upgradeable proxy (admin + per-selector implementations), receives tokens
- Safe signers: 0xffaa5c7adb11fb55382a01541443762d684bd52e, 0xf02481155d9a1ed3859c8d3a1a42629cdedb962a, 0xa88718878384700060fda6f128fd36a9ef3cbc06, 0xa430575acbe77e699249cf73006c2791ce29245d, 0x585a8ac375433e9771a1514c2a19daddefd5aa89, 0x901cc29cb649e0b50d11b04d14afcb5678b55794, 0x0560de031ead6c4f4364627cb0b2d748044d4232, 0x412766e914837920ac030752ab64d96fa4433617, 0xa0a848a047960fdf6a074a685988e01f4dd4ccfe, 0x1dfc9c18b903c267df97e19fb2e1b48b6ad25b36

## Interpretation (not confirmed)
Institutional-grade market-making / arbitrage setup (multisig owner, timelocked roles, vault, builder payments).
The identity of the operator is unknown. Do not name a firm in public content without confirmation.
