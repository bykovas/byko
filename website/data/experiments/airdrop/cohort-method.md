# Cohort — how these 227 wallets were chosen

Taken 2026-08-18T17:43:42.509Z. Blocks 50136438..50142837 on Base (~24h back from the tip),
3801 USDC transfers into 11 known DEX venues were read straight from the chain.

Every filter is a chain read — no indexer, no label service, nothing that can change its answer later:

| step | wallets left | note |
| --- | ---: | --- |
| unique buyers in window | 712 |  |
| not a project wallet | 712 |  |
| a person's wallet (EOA or EIP-7702) | 453 | 357 of them delegated; 259 contracts dropped |
| nonce >= 5 and holds ETH | 284 |  |
| holds no BYKO yet | 284 |  |
| first 227 by most recent buy | 227 |  |

A wallet qualifies if it spent USDC at a DEX in the window, is an ordinary EOA,
has at least 5 transactions and some ETH, and holds no BYKO. The list is
sorted by the most recent qualifying purchase and cut to size.

Nobody in this list asked for anything.
