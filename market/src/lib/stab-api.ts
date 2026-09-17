import type { Env } from "../types";
import { RULES, STABILIZER_ID } from "./rules";

/* The stabilizer's readout, served inside /api/wash. Database only — every
   figure is what the stabilizer itself read and wrote at its last look, with
   the time it looked, so the page never shows a number that nobody measured. */

interface CheckRow {
  id: number; at: string; block: number | null; ref_price: string | null; live_price: string | null;
  dev_pct: number | null; decision: string; side: string | null; token_amount: string | null;
  usdc_amount: string | null; target_price: string | null; tx_hash: string | null; note: string | null;
  reserve_token: string | null; reserve_usdc: string | null;
  wallet_token: string | null; wallet_usdc: string | null; wallet_eth: string | null;
}

const ACTED = new Set(["sell", "buy"]);

export async function stabilizerReadout(env: Env): Promise<Record<string, unknown> | null> {
  const S = RULES.stabilizer;
  let st: Record<string, unknown> | null;
  try {
    st = await env.DB.prepare(
      `SELECT ref_price, ref_reason, ref_at, ref_block, ref_tx, last_block, halted, halt_reason, next_check_at
         FROM stab_state WHERE id = 1`,
    ).first<Record<string, unknown>>();
  } catch {
    return null;   /* tables not applied yet: the page says "not started" */
  }

  /* the last look that read the whole pool (catch-up and skipped looks are
     logged but carry no complete reading) */
  const last = await env.DB.prepare(
    `SELECT * FROM stab_checks WHERE decision NOT IN ('skipped', 'catchup') ORDER BY id DESC LIMIT 1`,
  ).first<CheckRow>();
  const latest = await env.DB.prepare(
    `SELECT id, at, decision, note FROM stab_checks ORDER BY id DESC LIMIT 1`,
  ).first<{ id: number; at: string; decision: string; note: string | null }>();

  const today = await env.DB.prepare(
    `SELECT at, decision, dev_pct FROM stab_checks
      WHERE at >= date('now') AND decision != 'catchup' ORDER BY id ASC`,
  ).all<{ at: string; decision: string; dev_pct: number | null }>();

  const floor = S.log_min_deviation_pct;
  const decisions = await env.DB.prepare(
    `SELECT c.id, c.at, c.block, c.ref_price, c.live_price, c.dev_pct, c.decision, c.side,
            c.token_amount, c.usdc_amount, c.target_price, c.tx_hash, c.note,
            t.status, t.token_amount AS settled_token, t.usdc_settled, f.price_after AS landed_price
       FROM stab_checks c
       LEFT JOIN trades t ON t.tx_hash = c.tx_hash
       LEFT JOIN stab_flow f ON f.tx_hash = c.tx_hash
      WHERE c.decision != 'catchup'
        AND (c.decision IN ('sell','buy','cannot','wait','bootstrap','skipped')
             OR ABS(COALESCE(c.dev_pct, 0)) > ?1)
      ORDER BY c.id DESC LIMIT 60`,
  ).bind(floor).all<Record<string, unknown>>();

  const days = await env.DB.prepare(
    `SELECT date(at) AS day, COUNT(*) AS checks,
            SUM(CASE WHEN ABS(COALESCE(dev_pct,0)) > ?1 THEN 1 ELSE 0 END) AS outside_band,
            SUM(CASE WHEN decision IN ('sell','buy') THEN 1 ELSE 0 END) AS acted,
            SUM(CASE WHEN decision = 'cannot' THEN 1 ELSE 0 END) AS could_not
       FROM stab_checks WHERE at < date('now') AND at >= date('now', '-14 days') AND decision != 'catchup'
      GROUP BY date(at) ORDER BY day DESC`,
  ).bind(S.threshold_pct).all<Record<string, unknown>>();

  const flow = await env.DB.prepare(
    `SELECT tx_hash, block, cls, side, token_amount, usdc_amount, sender, price_before, price_after,
            effect, ref_after, at
       FROM stab_flow WHERE cls != 'self-arm' ORDER BY block DESC LIMIT 30`,
  ).all<Record<string, unknown>>();

  const events = await env.DB.prepare(
    `SELECT at, kind, detail FROM events WHERE arm = ?1 ORDER BY id DESC LIMIT 40`,
  ).bind(STABILIZER_ID).all<Record<string, unknown>>();

  const lastAction = await env.DB.prepare(
    `SELECT c.at, c.side, c.token_amount, c.usdc_amount, c.tx_hash, c.dev_pct, c.ref_price,
            t.status, t.token_amount AS settled_token, t.usdc_settled, f.price_after AS landed_price
       FROM stab_checks c
       LEFT JOIN trades t ON t.tx_hash = c.tx_hash
       LEFT JOIN stab_flow f ON f.tx_hash = c.tx_hash
      WHERE c.decision IN ('sell','buy') ORDER BY c.id DESC LIMIT 1`,
  ).first<Record<string, unknown>>();

  const ref = st?.ref_price != null ? Number(st.ref_price) : null;
  const live = last?.live_price != null ? Number(last.live_price) : null;
  const dev = ref && live ? (live / ref - 1) * 100 : null;
  const th = S.threshold_pct;
  const damp = S.damp_pct;

  /* The state the page draws. It is the last complete look, told plainly. */
  let state = "unset";
  if (!st || ref == null || !last) state = "unset";
  else if (last.decision === "sell" || last.decision === "buy") state = "acted";
  else if (last.decision === "cannot") state = "cannot";
  else if (dev != null && Math.abs(dev) > th) state = dev > 0 ? "above" : "below";
  else state = "quiet";

  const intent = last && dev != null && Math.abs(dev) > th && !ACTED.has(last.decision)
    ? {
        side: last.side,
        token: last.token_amount,
        usdc: last.usdc_amount,
        target_price: last.target_price,
        land_pct: dev * (1 - damp / 100),
        blocked: last.decision === "cannot" ? last.note : null,
      }
    : null;

  return {
    rules: S,
    halted: st?.halted === 1,
    halt_reason: st?.halt_reason ?? null,
    next_check_at: st?.next_check_at ?? null,
    state,
    reference: ref == null ? null : {
      price: ref, reason: st?.ref_reason ?? null, at: st?.ref_at ?? null,
      block: st?.ref_block ?? null, tx: st?.ref_tx ?? null,
    },
    live: last ? {
      price: live, block: last.block, at: last.at,
      reserve_token: last.reserve_token, reserve_usdc: last.reserve_usdc,
    } : null,
    deviation_pct: dev,
    intent,
    wallet: last ? { byko: last.wallet_token, usdc: last.wallet_usdc, eth: last.wallet_eth, at: last.at } : null,
    last_look: latest ?? null,
    last_action: lastAction ?? null,
    checks_today: today.results.map((c) => ({
      at: c.at,
      kind: c.decision === "sell" || c.decision === "buy" ? c.decision
        : c.decision === "cannot" ? "cannot"
        : c.decision === "skipped" ? "skipped"
        : Math.abs(c.dev_pct ?? 0) > th ? "out" : "none",
    })),
    decisions: decisions.results,
    days: days.results,
    flow: flow.results,
    events: events.results,
  };
}
