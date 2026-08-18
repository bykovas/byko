-- byko-app227 D1 schema. Applied BY HAND, never by automation:
--
--   npx wrangler d1 execute byko-app227 --remote --file=src/worker/db/schema.sql
--
-- Reconciled 18 Aug 2026 with the architecture document (§3) AND the owner's
-- day mechanics: 227 BYKO per claim, 1 claim/day and 5/wallet lifetime,
-- 2 answers/day/wallet, one answer per (fid, claim). Two facts open per day.
--
-- The money path (advances) is SHAPED here but not yet used — no transfer is
-- sent until phase 4 (Base Sepolia first). What is live now: profiles,
-- answers and the metrics they feed. Every statement is idempotent.

-- One row per Farcaster user seen.
CREATE TABLE IF NOT EXISTS profiles (
  fid            INTEGER PRIMARY KEY,               -- Farcaster id (from Quick Auth)
  username       TEXT,                              -- @handle, resolved via Neynar (nullable)
  eth_address    TEXT,                              -- primary verified address (money target, phase 4)
  address_source TEXT,                              -- primary | first_verified | none
  fid_at_launch  INTEGER NOT NULL DEFAULT 0,        -- 1 if fid < N_snapshot at first sight (measurement marker)
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT
);

-- The verdicts. One answer per (fid, claim) — enforced by the UNIQUE key,
-- which also makes double-tap idempotent. The 2/day cap is counted on
-- answer_date. verdict: yes | no | cant. argument is required for 'no'.
CREATE TABLE IF NOT EXISTS answers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  fid          INTEGER NOT NULL,
  claim_id     TEXT    NOT NULL,                    -- id from /data/claims.json
  verdict      TEXT    NOT NULL,                    -- yes | no | cant
  argument     TEXT,                                -- present when verdict = no
  answer_date  TEXT    NOT NULL,                    -- YYYY-MM-DD (UTC) — the 2/day window
  content_hash TEXT    NOT NULL,                    -- sha256 of the answer payload (tamper-evident)
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (fid, claim_id)
);

-- Money (phase 4). status: sending | pending | confirmed | failed.
--   sending   — row written, tx not yet signed (pre-sign records the hash
--               before any broadcast)
--   pending   — signed and hash recorded; the cron resolves it by receipt
--               (or expires it after 24h)
--   confirmed — receipt final after 2 confirmations
--   failed    — never signed, reverted, or expired
-- Limits: ANY row burns the wallet's day (failed included — honesty over
-- generosity); lifetime (5) and the global daily cap exclude 'failed'.
-- All writes go through the treasury DO; the cron only demotes/promotes.
CREATE TABLE IF NOT EXISTS advances (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  fid          INTEGER NOT NULL,
  claim_id     TEXT,
  address      TEXT,
  amount       INTEGER,                             -- BYKO whole tokens (227)
  tx_hash      TEXT,
  status       TEXT    NOT NULL DEFAULT 'pending',
  advance_date TEXT    NOT NULL,                    -- YYYY-MM-DD (UTC) — the 1/day window
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  confirmed_at TEXT
);

-- defence in depth for the 1/day rule: even a path that bypassed the
-- treasury DO could not double-insert a wallet's day
CREATE UNIQUE INDEX IF NOT EXISTS uq_advances_fid_day ON advances(fid, advance_date);

-- Disputes (a 'no' the author must answer) — phase later. 790 BYKO on accept.
CREATE TABLE IF NOT EXISTS disputes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  answer_id   INTEGER NOT NULL REFERENCES answers(id),
  status      TEXT    NOT NULL DEFAULT 'open',      -- open | accepted | rejected
  resolution  TEXT,
  resolved_at TEXT,
  payout_tx   TEXT
);

-- Inbound webhook dedup (notifications, phase 3+): provider event id is the key.
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id    TEXT PRIMARY KEY,
  kind        TEXT,
  payload     TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_answers_date    ON answers(answer_date);
CREATE INDEX IF NOT EXISTS idx_answers_fid     ON answers(fid);
CREATE INDEX IF NOT EXISTS idx_answers_claim   ON answers(claim_id);
CREATE INDEX IF NOT EXISTS idx_advances_fid    ON advances(fid, advance_date);
