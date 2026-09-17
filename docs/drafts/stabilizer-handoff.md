# Stabilizer — the one file for the engineer

Everything needed to build the BYKO stabilizer is here. Two other files
exist and are NOT instructions: `docs/drafts/stabilizer-mock.html` is the
designer's static mock (approved; you wire it, you do not redesign it) and
`docs/drafts/stabilizer-panel-verdict.md` is background arithmetic from a
review panel whose "do not build it" recommendation the owner overruled.

Decisions are the owner's (17 Sep 2026) and are final unless marked "owner
decides". Reply to the owner in Russian; commit to `main`; never force-push.

## 1. What it is

One founder wallet — **BYKO LP Pumper** `0x9c8665dd47eba6e23c47fa2577fe3ad953563206`,
already in `website/data/founder-wallets.json` — watches the BYKO/USDC pool
`0x02dd4285ad38ea93d021ca854016a839b0b2a6ca` every 10 minutes and trades back
75% of any price move that **somebody else** made, once that move exceeds 5%
from a reference. Its own trade becomes the new reference. It never holds a
level (25% of every outside move stays), it sells BYKO into outside buying
and buys BYKO into outside selling, so it earns the spread, and every check
and decision is public. Name: **Stabilizer**. Page: `/stabilizer`. Fourth card
in "What is live right now" on the home page.

## 2. The rule, precisely

State: a reference price `ref`, the reason it was set, and the last pool
block processed.

Classification of every Swap in the BYKO pool, in block order:

| class | test |
| --- | --- |
| `self` | the swap's `tx_hash` is a row in `trades` (arm `byko` or arm `stabilizer`) — exact, no register needed |
| `founder` | not self, and `tx.from` (or the Swap's `to`) is an address in `founder-wallets.json` (fetch it as `tally.js` does; refuse to classify, log `unclassified`, if the register cannot be fetched) |
| `outside` | everything else. Founder wallets the worker does NOT run count as `founder`, not outside — the owner's personal wallet included |

How `ref` moves, per swap:

- `self` (arm `byko` trade): `ref ← ref × price_after / price_before` of that
  trade — the arm's own impact carries the reference with it, so the
  self-trading arm never creates a deviation and never hides one. (Both
  prices are already in the `trades` row.)
- `self` (stabilizer's own trade): `ref ← price after the trade` (reset).
- `founder` swap, any size: `ref ← price after the swap` (reset, reason
  `founder`). The founder cannot use the stabilizer against himself and can
  move the reference at will; both facts are printed.
- `outside` swap of **≥ $100 USDC** (buy OR sell, measured on the USDC leg):
  `ref ← price after the swap` (reset, reason `large-outside`). Big trades set
  the price; the stabilizer only resists moves made by trades under $100.
- `outside` swap under $100: `ref` unchanged.

After the swaps are folded in, read the live reserves:
`dev = live_price / ref − 1`. If `|dev| ≤ 5%` → nothing (log if `|dev| > 1%`).
If `|dev| > 5%` → target `= ref × (1 + 0.25 × dev)`; compute the input that
moves the pool to the target (constant product with the 0.3% fee, the same
arithmetic as the router and as `sizeTo()` in the mock); side: sell BYKO if
`dev > 0`, buy BYKO if `dev < 0`; cap by the wallet's balance (leave the gas
floor; USDC side is zero until earned); `amountOutMin` at 3% slippage;
write the `trades` row with `tx_hash` BEFORE broadcast (arm `stabilizer`);
if the wallet cannot fund the side → log `cannot`, deviation stands.

Bootstrap: `ref` is unset until the first classified swap after go-live; set
it to the pool price at go-live and log `reference_set · bootstrap`.
Never guess: an RPC refusal is an `events` row, and the tick does nothing.

Cadence: every worker cron tick (10 min); latency printed on the page.
Limits: none but the wallet's balances (owner's decision).

## 3. Amendments (`market/rules.json` `note`, in the file's voice; hash gate)

Count the existing amendments in the file first (the tenth was applied and
reverted on 29 Aug; its number is burnt — verify in the file and the diary).

