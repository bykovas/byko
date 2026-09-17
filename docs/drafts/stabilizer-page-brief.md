# Stabilizer page — design brief

For the designer. You will take the code from this repository; the page is
vanilla HTML/CSS/JS like every other page here, and the engineer who wires
it to live data will work from your mock, so make it in the repo's idiom.
Decisions in this brief are final unless marked "your call".

## What the page is

`/stabilizer` — a public readout of a new, disclosed policy on the BYKO/USDC
pool. One founder wallet (BYKO LP Pumper, `0x9c86…3206`, listed in the
register on the home page) watches the pool every 10 minutes. It has a
**reference price**: the price the project's own worker left the pool at
after its last trade. If the live pool price differs from that reference by
more than **5%**, the move was made by somebody else — the worker's own
trades are known by transaction hash, so the attribution is exact — and the
wallet trades back **75%** of the move. Then its own trade becomes the new
reference. It never holds a level: 25% of every outside move stays. It sells
BYKO into outside buying and buys BYKO into outside selling, so it earns the
spread, and the page says so.

The reader is sceptical and technical; they will compare the page with
BaseScan. Every figure must be one they can recompute.

Sibling pages, same skeleton: `website/self-trading.html` and
`website/self-trading-luko.html` (head, lede of two sentences, rules strip,
one card, a table, a log, a note). Read them first; then
`website/market.html` and `website/market.js` for the reserve scale you are
asked to reuse.

## The infographic (the main ask)

The owner wants the pool-reserve scale from `/market` on this page — "genesis,
the current target ratio, and the current fact" — as one figure. Today the
scale (`.pool-viz` / `.pool-bar` / `.pool-ticks` in `market.html`,
`poolEdge()` in `market.js`) shows:

- a log axis, one tick = one halving of a reserve, genesis pinned at the
  centre (740,227 BYKO : 74.0227 USDC = 100% / 100%);
- left half BYKO, right half USDC, each as % of its genesis level; the two
  shares are reciprocal, so the pool's state is ONE edge (`--split`);
- the solid edge = where the pool stands now.

On this page the same axis must carry three things, and the reader must tell
them apart at a glance:

1. **Genesis** — the dashed centre, as on `/market`.
2. **Reference** — where the worker left the pool (its last own trade). This is
   the "target ratio". Around it a **±5% band**: the zone where the stabilizer
   does nothing. On this axis 5% of price is a small distance (price moves as
   the square of the reserve ratio; a 5% price move is ~2.5% of one reserve,
   ~0.035 of a halving), so the band is narrow — design for that. Do not fake
   its width.
3. **Fact** — the live pool edge, blue (it is a chain read). When it sits
   inside the band: quiet. Outside: the page must show the direction, the size
   of the deviation, and **where the stabilizer intends to land** (75% of the
   way back to the reference), plus what that costs in BYKO or USDC.

States to design, each with its own copy line:

| state | example line |
| --- | --- |
| inside the band | `inside the band · +1.8% from the reference · nothing to do` |
| above, waiting | `+13.9% above · next check in 4 min · will sell ~8,200 BYKO ($15) to land at +3.5%` |
| below, waiting | `−11.2% below · will buy ~$12 of BYKO to land at −2.8%` |
| above/below, cannot | `−11.2% below · wallet holds $0 USDC · cannot act · logged` |
| just acted | `sold 8,170 BYKO for $14.87 · tx 0x… · reference moved to $0.001653` |
| no data | the worker has not traded yet / the readout is unreachable — say which |

The scale must also work when the fact is off-scale (see `data-off-scale` in
`market.js`) and on a 375px phone (the existing scale already does; keep it).

Your call: whether the band is a shaded strip on the bar, a bracket under it,
or a second thin rail; whether the "intended landing" is a ghost edge or a
tick with a label. Whatever you choose must stay readable when reference,
landing and fact are within a few pixels of each other, which will be the
normal case.

Optional, your call: a small history — the last N checks as a strip (one
glyph per check, like the classifier grid's `·`/`▲`), so the reader sees "it
checked 144 times today and acted once".

## The rest of the page

- **Head:** kicker `Disclosed policy · stabilizer`, h1 `Stabilizer`, Refresh
  button, meta line `read … UTC` (as on the sibling pages).
- **Lede:** two sentences, no more. Draft: "One founder wallet watches the
  BYKO pool every ten minutes. When the price moves more than 5% away from
  where this project's own worker last left it — a move that, by construction,
  somebody else made — the wallet trades back three quarters of it, and its
  own trade becomes the new reference." Then one short sentence stating the
  uncomfortable part: "It sells into outside buying and buys into outside
  selling, so it earns the spread; every decision is logged below."
- **Rules strip** (mono values, like the sibling pages' `.rules`): `threshold
  5%` · `damping 75%` · `check every 10 min` · `reference last own trade` ·
  `budget the wallet's balances` · `slippage 3%` · `commit …`.
- **State card** (one card, like `.arm`): reference price, live price,
  deviation, status, wallet BYKO / USDC / ETH (the budget), last action.
  Blue only on the chain reads (live price, balances).
- **Decisions table:** newest first: UTC · deviation · decision (`none` /
  `sell` / `buy` / `cannot`) · size · landed at · tx. Only checks with a
  deviation above 1% and every action are logged, plus one line per day, so
  the table is not 144 identical rows.
- **Note** at the bottom (the disclaimer register of the sibling pages).

## Home page card

In "What is live right now" (`website/index.html`, `.cards3 .run`) a fourth
card: `since … 2026` · `Stabilizer — the issuer takes the other side` · two
sentences · exits: `What it does →` (this page) and `Every decision →`
(the table anchor). Four cards must still fit; check the grid at 1120px and
on a phone.

## Rules of the system (do not break)

- Design tokens and components: `website/assets/byko.css` and
  `brand/brand-guide.md`. Values come from the handoff; do not invent tokens.
- Blue marks a value read from the chain live and nothing else.
- No opacity for text, no shadows, no radius outside controls.
- Mono is for data only — never labels, nav or kickers.
- No green/red for price direction. Sides use the existing `.side.buy` /
  `.side.sell` colours from the self-trading pages.
- No word that promises a price: not "guaranteed", "protected", "pegged",
  "floor". The page describes a rule and shows a log.
- One inline `<style>` block per page, no frameworks, no build step.

## Numbers for the mock (17 Sep 2026)

- Pool: 292.5 USDC : 187,328 BYKO · price $0.0015614 · 25% / 400% of genesis.
- Reference (worker's last trade): $0.0015614 (equal to live when quiet).
- Outside $20 buy: price → $0.001780 (+13.9%); landing at +3.5% =
  $0.001616; stabilizer sells ~8,200 BYKO (~$15).
- Wallet: 350,000 BYKO · 0 USDC · 0.0020 ETH (it can only sell until it has
  earned USDC — design the "cannot buy" state).
- 5% of price ≈ $7 of net outside flow at this depth; 10% ≈ $15.

## Deliverable

An HTML mock in the repo's idiom (`website/stabilizer.html` with its inline
style, static numbers from the list above, every state reachable by toggling
a class or a data attribute), plus the home card. The engineer will replace
the static numbers with the worker's readout.
