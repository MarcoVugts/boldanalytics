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
  - 0x52aa899454998be5b000ad077a46bbe360f4e497: **Fluid: Liquidity** (Fluid protocol liquidity layer, per Etherscan name tag); a trading/lending venue, not the operator's own address
- Safe signers: 0xffaa5c7adb11fb55382a01541443762d684bd52e, 0xf02481155d9a1ed3859c8d3a1a42629cdedb962a, 0xa88718878384700060fda6f128fd36a9ef3cbc06, 0xa430575acbe77e699249cf73006c2791ce29245d, 0x585a8ac375433e9771a1514c2a19daddefd5aa89, 0x901cc29cb649e0b50d11b04d14afcb5678b55794, 0x0560de031ead6c4f4364627cb0b2d748044d4232, 0x412766e914837920ac030752ab64d96fa4433617, 0xa0a848a047960fdf6a074a685988e01f4dd4ccfe, 0x1dfc9c18b903c267df97e19fb2e1b48b6ad25b36

## Attribution (web search, 2026-11-07)
- 0x51c72848c68a965f66fa7a88855f9f7784502a7f (the vault, same owner Safe and role manager as I2604Ctrl) is
  labeled **Wintermute** on Arkham Intel (deployer also listed as Wintermute), and is listed as a Wintermute EVM
  address in public posts (Odaily, @belizardd on X). Multichain balance ~$107-110M in 2026 snapshots.
- Chain of evidence: I2604Ctrl -> uses 0x51c7 as inventory -> both owned by Safe 0x8ad1 (4-of-10) -> 0x51c7 attributed to Wintermute.
- Context: Wintermute registered a US broker-dealer in 2026 and said it targets tokenized stocks (Cointelegraph, Aug 2026).
- Not verified first-hand (explorers blocked from the dev container). The I2451* contracts are not linked yet.

## How to say it publicly
"Contracts controlled by the same multisig as a wallet Arkham attributes to Wintermute" or
"attributed to Wintermute (Arkham)". Avoid stating it as fact; consider asking Wintermute for comment.

## Update 2026-11-07: the I2451* contracts are probably NOT Wintermute
| Contract | Owner / admin | Overlap with Wintermute Safe 0x8ad1 (10 signers) |
|---|---|---|
| I2451B 0x278d... | custom proxy, "Not proxy owner" -> Safe 0xe2963654c2d243c52ebc6998b5a40eb5d2cd5658, **2-of-4**: 0xca1b37bc..., 0x610e61b9..., 0xa74fd355..., 0x6e1110d6... | none |
| I2451D 0x08fb... | immutable admin 0x00ff842be7e390605e7e3664ebfa0e432806500d (EOA, no code) | n/a |
| a`b 0x6104... | EIP-1967 proxy -> impl 0x8077dc1b...; admin slot empty | unknown |

Also different builds: I2604Ctrl solc 0.8.24 with "AR.." error codes; I2451B proxy and I2451D solc 0.8.28 with
single-character errors. The I2xxx names are Dune metadata and are not evidence of a common operator.
Web: 0x00ff842b... appears as a deployer in a chainswarm/chain-insights GitHub issue (Aero pool flows), no identity.
Relabelled: I2451B = "Unknown market maker A", I2451D = "Unknown market maker B", a`b = "Unlabeled bot".
