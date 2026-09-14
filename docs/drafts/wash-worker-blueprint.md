# Blueprint — the market worker (disclosed self-trading), BYKO and LUKO

Written for the model that implements it. Read the whole thing before writing
code, then read the files in §1 before writing code that touches them.

---

## 0. What this is, in one paragraph

Blockaid replied to a verification request that BYKO's remaining signal is not
a malice flag but a market-condition heuristic ("spam / unstable price") that
fires when a token's trading environment is extremely thin, and recommended:
deepen liquidity, sustain two-sided trading, then request a rescan. Deepening
is arithmetically impossible for this token — a $20,000 pool would need ~39.2M
BYKO against a fixed supply of 790,227. That leaves sustaining two-sided
trading, and since nobody else trades BYKO, that means the founder's own
wallets trading against the pool on a schedule. **That is wash trading, and the
project will publish it under that name, with the recommendation that prompted
it, the parameters declared in advance, and every trade.** The worker is the
instrument. The page is the readout. Neither is a performance.

---

## 1. Read these first — mandatory

| file | why |
| --- | --- |
| `CLAUDE.md` | house rules: commit to main, never force-push, cache-busting, the design system's three unbreakable rules |
| `app227/src/worker/do/fid-lock.ts` | **the pattern to copy.** Serialises money in a Durable Object; pre-signs, derives the hash, writes the row, *then* broadcasts. Reproduce this discipline exactly. |
| `app227/src/worker/lib/store.ts` | how D1 is accessed here — prepared statements, error handling, no ORM |
| `app227/src/worker/routes/ledger.ts` | shape of an existing read-only JSON route |
| `app227/src/worker/db/schema.sql` | schema conventions: comments explaining *why*, `IF NOT EXISTS`, applied by hand never by automation |
| `app227/wrangler.toml` | binding style, secret discipline, kill-switch-as-var precedent (`ADVANCES_OPEN`) |
| `scripts/airdrop/send.mjs` | the same record-before-money rule in a script, plus the stock guard that refuses a partial run |
| `scripts/airdrop/lib.mjs` | RPC fallback list and retry behaviour; DRPC first, public nodes after |
| `website/ledger.html` | the page to imitate: shared header/footer, `.scroll` table, live fetch, no framework |
| `website/assets/byko.css` | every token you are allowed to use. Do not invent values. |
| `website/data/founder-wallets.json` | the public register; both trading wallets are already in it |
| `functions/api/tally.js` | how a Pages function reads shared data and refuses to answer rather than guess |

---

## 2. Non-negotiables

1. **The record precedes the money.** Pre-sign → `keccak256` → `INSERT` the row
   with `tx_hash` and `status='pending'` → *then* `eth_sendRawTransaction`. A
   crash between insert and broadcast must leave a resolvable row, never a
   silent gap.
2. **Absence must be visible.** A skipped trade, a tripped guard, a dead RPC —
   all go in `events`. A missing measurement renders as `?`, never as
   "unchanged". A gap that looks like nothing happened is a lie.
3. **The rules are committed before the first trade.** `rules.json` lands in
   git, its sha256 goes into D1, and the worker refuses to trade if its live
   config does not hash-match. Parameters cannot be quietly tuned mid-run.
4. **Blue means a value read from the chain live, and nothing else.** The trade
   log is recorded history — no blue in it. The other two house rules: no
   opacity for text, no shadows, no radius outside controls; mono for data
   only, never labels or kickers.
5. **No new addresses.** Both wallets are already in the public register. A
   fresh address would make this a sybil layer on top of wash trading and
   destroy the point.
6. **Secrets via `wrangler secret put`.** Private keys never touch the repo,
   never appear in `wrangler.toml`, never get logged.
7. **Never force-push.** The diary publish workflow derives new entries from
   the push diff.

---

## 3. Where it lives

A **new Worker**, not inside app227. app227 pays claims to readers; this trades
on a schedule. Different money, different blast radius, separate kill switch.

- `market/` — new directory at repo root, own `wrangler.toml`, own D1
  (`byko-market`), own DO class, own secrets.
- The public page and its API stay on the main site: `website/market-log.html`
  (or a name you argue for) and `functions/api/wash.js`, with the same D1 bound
  to the Pages project for reads.

---

## 4. Parameters — declared, not discovered

