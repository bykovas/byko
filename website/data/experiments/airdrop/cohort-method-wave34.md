# Cohort — how these 454 wallets were chosen

Taken 2026-08-18T19:53:22.452Z. Blocks 49789928..50146727 on Base (~2160h back from the tip),
170423 USDC transfers into 11 known DEX venues were read straight from the chain.

Every filter is a chain read — no indexer, no label service, nothing that can change its answer later:

| step | wallets left | note |
| --- | ---: | --- |
| unique buyers in window spending >= $227 | 2105 |  |
| not a project wallet | 2105 |  |
| a person's wallet (EOA or EIP-7702) | 1562 | 1140 of them delegated; 543 contracts dropped |
| nonce >= 5 and holds ETH | 1069 |  |
| holds no BYKO yet | 784 |  |
| first 700 by most recent buy | 700 |  |

A wallet qualifies if it spent at least $227 of USDC at a DEX in the window,
is an ordinary EOA, has at least 5 transactions and some ETH, and holds no
BYKO. The list is sorted by the most recent qualifying purchase and cut to size.

The $227 threshold is about what counts as a purchase, not about bots.
Wave 1 had no threshold and let in trades as small as $0.000011 — dust through
a bridge. Transaction-rate profiling of wave 1 found the share of automated
wallets to be the same above and below every threshold, so this filter buys
honesty in the word "buyer", nothing more.

Nobody in this list asked for anything.

Of the 700 wallets that qualified, the 454 most recent were taken: the airdrop
wallet holds 103,062 BYKO, which is 454 x 227 and no more. The remaining 246
qualified and were not paid; they are listed in cohort-wave34b.json.

This cohort was rebuilt after wave 2 had landed. The first attempt was built
while wave 2 was being sent, so its 'holds no BYKO' filter read balances that
were seconds from changing and 119 of its addresses had just been paid. It was
rejected before any transfer. Nobody in this list has received BYKO before.
