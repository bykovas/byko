import type { Env } from "../types";
import { RULES, rulesHash } from "./rules";
import { json, error } from "./respond";

/* GET /api/wash — the whole public readout in one document. Refuses to answer
 * rather than guess if the rules row is missing (the precedent is the site's
 * tally function): no pre-registration, no readout. */

const SOURCE_ORDER = [
  "metamask-price", "metamask-token", "goplus", "dexscreener", "geckoterminal",
  "coingecko", "cmc-dex", "cmc-index", "blockscout", "uniswap-list", "1inch-list", "base-app",
];

const SOURCE_ASKS: Record<string, string> = {
  "metamask-price": "price or refusal",
  "metamask-token": "aggregators",
  "goplus": "risk verdict",
  "dexscreener": "pair listed",
  "geckoterminal": "locked liquidity",
  "coingecko": "contract known",
  "cmc-dex": "pool priced",
  "cmc-index": "ticker known",
  "blockscout": "holders / reputation",
  "uniswap-list": "present",
  "1inch-list": "present",
  "base-app": "what the screen says (by hand)",
};

/* The side the band and the run-reversal rule select right now. Same three
   inputs the worker uses: the USDC balance, the direction of the current run,
   and how far the pool has moved since that run began. */
function nextByRule(
  r: { guards: unknown },
  w: Record<string, unknown> | null,
  sample: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!w || w.halted === 1 || !w.next_fire_at || w.usdc_balance == null) return {};
  const balance = Number(w.usdc_balance) / 1e6;
  if (!Number.isFinite(balance)) return {};
  const [lower, upper] = RULES.strategy.band_usdc;
  let side: "buy" | "sell" = w.direction === "sell" ? "sell" : "buy";
  /* Same order the worker uses: the drawn percentage turns the run, then the
     band overrides it if the balance would leave 10–20. */
  const runStart = w.run_start_price ? Number(w.run_start_price) : 0;
  const runTarget = w.run_target_pct ? Number(w.run_target_pct) : 0;
  const price = sample?.price_usd ? Number(sample.price_usd) : 0;
  if (runStart > 0 && runTarget > 0 && price > 0) {
    const moved = (price - runStart) / runStart * 100;
    if (side === "buy" && moved > runTarget) side = "sell";
    else if (side === "sell" && moved < -runTarget) side = "buy";
  }
  if (balance > upper) side = "buy";
  else if (balance < lower) side = "sell";
  const poolUsdc = sample?.tvl_usd ? Number(sample.tvl_usd) : 0;
  const [sizeMin, sizeMax] = RULES.strategy.trade_usdc;
  const cap = poolUsdc > 0 ? poolUsdc * RULES.strategy.max_trade_pct_pool / 100 : 0;
  return {
    next_side: side,
    next_size_min: sizeMin,
    next_size_max: cap > 0 ? Math.min(sizeMax, cap) : sizeMax,
    next_run_start_price: runStart > 0 ? String(runStart) : null,
    next_run_target_pct: runTarget > 0 ? runTarget : null,
  };
}

function dayIndex(startDate: string, d: string): number {
  const a = Date.parse(startDate + "T00:00:00Z");
  const b = Date.parse(d + "T00:00:00Z");
  return Math.floor((b - a) / 86_400_000) + 1;
}