These go in `rules.json`, committed before the first trade.

```jsonc
{
  "declared_at": "<ISO, the commit date>",
  "arms": [
    {
      "id": "byko",
      "wallet": "0xe1e16dd66b66bc471b8cafac4c71e2abe0060a16",
      "token":  "0x078bb16e24C8931Fc007928c370422e5e38F4372",
      "pool":   "0x02dd4285ad38ea93d021ca854016a839b0b2a6ca",
      "stop":   { "max_days": 14, "on_signal_cleared": true }
    },
    {
      "id": "luko",
      "wallet": "0x46bcf5c09ef3831020d06ed879d69098a5a3c68e",
      "token":  "0x4a9DA2831A691E7C4aca594CaFd58c35e0131fD1",
      "pool":   "0x2222a01b83db8c533b062aeb6de4f61d6ae792f2",
      "stop":   { "max_days": null, "on_signal_cleared": false }
    }
  ],
  "quote": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "interval_minutes": [5, 180],
  "trade_usdc": [0.3, 9.0],
  "pivot_usdc": 10,
  "seed_usdc": 20,
  "chain_id": 8453
}
```

The LUKO arm has no fixed end. The owner stops it by withdrawing the wallet's
funds; the worker must treat "not enough to trade" as a clean halt.

**The rule, stated so it cannot drift:** after each trade the arm draws a fresh
uniform delay from `interval_minutes` (independently per arm) and a fresh
uniform size from `trade_usdc`. When the alarm fires it reads its own USDC
balance: below `pivot_usdc` it **sells** the token for USDC, above it **buys**.
That is the whole strategy. It has no view on price, and must not acquire one.

Why this shape: it bounds the position without any explicit alternation rule.
From a $20 seed it buys two or three times, crosses the pivot, and thereafter
each average-sized trade crosses back — so the flow alternates on its own. It
also bootstraps: both wallets currently hold 0 tokens, and the first buy
acquires them, so nothing needs seeding but USDC.

**Sizes sit deliberately inside the token's own history** ($0.79–$9.90 for BYKO
before this). Matching the past is more defensible than optimising the metric.
Do not "improve" the range.

---

## 5. D1 schema

Six tables. Comments belong in the file, in the style of `app227/db/schema.sql`.

```sql
-- Pre-registration. One row, written before the first trade, never updated.
CREATE TABLE IF NOT EXISTS rules (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  declared_at TEXT NOT NULL,
  git_commit  TEXT NOT NULL,
  json        TEXT NOT NULL,
  sha256      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wallets (
  address TEXT PRIMARY KEY,
  arm     TEXT NOT NULL,          -- byko | luko
  label   TEXT NOT NULL,          -- as printed in founder-wallets.json
  token   TEXT NOT NULL,
  pool    TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS wallet_state (
  address       TEXT PRIMARY KEY,
  next_fire_at  TEXT NOT NULL,
  usdc_balance  TEXT,
  token_balance TEXT,
  updated_at    TEXT NOT NULL
);

-- The ledger. The row exists before the transaction is broadcast.
CREATE TABLE IF NOT EXISTS trades (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  arm           TEXT NOT NULL,
  wallet        TEXT NOT NULL,
  token         TEXT NOT NULL,
  decided_at    TEXT NOT NULL,
  side          TEXT NOT NULL CHECK (side IN ('buy','sell')),
  usdc_amount   TEXT NOT NULL,     -- the drawn size
  delay_min     REAL NOT NULL,     -- the delay that led here
  trigger_usdc  TEXT NOT NULL,     -- the balance that chose the side
  price_before  TEXT NOT NULL,
  reserve_token_before TEXT,
  reserve_usdc_before  TEXT,
  nonce         INTEGER,
  tx_hash       TEXT,              -- written BEFORE broadcast
  status        TEXT NOT NULL,     -- pending | confirmed | failed
  broadcast_at  TEXT,
  confirmed_at  TEXT,
  block_number  INTEGER,
  token_amount  TEXT,              -- settled from the receipt
  price_after   TEXT,
  fdv_after     TEXT,
  reserve_usdc_after TEXT,
  gas_wei       TEXT,
  error         TEXT
);

-- The outcome. What the classifiers say, sampled on a schedule.
CREATE TABLE IF NOT EXISTS flag_checks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  checked_at TEXT NOT NULL,
  arm        TEXT NOT NULL,
  source     TEXT NOT NULL,
  method     TEXT NOT NULL,        -- api | manual
  ok         INTEGER NOT NULL,     -- 0 = the check itself failed → renders '?'
  value      TEXT,                 -- short normalised reading for the grid
  raw        TEXT,                 -- full response, kept verbatim
  changed    INTEGER NOT NULL DEFAULT 0,   -- differs from this source's baseline
  note       TEXT
);

CREATE TABLE IF NOT EXISTS market_samples (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  sampled_at    TEXT NOT NULL,
  arm           TEXT NOT NULL,
  price_usd     TEXT, fdv_usd TEXT, tvl_usd TEXT,
  reserve_token TEXT, reserve_usdc TEXT,
  vol_24h TEXT, buys_24h INTEGER, sells_24h INTEGER, holders INTEGER
);

-- Everything that happened and was not a trade.
CREATE TABLE IF NOT EXISTS events (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  at     TEXT NOT NULL,
  arm    TEXT,
  kind   TEXT NOT NULL,   -- halt | resume | skip | guard-trip | rules-mismatch | error
  detail TEXT
);
```

