## One recommendation is impossible, the other is wash trading — 19 August 2026

I asked Blockaid to look at BYKO again, and they answered properly: no form letter, no silence. They confirmed the remaining signal is not a malice flag — it is a market-condition heuristic, the spam and unstable-price pattern that fires when a token's trading environment is extremely thin. Then they told me how to clear it. Their words, published here in full and unedited:

- "Deepen liquidity in the primary trading pool, so the market is no longer thinly capitalized."
- "Sustain two-sided trading, so price is not dominated by tiny trades."
- "After liquidity and trading conditions improve, request a fresh rescan — this signal typically clears once the pool is no longer at illiquid levels."

Before anything else: this is the most useful reply this project has received from anyone. It names the mechanism instead of hiding behind a template, and it offers a rescan. Nothing below is a complaint about Blockaid. It is what happens when you take good advice seriously and do the arithmetic.

**The first recommendation cannot be followed.** Not "is hard" — cannot. The pool holds 466,468 BYKO against $117.46, which is what makes the price $0.000252 and the whole pool worth $235. To lift it to a $2,000 pool I would have to add 3.5 million BYKO. The entire supply, forever, is 790,227. To reach $20,000 — still small by any listing standard — I would need about fifty times every token that will ever exist. No amount of my own money fixes this, because the binding constraint is not money. The token's entire float is worth $198.

**That leaves the second.** Sustain two-sided trading. Except nobody trades this token. In seventeen days the pool has seen 38 swaps, and nearly every one was me buying my own token with my own wallets — a fact I got wrong in public yesterday and corrected this morning. There is no second party to sustain trading with.

Write those two sentences next to each other and the conclusion is unavoidable. The only recommendation this token can act on is: have my own wallets buy and sell from each other, on a schedule, until the classifier is satisfied.

That has a name, and I am going to use it. **This is wash trading** — trading with yourself to manufacture the appearance of a market. On regulated venues it is illegal, and for good reason. Here there is no exchange, no order book, no counterparty being deceived about who stands on the other side, and I am publishing the instruction that prompted it, the schedule, and every single trade. None of that makes it something else. It makes it wash trading, disclosed.

So I am going to run it, in the open, as an instrument rather than a performance.

**What runs.** A worker trades between two wallets that are already in the public register on this site — no new addresses, because a sybil layer on top of wash trading would make the measurement worthless. Every cycle is a matched round trip: buy a quantity, then sell the same quantity back. That is deliberate. A random walk of buys and sells would wander the price and manufacture exactly the instability the flag is about; a matched round trip returns the price to where it started and leaves behind what was actually asked for — trade count, two-sided volume, and a flat chart.

**Trade size, corrected.** My first instinct was 27 to 790 BYKO per trade. That is $0.007 to $0.20, between four and a hundred times smaller than the real trades this pool has already seen. Blockaid's own complaint is that the price is dominated by tiny trades, so that worker would have produced a machine for generating the exact pattern being flagged. Sizes are set against the pool instead: each trade moves a visible fraction of it, and the ceiling is whatever keeps a round trip's price impact reversible.

**Every trade is published.** Not "a worker is running" — a live list, in the repository, updated as it goes: timestamp, side, quantity, price before, price after, transaction hash, and the running cost. Anyone can compare what the classifier sees with what actually happened, because both are on the same page.

**The stop condition is fixed now, before the first trade**, so it cannot be adjusted to flatter the result. The worker stops when Blockaid clears the signal on a rescan, or after fourteen days if it does not. Cost is a few dollars of gas — about 30 trades a day at roughly a cent each — and no capital is at risk, because every round trip returns the tokens to where they started.

**And the result is defined now too, in both directions.** If the flag clears, then a token that changed nothing about itself — same immutable contract, same burned liquidity, same fixed supply, same 916 holders — became "clean" by simulating a market it does not have. That is the finding, and it is not a happy one. If the flag does not clear, then the recommendation was unfollowable in both halves, and a harmless token has no route out at all.

I do not know which it will be. That is the only honest reason to run it.

---
**Teaser:** A security team told me exactly how to clear my token's last flag. One instruction needs fifty times my entire supply. The other, for a token nobody trades, means buying from myself — so I am going to do that in public, and publish every trade.
**X:** A security team told me how to clear my token's last flag: deepen liquidity, sustain two-sided trading. The first needs 50x my supply. The second, for a token nobody trades, means buying from myself. So I will, in public, publishing every trade.
