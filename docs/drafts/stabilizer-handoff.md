# Stabilizer — engineering handoff (decisions of 17 Sep 2026)

Read with `docs/drafts/stabilizer-page-brief.md` (the page) and
`docs/drafts/stabilizer-panel-verdict.md` (the pool arithmetic and the
objections a sceptic will raise; its recommendation "no stabilizer" was
superseded by the owner's decision below, the numbers stand).

## Decisions (owner)

| item | decision |
| --- | --- |
| build | yes: a stabilizer on the BYKO pool only, from wallet BYKO LP Pumper `0x9c8665dd47eba6e23c47fa2577fe3ad953563206` (already in the register) |
| attribution | exact, by transaction hash: every trade the worker makes (arm `byko` and the stabilizer itself) is a row in `trades` with its `tx_hash` written before broadcast; a pool move not explained by those rows was made by somebody else. Founder wallets NOT run by the worker (e.g. BYKOVAS `0xe8fc…`) count as outside — say so on the page |
| reference | the pool price after the worker's last own trade in the BYKO pool (`reserve_usdc_after` / token reserve after; both are in `trades`); the stabilizer's own trade becomes the new reference |
| threshold | 5% deviation of the live pool price from the reference |
| damping | 75% of the deviation; the stabilizer trades the amount that moves the price to `reference × (1 + 0.25 × deviation)` (constant product, fee included, capped by the wallet's balances) |
| limits | only the wallet's balances; no daily cap |
| cadence | every worker cron tick (10 min); latency up to 10 min, printed |
| logging | every check with \|deviation\| > 1% and every action (incl. `cannot`: no USDC / no BYKO / RPC refused), plus one heartbeat row per day |
| name | "Stabilizer"; page `/stabilizer`; fourth card on the home page |
| Pumper funding | owner moves ALL his BYKO into it (~350K); 0 USDC to start, so it can only sell until it has earned USDC; 0.0020 ETH is enough for hundreds of swaps |
| arm `byko` amplitude | reduced (15th amendment): `run_floor_usdc` [1.5, 8] → [6, 8]; `run_ceiling_usdc` [20, 40] → [11, 13]; `max_trade_pct_pool` 2.5 → 1.0; `drawRunTarget()` fallback `uniform(1, 5)` → fixed 0.5. Per-trade impact ≤ 2%, typical daily range 5–6%, worst ≈ 10%. The strategy block is shared, so the LUKO arms take the same numbers; the owner does not mind |
| rollover of `byko` | halt the arm first; the owner withdraws **$16 USDC** from BYKO Buyer `0xe1e1…0a16` to BYKO Ops (leaves $9.75, inside the new 8–11 dead zone); **BYKO stays** (14,963 ≈ $21.6 realisable, two full sell runs with margin). Then `UPDATE wallet_state SET direction = NULL, run_target_usdc = NULL, mode = NULL, mode_left = NULL WHERE address = '0xe1e1…'`, hash → D1, deploy, kick |
| LUKO arms | no withdrawal; under the new numbers each will buy its excess cash into the LUKO pool on day one (~+25% on LUKO); the owner accepts it. Note it in the amendment |

## Amendments (rules.json `note`, in the file's voice; hash gate as always)

Count the existing amendments in `market/rules.json` before numbering
(the tenth was applied and reverted; its number stays burnt — verify in the
file and in the diary).

**Arm amplitude.** Fault: the arm alone prints 12–27% daily ranges
(287 confirmed trades, 8–17 Sep; per-trade max 9.7%, streak max 20.1%);
cash corridor [1.5, 40] plus the fallback permits $59 of one-way flow
(+44% / −36% at $296). Change: the three numbers and the fallback fix above.
Consequence: ≤2% per trade; typical daily range 5–6%, worst ≈ 10%; gross
flow ≈ $42/day instead of ≈ $80, mean trade ≈ $1.16 — more "tiny trades" in
Blockaid's words, and the 13th amendment's "dead chart" worry comes a step
closer. Rollover disclosed (the $16 withdrawal, the LUKO day-one buys). The
19 Aug prediction (the flag will not clear) stands. Honesty clause: this
shrinks amplitude by hand after observing the price — the loop the ninth
amendment removed from the code, now with a human in it.

**Stabilizer.** Everything in the decisions table, stated as a rule, plus:
(1) this puts an outside price move back into a decision — a partial
reversal of the ninth amendment, deliberate: the arm still reads no price;
the stabilizer reads only the part of the price that the worker did not
make; (2) the eighth amendment called an outside buy "the experiment
working" — the stabilizer will now sell into it, and the buyer will see
their purchase marked down within ten minutes by the issuer; (3) the wallet
earns the spread on every outside move by construction; (4) it is not a
peg — 25% of every outside move stays, a persistent buyer or seller moves
the price and drains the wallet, and the wallet running dry is a logged
state, not a failure; (5) sells only until it has earned USDC; (6) the
founder's own non-worker wallets count as outside, so the owner's announced
test buy is treated like anyone's; (7) honesty clause: manufactured
stability, disclosed. Blockaid effect: unknown; no prediction is changed.

## Worker (`market/`)

- `rules.json`: a `stabilizer` block outside `arms` — `{ wallet, token, pool,
  threshold_pct: 5, damp_pct: 75, check_minutes: 10, log_min_deviation_pct: 1,
  slippage_bps: 300 }` — so it is hashed with the rest.
- Secret: `STABILIZER_PRIVATE_KEY` (the owner sets it with
  `npx wrangler secret put`). Types in `src/types.ts`.
- Execution: a second Durable Object (`StabLock`) or a policy branch in
  `ArmLock` — one lock per wallet either way, nonce discipline as now: the
  `trades` row (arm = `stabilizer`) with `tx_hash` is written BEFORE broadcast,
  the confirmer settles it, and because it is a `trades` row it is
  automatically "self" for attribution.
- Tick (cron, every 10 min): read pool reserves; reference = last confirmed
  self trade in the BYKO pool (max id over arms `byko`, `stabilizer`); if none,
  log `no reference` and do nothing; deviation = live/reference − 1; if
  \|dev\| ≤ 5% → log only if \|dev\| > 1%; else compute the damping trade,
  cap by balances, execute or log `cannot`. Use the keyed DRPC endpoint; an
  RPC refusal is an `events` row, never a guess.
- Known limitation to state on the page: a slow outside drift of moves each
  under 5% between the arm's trades never triggers; the owner's earlier idea
  of a 10%-per-24h window rule is NOT in scope unless he asks.
- `wash-api.ts`: add a `stabilizer` object — rules, reference (price, trade
  id, at), live price, deviation, state, intended landing (side, size, price),
  wallet balances, last action, and the decisions log (own `events` kinds
  `stab-check` / `stab-trade` / `stab-cannot`, or a `stab_checks` table if the
  events table gets too noisy).
- D1 changes by hand (`schema.sql` documents them), `hash-rules.mjs` → rules
  row, `npm run deploy` without `CLOUDFLARE_API_TOKEN` (wrangler's own login;
  the token fails on routes), then `/api/kick`.

## Site (`website/`)

- `stabilizer.html` from the designer's mock; `stabilizer.js` (or a branch of
  `market-self.js`) wired to `/api/wash`'s `stabilizer` object; reuse the
  `/market` reserve scale (`poolEdge()`); cache-bust `?v=` on every changed
  JS/CSS reference; nav/sitemap via `scripts/render-diary.mjs` (`NAV_PAGES`
  and the sitemap list); fourth card on `index.html`.
- `w.html` and the register: nothing changes (Pumper is already listed;
  `CHECKPOINT_KEY` stays).

## Test (owner, after everything is live)

1. Announce first (diary or the page): wallet BYKOVAS `0xe8fc8769934f9461f7adf6f440ff3883e28021eb`, $20 USDC, expected +13.9%.
2. Owner swaps $20 USDC → BYKO on Aerodrome (≈ 11,700 BYKO).
3. Expected within 10 min: stabilizer sells ≈ 8,200 BYKO (≈ $15), price lands at ≈ +3.5% over the old reference; the sell becomes the new reference.
4. Publish both hashes, the decision row, and the before/after prices as the evidence entry.

## Order of work

1. Amendments text + `rules.json` (both changes in one commit; one hash roll).
2. Worker code + types + schema notes; local `tsc`.
3. Halt `byko`; owner withdraws $16 USDC; reset `wallet_state` for `byko`; owner moves BYKO into Pumper and sets the secret.
4. Hash → D1; deploy; kick `byko` and the stabilizer; verify `/api/wash`.
5. Page + home card from the mock; render-diary; push.
6. Owner's test; evidence entry.
