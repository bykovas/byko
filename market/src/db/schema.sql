-- byko-market D1 schema. Applied BY HAND, never by automation:
--
--   cd market && npx wrangler d1 execute byko-market --remote --file=src/db/schema.sql
--
-- The disclosed self-trading experiment. Two arms (byko, luko) trade against
-- their own Aerodrome pools on a schedule; every row here is meant to be
-- published, and the repo's daily CSV export is the copy that outlives the DB.
-- Every statement is idempotent.
--
-- The one rule that shapes the whole design: the record precedes the money.
-- A trade row exists, with its tx_hash, BEFORE the transaction is broadcast,
-- exactly as app227's advances do. A row can never claim "nothing was sent"
-- about money that was sent.

-- Pre-registration. ONE row, written before the first trade, never updated.
-- The worker hashes its bundled rules.json and refuses to trade unless the
-- hash matches sha256 here — parameters cannot be tuned mid-run in silence.
CREATE TABLE IF NOT EXISTS rules (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  declared_at TEXT NOT NULL,
  git_commit  TEXT NOT NULL,          -- the commit that published rules.json
  json        TEXT NOT NULL,          -- rules.json, verbatim
  sha256      TEXT NOT NULL,          -- canonical hash (see scripts/hash-rules.mjs)
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The two participants. Both are already in website/data/founder-wallets.json;
-- no address here may be one that is not in that public register.
CREATE TABLE IF NOT EXISTS wallets (
  address TEXT PRIMARY KEY,
  arm     TEXT NOT NULL,              -- byko | luko
  label   TEXT NOT NULL,              -- as printed in founder-wallets.json
  token   TEXT NOT NULL,
  pool    TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  started_at   TEXT,                  -- first alarm; NULL until armed
  start_price  TEXT,                  -- price at first trade, for the deviation guard
  usdc_spent   TEXT NOT NULL DEFAULT '0'   -- cumulative gross USDC spent on buys
);

-- Live pacing state, one row per wallet.
CREATE TABLE IF NOT EXISTS wallet_state (
  address       TEXT PRIMARY KEY,
  next_fire_at  TEXT,                 -- when the next alarm is due (NULL = not armed / halted)
  halted        INTEGER NOT NULL DEFAULT 0,
  halt_reason   TEXT,
  usdc_balance  TEXT,
  direction     TEXT,                 -- last side taken; the band keeps it until a bound is crossed
  -- Added by hand, 20 Aug 2026, with the fourth amendment:
  --   ALTER TABLE wallet_state ADD COLUMN run_start_price TEXT;
  --   ALTER TABLE wallet_state ADD COLUMN run_target_pct  TEXT;
  -- A run turns when the price has moved run_target_pct from run_start_price.
  -- The target is DRAWN from the published range and written here before the
  -- run's first trade, so the figure is committed in advance rather than
  -- chosen once the outcome is known.
  run_start_price TEXT,
  run_target_pct  TEXT,
  token_balance TEXT,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The ledger. The row exists before the transaction is broadcast.
--   status: pending  — signed, hash recorded, broadcast attempted; confirmer resolves it
--           confirmed — receipt final
--           failed    — reverted, or never mined and expired
CREATE TABLE IF NOT EXISTS trades (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  arm           TEXT NOT NULL,
  wallet        TEXT NOT NULL,
  token         TEXT NOT NULL,
  decided_at    TEXT NOT NULL,
  side          TEXT NOT NULL CHECK (side IN ('buy','sell')),
  usdc_amount   TEXT NOT NULL,        -- the drawn size (USDC value intended)
  delay_min     REAL NOT NULL,        -- the delay that led to this fire
  trigger_usdc  TEXT NOT NULL,        -- the USDC balance that chose the side
  price_before  TEXT NOT NULL,
  reserve_token_before TEXT,
  reserve_usdc_before  TEXT,
  amount_in     TEXT,                 -- exact wei/uUSDC sent to the router
  min_out       TEXT,                 -- amountOutMin the swap was signed with
  nonce         INTEGER,
  tx_hash       TEXT,                 -- written BEFORE broadcast
  status        TEXT NOT NULL DEFAULT 'pending',
  broadcast_at  TEXT,
  confirmed_at  TEXT,
  block_number  INTEGER,
  token_amount  TEXT,                 -- settled from the pool Swap log
  usdc_settled  TEXT,                 -- settled from the pool Swap log
  price_after   TEXT,
  fdv_after     TEXT,
  reserve_usdc_after TEXT,
  gas_wei       TEXT,
  error         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The outcome. What the classifiers say, sampled on a schedule.
-- ok = 0 means the check itself failed and the grid must render '?', never a
-- fabricated "unchanged". changed = 1 when the reading differs from this
-- source's first (baseline) reading.
CREATE TABLE IF NOT EXISTS flag_checks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  checked_at TEXT NOT NULL,
  arm        TEXT NOT NULL,
  source     TEXT NOT NULL,
  method     TEXT NOT NULL,           -- api | manual
  ok         INTEGER NOT NULL,
  value      TEXT,                    -- short normalised reading for the grid
  raw        TEXT,                    -- full response, kept verbatim
  changed    INTEGER NOT NULL DEFAULT 0,
  note       TEXT
);

-- Market backdrop, so the outcome has something to be read against.
CREATE TABLE IF NOT EXISTS market_samples (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  sampled_at    TEXT NOT NULL,
  arm           TEXT NOT NULL,
  price_usd     TEXT, fdv_usd TEXT, tvl_usd TEXT,
  reserve_token TEXT, reserve_usdc TEXT,
  vol_24h TEXT, buys_24h INTEGER, sells_24h INTEGER, holders INTEGER,
  lp_holder TEXT, lp_locked TEXT,     -- lp_locked is the BURNED share; the keeper is named beside it
  founders_pct TEXT,                  -- share of total supply held by the published founder register
  -- holders and buys/sells come from sources the Worker cannot reach (GoPlus,
  -- GeckoTerminal); the probe writes them onto the newest row, so they carry
  -- their own measurement time rather than borrowing that row's sampled_at.
  -- Added by hand after the table existed:
  --   ALTER TABLE market_samples ADD COLUMN holders_at TEXT;
  --   ALTER TABLE market_samples ADD COLUMN trades_at  TEXT;
  holders_at TEXT, trades_at TEXT
);

-- Everything that happened and was NOT a trade. Absence must be visible: a
-- skipped fire, a tripped guard, a killswitch halt, a dead RPC all land here.
CREATE TABLE IF NOT EXISTS events (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  at     TEXT NOT NULL DEFAULT (datetime('now')),
  arm    TEXT,
  kind   TEXT NOT NULL,   -- halt | resume | skip | guard-trip | rules-mismatch | approve | error
  detail TEXT
);

CREATE INDEX IF NOT EXISTS idx_trades_arm    ON trades(arm, id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_checks_src    ON flag_checks(arm, source, id);
CREATE INDEX IF NOT EXISTS idx_events_arm    ON events(arm, id);
CREATE INDEX IF NOT EXISTS idx_samples_arm   ON market_samples(arm, id);

-- Last-good cache for everything the website reads that is NOT the pool price.
-- The website used to derive these in the reader's browser or rebuild them per
-- request in a Pages Function; both paths hit public rate limits, and one of
-- them (the referendum tally) had been answering 503 for days while the page
-- quietly fell back to a snapshot five days old.
--
-- The discipline is the same as everywhere else here: a failed refresh leaves
-- the previous row alone. A reader gets the last figure that was actually
-- measured, with the time it was measured — never a zero, never a blank, and
-- never a fresh timestamp on a stale number.
CREATE TABLE IF NOT EXISTS cache (
  key        TEXT PRIMARY KEY,   -- pool | holders | tally | eur
  json       TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  ok         INTEGER NOT NULL DEFAULT 1,
  note       TEXT
);
