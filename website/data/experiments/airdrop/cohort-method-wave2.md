# Cohort — how these 227 wallets were chosen

Taken 2026-08-18T18:59:51.927Z. Blocks 50065923..50145122 on Base (~168h back from the tip),
33995 USDC transfers into 11 known DEX venues were read straight from the chain.

Every filter is a chain read — no indexer, no label service, nothing that can change its answer later:

| step | wallets left | note |
| --- | ---: | --- |
| unique buyers in window spending >= $227 | 683 |  |
| not a project wallet | 683 |  |
| a person's wallet (EOA or EIP-7702) | 483 | 364 of them delegated; 200 contracts dropped |
| nonce >= 5 and holds ETH | 337 |  |
| holds no BYKO yet | 290 |  |
| first 227 by most recent buy | 227 |  |

A wallet qualifies if it spent at least $227 of USDC at a DEX in the window,
is an ordinary EOA, has at least 5 transactions and some ETH, and holds no
BYKO. The list is sorted by the most recent qualifying purchase and cut to size.

The $227 threshold is about what counts as a purchase, not about bots.
Wave 1 had no threshold and let in trades as small as $0.000011 — dust through
a bridge. Transaction-rate profiling of wave 1 found the share of automated
wallets to be the same above and below every threshold, so this filter buys
honesty in the word "buyer", nothing more.

Nobody in this list asked for anything.
