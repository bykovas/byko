-- byko-app227 D1 schema. Applied BY HAND, never by automation:
--
--   wrangler d1 execute byko-app227 --remote --file=src/worker/db/schema.sql
--
-- NOTE: this skeleton schema is derived from the route list (auth, profile,
-- advance, checks, metrics, webhook) and the claims.json shape. Reconcile it
-- with the architecture document before the first real migration; until then
-- nothing applies it.

CREATE TABLE IF NOT EXISTS profiles (
  fid            INTEGER PRIMARY KEY,               -- Farcaster id
  username       TEXT,
  eth_address    TEXT,                              -- primary verified address
  address_source TEXT,                              -- primary | first_verified | none
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT
);

-- one row per fid+claim: where this user stands on this fact
CREATE TABLE IF NOT EXISTS advances (
  fid        INTEGER NOT NULL REFERENCES profiles(fid),
  claim_id   TEXT    NOT NULL,                      -- id from /data/claims.json
  state      TEXT    NOT NULL,                      -- opened | passed | failed
  opened_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT,
  PRIMARY KEY (fid, claim_id)
);

-- raw check results, append-only (an advance may retry; every attempt stays)
CREATE TABLE IF NOT EXISTS checks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  fid        INTEGER NOT NULL,
  claim_id   TEXT    NOT NULL,
  result     TEXT    NOT NULL,                      -- JSON payload of the check
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- product metrics, append-only
CREATE TABLE IF NOT EXISTS metrics_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  fid        INTEGER,
  kind       TEXT NOT NULL,
  payload    TEXT,                                  -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- inbound webhook dedup: provider event id is the primary key
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id    TEXT PRIMARY KEY,
  kind        TEXT,
  payload     TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_advances_fid    ON advances(fid);
CREATE INDEX IF NOT EXISTS idx_checks_fid      ON checks(fid, claim_id);
CREATE INDEX IF NOT EXISTS idx_metrics_created ON metrics_events(created_at);