export async function washApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);

  const rulesRow = await env.DB.prepare(
    `SELECT declared_at, git_commit, sha256 FROM rules WHERE id = 1`,
  ).first<{ declared_at: string; git_commit: string; sha256: string }>();
  if (!rulesRow) return error("no rules row — the experiment is not pre-registered yet", 503);

  const live = await rulesHash();

  const arms = [];
  for (const r of RULES.arms) {
    const w = await env.DB.prepare(
      `SELECT w.enabled, w.started_at, w.start_price, w.usdc_spent,
              s.halted, s.halt_reason, s.next_fire_at, s.usdc_balance, s.token_balance, s.updated_at,
              s.direction, s.run_start_price, s.run_target_pct
         FROM wallets w LEFT JOIN wallet_state s ON s.address = w.address
        WHERE w.address = ?1`,
    ).bind(r.wallet).first<Record<string, unknown>>();
    const sample = await env.DB.prepare(
      `SELECT price_usd, fdv_usd, tvl_usd, vol_24h, buys_24h, sells_24h, holders,
              lp_holder, lp_locked, founders_pct, sampled_at
         FROM market_samples WHERE arm = ?1 ORDER BY id DESC LIMIT 1`,
    ).bind(r.id).first<Record<string, unknown>>();
    /* Holders is the one figure the Worker itself cannot fetch: GoPlus refuses
       Cloudflare's shared egress, so the count arrives from the local probe and
       lands on whichever sample row was newest when the probe ran. Every hourly
       collector pass then inserts a fresh row with holders NULL — which is why
       reading it off the latest row alone printed '—' while the number was
       perfectly well known. Carry the last real measurement forward WITH the
       time it was taken, so the reader gets the count and can see its age
       instead of a dash that claims we never counted. */
    const h = await env.DB.prepare(
      `SELECT holders, COALESCE(holders_at, sampled_at) AS at FROM market_samples
        WHERE arm = ?1 AND holders IS NOT NULL ORDER BY id DESC LIMIT 1`,
    ).bind(r.id).first<{ holders: number; at: string }>();
    /* Same story for the trade counts, from a different source: GeckoTerminal
       reports them, the Worker cannot ask, so they arrive by probe and every
       collector pass in between inserts a row with the columns empty. Reading
       the newest row alone printed "? / ?" for a pool this worker is itself
       trading in — the one number a reader would most want to check us on. */
    const t = await env.DB.prepare(
      `SELECT buys_24h, sells_24h, vol_24h, COALESCE(trades_at, sampled_at) AS at
         FROM market_samples WHERE arm = ?1 AND buys_24h IS NOT NULL ORDER BY id DESC LIMIT 1`,
    ).bind(r.id).first<Record<string, unknown>>();
    if (sample) {
      sample.holders = h?.holders ?? null;
      sample.holders_at = h?.at ?? null;
      sample.buys_24h = t?.buys_24h ?? null;
      sample.sells_24h = t?.sells_24h ?? null;
      sample.vol_24h = t?.vol_24h ?? sample.vol_24h ?? null;
      sample.trades_at = t?.at ?? null;
    }

    /* the checks grid for this arm */
    const start = await env.DB.prepare(
      `SELECT MIN(date(checked_at)) AS d FROM flag_checks WHERE arm = ?1`,
    ).bind(r.id).first<string>("d");
    /* Both arms are measured: the published entry compares a structurally
       clean token against one carrying real red flags, and half a comparison
       is worse than none. */
    const measured = true;
    const grid = [];
    for (const source of SOURCE_ORDER) {
      const now = await env.DB.prepare(
        `SELECT ok, value, checked_at FROM flag_checks WHERE arm = ?1 AND source = ?2
          ORDER BY id DESC LIMIT 1`,
      ).bind(r.id, source).first<{ ok: number; value: string | null; checked_at: string }>();
      const days = await env.DB.prepare(
        `SELECT date(checked_at) AS d,
                MAX(CASE WHEN changed = 1 THEN 1 ELSE 0 END) AS ch,
                MAX(ok) AS anyok
           FROM flag_checks WHERE arm = ?1 AND source = ?2 GROUP BY date(checked_at) ORDER BY d ASC`,
      ).bind(r.id, source).all<{ d: string; ch: number; anyok: number }>();
      const cells = start ? days.results.map((row) => ({
        day: dayIndex(start, row.d),
        state: row.ch ? "changed" : row.anyok ? "same" : "missing",
      })) : [];
      grid.push({
        source, asks: SOURCE_ASKS[source] ?? "",
        now: now ? { value: now.value, ok: now.ok === 1, at: now.checked_at } : null,
        cells,
      });
    }

    arms.push({
      id: r.id, label: r.label, wallet: r.wallet, token: r.token, pool: r.pool,
      enabled: w?.enabled !== 0, halted: w?.halted === 1, halt_reason: w?.halt_reason ?? null,
      started_at: w?.started_at ?? null, start_price: w?.start_price ?? null,
      usdc_spent: w?.usdc_spent ?? "0", next_fire_at: w?.next_fire_at ?? null,
      usdc_balance: w?.usdc_balance ?? null, token_balance: w?.token_balance ?? null,
      stop: r.stop, guards: r.guards, market: sample ?? null, measured, checks: grid,
      /* What the published rule yields at the balance and price printed on the
         same page — not a claim about a trade that has not happened. The size
         is drawn at fire time, so only its range is knowable; the range itself
         moves, because it is clamped to a share of the pool. Anyone can redo
         this arithmetic from the figures on the card, which is the point. */
      ...nextByRule(r, w, sample),
    });
  }

  const trades = await env.DB.prepare(
    `SELECT id, arm, side, usdc_amount, delay_min, trigger_usdc, price_before, price_after,
            fdv_after, reserve_usdc_after, token_amount, usdc_settled, tx_hash, status,
            block_number, decided_at, confirmed_at, gas_wei
       FROM trades ORDER BY id DESC LIMIT ?1`,
  ).bind(limit).all<Record<string, unknown>>();

  const events = await env.DB.prepare(
    `SELECT at, arm, kind, detail FROM events ORDER BY id DESC LIMIT 60`,
  ).all<Record<string, unknown>>();

  return json({
    generated: new Date().toISOString(),
    market_open: env.MARKET_OPEN === "1",
    rules: {
      declared_at: rulesRow.declared_at, git_commit: rulesRow.git_commit,
      sha256: rulesRow.sha256, hash_ok: rulesRow.sha256 === live,
      strategy: RULES.strategy, venue: RULES.venue,
    },
    arms,
    trades: trades.results,
    events: events.results,
  }, 200, { "Cache-Control": "public, max-age=15" });
}