**A. Arm amplitude** (the self-trading arm, so the chart is calm enough for
the stabilizer to be legible). Fault: the arm alone prints 12–27% daily
ranges (287 confirmed trades 8–17 Sep; per-trade max 9.7%, streak max
20.1%); the cash corridor [1.5, 40] plus the `drawRunTarget()` fallback
permits $59 of one-way flow, +44% / −36% at $296. Change:
`run_floor_usdc` [1.5, 8] → [6, 8]; `run_ceiling_usdc` [20, 40] → [11, 13];
`max_trade_pct_pool` 2.5 → 1.0; in `market/src/do/arm-lock.ts`
`drawRunTarget()` both `uniform(1, 5)` fallbacks → fixed 0.5. Consequences to
state: ≤ 2% per trade; typical daily range 5–6%, worst ≈ 10%; gross flow
≈ $42/day instead of ≈ $80, mean trade ≈ $1.16 (more "tiny trades" in
Blockaid's words; the 13th amendment's dead-chart worry comes closer); the
strategy block is shared so the three LUKO arms take the same numbers and
each buys its excess cash into the LUKO pool on day one (~+25% on LUKO; the
owner accepts it); the 19 Aug prediction (flag will not clear) stands.
Honesty clause: amplitude cut by hand after observing the price — the loop
the ninth amendment removed from the code, now with a human in it.

**B. Stabilizer.** Section 2 as a rule, plus, stated plainly: (1) an outside
price move is back inside a decision — a partial reversal of the ninth
amendment, deliberate: the arm still reads no price, the stabilizer reads
only the part of the price the worker did not make; (2) the eighth
amendment called an outside buy "the experiment working" — the stabilizer
now sells into it, and a buyer under $100 sees the issuer mark their
purchase down within ten minutes (a $10 buy: +6.9%, marked down to +1.7%,
≈ −4% on the position); a $100 buy is +80% and is accepted as the new
level; (3) the wallet earns the spread on every outside move by
construction; (4) not a peg — 25% of each move stays, a persistent buyer or
seller moves the price and drains the wallet, and an empty wallet is a
logged state, not a failure; (5) burned LP does not stop sells: any holder
can sell into the pool (LUKAS's 45,860 BYKO would be −35%; 100 airdrop
holders selling 227 each −20%), and the wallet starts with 0 USDC, so it can
only sell until it has earned USDC; (6) founder wallets reset the reference
and cannot trigger it; (7) the LUKO control is untouched by B (BYKO pool
only); (8) honesty clause: manufactured stability, disclosed. Blockaid
effect: unknown; no prediction changes.

## 4. Worker (`market/`)

- `rules.json`: a top-level `stabilizer` block (hashed with the rest):
  `{ wallet, token, pool, threshold_pct: 5, damp_pct: 75, reset_outside_usdc: 100,
  check_minutes: 10, log_min_deviation_pct: 1, slippage_bps: 300 }`.
- Secret `STABILIZER_PRIVATE_KEY` (the owner sets it with
  `npx wrangler secret put`; never handle the key yourself). Add to
  `src/types.ts`.
- One lock per wallet: a `StabLock` Durable Object (or a policy branch of
  `ArmLock`), nonce discipline as today; the `trades` row (arm `stabilizer`)
  is written before broadcast; the existing confirmer settles it.
- Per tick: `eth_getLogs` (pool Swap) from the last processed block (keyed
  DRPC endpoint); `eth_getTransactionByHash` only for hashes not in
  `trades` (a few a week); classify; fold into `ref`; read reserves;
  evaluate; act or log.
- D1 by hand (document in `schema.sql`): `stab_state` (ref_price,
  ref_reason, ref_at, last_block) and either `events` kinds
  `stab-check | stab-reference | stab-attribution | stab-trade | stab-cannot`
  or a `stab_checks` table if `events` gets noisy. One heartbeat row per day.
- `wash-api.ts`: add a `stabilizer` object: `rules`, `reference {price,
  reason, at, block}`, `live {price, reserve_usdc, reserve_token, at}`,
  `deviation_pct`, `state` (`quiet | above | below | cannot | acted | unset |
  down`), `intent {side, byko, usdc, land_pct}` when out of band, `wallet
  {byko, usdc, eth}`, `last_action`, `next_check_at`, `checks_today[]`
  (one entry per tick: `none | out | sell | buy | cannot`), `decisions[]`
  (newest first: at, deviation_pct, decision, size, value_usdc, landed_pct,
  tx_hash; plus one `day` summary row per past day), `events[]`.
