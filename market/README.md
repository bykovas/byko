# byko-market — disclosed self-trading worker

Implements `docs/drafts/wash-worker-blueprint.md`. A self-contained Cloudflare
Worker on `byko-market.bykovas.lt`, separate from app227 and from the Pages
site. Two arms (`byko`, `luko`) trade against their own Aerodrome pools on a
random schedule; every trade is recorded before it is broadcast and published
at `/api/wash`, which the site page `website/self-trading.html` renders.

**Nothing trades until the owner completes the launch sequence below.** The
`MARKET_OPEN` var defaults to `"0"` — the kill switch — and each arm also
refuses to trade unless the live `rules.json` hash matches the D1 `rules` row.

## What is where

- `rules.json` — the pre-registered parameters. Committed **before** the first
  trade; its canonical hash is the runtime gate.
- `src/index.ts` — routes (`/api/wash` public; `/api/kick`, `/api/halt` admin)
  and the cron (`confirm` + `collect` + heartbeat re-arm).
- `src/do/arm-lock.ts` — one Durable Object per arm; the alarm is the trader.
  Pre-sign → hash → INSERT row → broadcast, mirroring app227's treasury.
- `src/lib/collector.ts` — hourly classifier probes (ten endpoints) → D1.
- `src/lib/confirm.ts` — settles pending trades from receipts (parses the pool
  Swap log for the exact amounts).
- `src/db/schema.sql` — six tables, applied by hand.
- `scripts/hash-rules.mjs` — prints the canonical hash to insert.
- `scripts/export.mjs` — writes the repo's CSV record from `/api/wash`.

## Launch sequence (owner, in order)

```bash
cd market
npm install

# 1. create the D1 database, put its id into wrangler.toml (database_id)
npx wrangler d1 create byko-market

# 2. apply the schema by hand
npx wrangler d1 execute byko-market --remote --file=src/db/schema.sql

# 3. pre-register: print the canonical hash of the committed rules.json...
node scripts/hash-rules.mjs
#    ...then insert the single rules row (id=1) with that hash, the declaring
#    commit, and rules.json verbatim in the json column.

# 4. set the secrets (never in the repo)
npx wrangler secret put ARM_PRIVATE_KEY_BYKO   # must derive 0xe1e1...0a16 (BYKO Buyer)
npx wrangler secret put ARM_PRIVATE_KEY_LUKO   # must derive 0x46bc...c68e (LUKO Buyer)
npx wrangler secret put DRPC_URL
npx wrangler secret put ADMIN_TOKEN

# 5. seed each wallet with USDC (~$20) and a little ETH for gas. The first buy
#    acquires the token; nothing else needs seeding. Both wallets are already
#    in website/data/founder-wallets.json — no new address is used.

# 6. deploy WITH THE KILL SWITCH STILL CLOSED to smoke-test the read path
npx wrangler deploy
curl https://byko-market.bykovas.lt/api/wash   # 503 until the rules row exists, then renders

# 7. open the kill switch: set MARKET_OPEN = "1" in wrangler.toml, deploy again
npx wrangler deploy

# 8. arm the schedulers
curl -X POST https://byko-market.bykovas.lt/api/kick \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

To stop everything at once: set `MARKET_OPEN = "0"` and deploy — every arm
halts at its next alarm without sending. To stop one arm now:
`POST /api/halt` with `{"arm":"luko"}` and the admin bearer. The **luko** arm
is also stopped simply by withdrawing its wallet's funds — the worker treats
"cannot fund a trade" as a clean `funds-withdrawn` halt.

## Recording the daily Base App check

Base App has no API, so the human half of the byko arm's stop condition is
entered by hand. Two consecutive `clean` readings halt that arm; anything else
is just recorded.

```bash
curl -X POST https://byko-market.bykovas.lt/api/observe \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "content-type: application/json" \
  -d '{"arm":"byko","value":"scam","note":"screenshot 2026-08-20"}'
```

Use `"clean"` when the warning is gone. It lands in `flag_checks` beside every
machine probe and shows up in the grid as the `base-app` row.

## Wiring the page in at launch

`website/self-trading.html` exists and is in the sitemap now; it shows a
"pre-registered, not started" notice until the worker is live. When launching,
add a second cell to the home page's *Running experiments* block linking to it,
and link it from the diary entry. Bump `?v=` on `market-self.js` /
`byko.css` references if either changes (see CLAUDE.md).

## After it runs

`node market/scripts/export.mjs` writes `website/data/experiments/wash/`
(trades.csv, checks.csv, meta.json); commit them. That committed export is the
record that outlives D1.