---

## 6. The worker

One Durable Object class, one instance per arm, alarm-driven. Copy the
serialisation and pre-sign discipline from `fid-lock.ts`; do not invent a new
one.

Each alarm:

1. Load `rules` from D1, hash the live config, compare. Mismatch → write a
   `rules-mismatch` event, halt the arm, do not trade.
2. Read chain state: own USDC and token balances, pool reserves, derive price.
3. Run the guards (§8). Any trip → `guard-trip` event, reschedule or halt.
4. Choose side from `trigger_usdc` vs `pivot_usdc`; draw the size.
5. Build the swap, pre-sign, derive the hash, `INSERT` the row with
   `status='pending'`, **then** broadcast.
6. Draw the next delay, write `wallet_state.next_fire_at`, set the alarm.
7. A separate confirmer (cron or queue) settles `pending` rows from receipts
   and fills `token_amount`, `price_after`, `fdv_after`, `gas_wei`.

Use the same RPC fallback list as `scripts/airdrop/lib.mjs`: DRPC first, public
nodes behind it. A node failure is an `events` row, not a silent retry loop.

**LUKO has no timer.** It runs until its wallet cannot fund a trade, then writes
a `halt` event with reason `funds-withdrawn` and stops setting alarms. It must
not error-loop, and must not spend below the gas reserve.

---

## 7. The collector

A cron job, hourly, writing `flag_checks` and `market_samples` for both arms.
Every source below was probed and behaved as described on 19 Aug 2026.

| source | request | current BYKO reading | notes |
| --- | --- | --- | --- |
| MetaMask price | `price.api.cx.metamask.io/v2/chains/8453/spot-prices?tokenAddresses=…&vsCurrency=usd` | HTTP 500 | **the machine behind "Unstable price".** USDC returns a price; BYKO and LUKO both 500. If this ever returns a number, the condition behind the label moved. |
| MetaMask token | `token.api.cx.metamask.io/token/8453?address=…` | `aggregators: ["dynamic"]` | on no curated list |
| GoPlus | `api.gopluslabs.io/api/v1/token_security/8453?contract_addresses=…` | 919 holders, `is_in_dex: 0` | full risk field set |
| DexScreener | `api.dexscreener.com/latest/dex/tokens/…` | 1 pair | listed 18 Aug after the first sale |
| GeckoTerminal pool | `api.geckoterminal.com/api/v2/networks/base/pools/…` | `locked_liquidity_percentage: null` | it does not know the LP is 100% burned |
| CoinGecko | `api.coingecko.com/api/v3/coins/base/contract/…` | 404 | LUKO also 404 |
| Blockscout | `base.blockscout.com/api/v2/tokens/…` | `holders: 1`, `reputation: ok` | reports 1 holder against 919 on chain |
| Uniswap list | `tokens.uniswap.org` | absent | |
| Trust assets | `raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/{checksum}/info.json` | 404 | |
| 1inch list | `tokens.1inch.io/v1.2/8453` | absent, 165 tokens listed | |