- `hash-rules.mjs` → rules row; `npm run deploy` WITHOUT
  `CLOUDFLARE_API_TOKEN` (wrangler's own login; the token fails on routes);
  `/api/kick`.

## 5. Site (`website/`)

- Move `docs/drafts/stabilizer-mock.html` to `website/stabilizer.html`: fix
  the asset hrefs (`../../website/assets/` → `assets/`), drop the
  `noindex`, the `STATIC MOCK` comment, the "Home page card" mock section
  and the `.mock` state switcher; put the nav between `<!-- nav:begin -->`
  / `<!-- nav:end -->` markers and add the page to `NAV_PAGES` and the
  sitemap list in `scripts/render-diary.mjs`, then run it.
- Split the inline script into `website/stabilizer.js` (repo idiom: `var`,
  no arrows — see `market-self.js`), keep its arithmetic (`sizeTo`,
  `posMain`, `posDtl`, the band/reference/landing placement), replace
  `STATES` with the `stabilizer` object from `/api/wash`, keep the skeleton
  dashes while loading, cache-bust `?v=`.
- Two phone fixes seen in the mock at 375px: the fact label on the detail
  rail overlaps the zone label when the fact is at +14% — stack the fact
  label under the rail (or hide the zone label) below 640px; the pool
  readout labels overflow on the right (same as `/market`; fix in both if
  cheap).
- Home page: the fourth `.run` card (its copy is in the mock's "Home page
  card" section). `.cards3` in `byko.css` is a fixed 3-column grid — add a
  4-column rule (2 at ≤900px, 1 at ≤640px) and bump `byko.css?v=` on every
  page that links it (list in CLAUDE.md).
- `w.html`, the register, `CHECKPOINT_KEY`: unchanged.

## 6. Money and rollover

| step | who | what |
| --- | --- | --- |
| halt arm `byko` | engineer | `POST /api/halt {"arm":"byko"}` |
| Buyer cash | owner | withdraw **$16 USDC** from BYKO Buyer `0xe1e16dd66b66bc471b8cafac4c71e2abe0060a16` to BYKO Ops (leaves ≈ $9.75, inside the new 8–11 dead zone); **BYKO stays** (14,963 ≈ $21.6 realisable) |
| reset | engineer | `UPDATE wallet_state SET direction=NULL, run_target_usdc=NULL, mode=NULL, mode_left=NULL WHERE address='0xe1e1…0a16'` |
| Pumper | owner | move ALL his BYKO into `0x9c86…3206` (his decision; ≈ 350K, 44% of supply behind one worker secret — said once, accepted); 0 USDC on purpose; 0.0020 ETH is enough for hundreds of swaps |
| secret | owner | `npx wrangler secret put STABILIZER_PRIVATE_KEY` |
| roll | engineer | rules hash → D1; deploy; kick `byko`; start the stabilizer; verify `/api/wash` |
| LUKO arms | nobody | no withdrawal; they buy their excess into LUKO on day one (accepted) |

## 7. The live test (settled)

**$20 USDC → BYKO from the wallet the site calls LUKAS**, `0x30Fd96C5aE61f0fB3d97e6159ab023710163eFBF`.
It is Lukas's own wallet (the owner keeps a backup of its seed so it cannot
be lost; Lukas signs). It is not in the register, so under §2 the buy is
`outside` and under $100 — exactly what the stabilizer exists to answer.

Expected at today's depth (292.5 USDC : 187,328 BYKO): Lukas receives
≈ 11,700 BYKO, price +13.9%; within one tick (≤ 10 min) the stabilizer sells
≈ 8,200 BYKO (≈ $15) and lands at ≈ +3.5% over the reference; that sell
becomes the new reference. Lukas's position is marked down ≈ 9% by the
issuer within ten minutes — that is the rule working, and the evidence
entry says so in those words.

Before sending: announce (wallet, amount, expected move) on the page or in
the diary. After: publish both hashes, the decision row, the check strip
and before/after prices. Keep the bought BYKO in Lukas's wallet; if it is
later moved to a founder wallet, the chain shows a buy from LUKAS followed
by a transfer to the author, and the entry must say that too.

## 8. Order of work

1. Amendments A and B in `rules.json` (one commit, one hash roll) + worker
   code + types + schema notes; `tsc` clean.
2. Halt `byko`; owner does the three transfers and the secret.
3. Reset `wallet_state`; hash → D1; deploy; kick; verify.
4. `stabilizer.html` + `stabilizer.js` + home card + render-diary; push.
5. The test in §7; evidence entry in the diary.