Do **not** attempt `security-alerts.api.cx.metamask.io` — it is behind
Cloudflare bot protection and returns a challenge page. Blockaid has no public
endpoint (404 without partner credentials). Their verdict reaches us only by
email, and Base App's rendering only by human screenshot: that one row is
`method='manual'` and entered by hand.

Each source declares a baseline on first run; `changed` is set when a later
reading differs from it. A failed request writes `ok=0` — never a fabricated
"unchanged".

---

## 8. Guards and stop conditions

Halt the affected arm and write an `events` row on any of:

- cumulative USDC spent by an arm exceeds its declared cap
- price deviates more than a declared percentage from the arm's start price
- pool reserves change by more than a declared amount between two alarms
  (someone else is trading; do not trade into an unknown move)
- the wallet cannot fund the trade plus a gas reserve
- N consecutive RPC failures
- `rules.json` hash mismatch
- a kill-switch var, in the style of `ADVANCES_OPEN`, flipped to `0`

Stop conditions for the **byko** arm, fixed in advance so they cannot be
reinterpreted afterwards:

- **machine-observed:** MetaMask's price service returns a price instead of 500
- **human-observed:** Base App shows no scam warning, by screenshot, **on two
  consecutive daily checks** — one observation is not a measurement; the flag
  already vanished and returned within 18 hours once
- **backstop:** 14 days, unconditionally

The **luko** arm has none of these. It stops when the money is taken out.

---

## 9. API and page

`GET /api/wash` → JSON: rules (with hash and commit), arms with current state,
trades newest first (paged), the `flag_checks` grid, latest `market_samples`,
recent `events`. It refuses to answer rather than guess if the rules row is
missing — the precedent is `functions/api/tally.js`.

The page carries the shared header and footer, is not hidden, and opens with
the disclosure, not the tables: Blockaid's reply quoted verbatim, the declared
rules with a link to the commit that predates the first trade, the stop
conditions, and the sentence naming this wash trading.

**A row that must be prominent and live on the LUKO arm:** its LP is 100% held
by MEETLUKO — a founder wallet — and is withdrawable, unlike BYKO's, which is
100% at `0x…dEaD`. Show the LP holder and balance as read from the chain so
anyone can verify it was not touched. This is the strongest objection to the
LUKO arm; publish it louder than anyone else could put it.

**Table 1 — checks.** Sources in rows, days in columns, day numbers from the
start, only elapsed days. Three cell states and no others:

- `·` unchanged from this source's baseline
- `▲` changed
- `?` not measured

A `NOW` column holds today's raw reading in full. No green, no red: the axis is
"did it move", not "is it good".

**Table 2 — trades.** Newest first, one row per swap:

`# · UTC · SIDE · USDC · TOKEN · PRICE · FDV · POOL · TX`

Signed numbers carry direction (`−4.65` / `+18,412`), mono, `tabular-nums`.
Colour, if any, goes on the word `buy`/`sell` only — never on the numbers:
green and red on a number read as profit and loss, and here both sides are the
same person. `POOL` is the USDC side after the trade; with `PRICE` that
reconstructs both reserves without a column half a screen wide. Keep `FDV`
precisely because it is absurd — a "market cap" that moves thirty dollars
because someone spent five makes the point without a word of commentary.

---

## 10. Daily export

A cron writes `website/data/experiments/wash/trades.csv` and `checks.csv` from
D1 and commits them. D1 is the live store; the repo is the record that outlives
it, diffable and versioned, exactly as `airdrop-journal.jsonl` is.

---

## 11. Definition of done

- `rules.json` committed, hash in D1, worker refuses to run on mismatch
- both arms trading on independent schedules, rows written before broadcast
- confirmer settles pending rows; no row stays `pending` beyond two hours
  without an `events` explanation
- collector filling `flag_checks` hourly for both arms, `ok=0` on failure
- `/api/wash` serving; page rendering both tables and the LUKO LP row
- guards demonstrably firing in a dry run
- daily CSV export committing
- `?v=` bumped on every tag referencing changed CSS/JS, across all pages
- nothing published to the diary — the entry is a separate, owner-approved step

---

## 12. Do not

- do not add a price view, a profit target, or any cleverness to the strategy
- do not widen the size range to look less "tiny"; the closed loop is the finding
- do not colour numbers green or red
- do not silently retry; failures are rows
- do not touch the LUKO LP position
- do not publish or post anything; the owner approves the diary entry separately
