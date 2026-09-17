import { getAddress, keccak256, parseUnits, type Address } from "viem";
import type { DurableObjectState, Env } from "../types";
import {
  account, wallet, reader, route, swapData, approveData, decodeSwap,
  ERC20_ABI, ROUTER_ABI, SWAP_TOPIC, SYNC_TOPIC,
} from "../lib/chain";
import { RULES, STABILIZER_ID, rulesHash } from "../lib/rules";
import { event } from "../lib/db";
import { rpc, big, hexBlock } from "../lib/rpc";
import { readCache, writeCache, ageOf } from "../lib/cache";

/* SIXTEENTH AMENDMENT — the stabilizer. One instance, one wallet (BYKO LP
 * Pumper). Every check_minutes its alarm:
 *
 *   1. reads every Sync in the BYKO pool since the last block it processed and
 *      classifies the transaction behind it: self (its hash is in `trades`,
 *      written before broadcast), founder (sent from the published register),
 *      outside (anything else);
 *   2. folds each one into the reference price:
 *        self, byko arm ....... carry  ref × (price after / price before)
 *        self, stabilizer ..... reset  ref = price after
 *        founder, any size .... reset
 *        outside ≥ $100 ....... reset  (a large trade sets the price)
 *        outside < $100 ....... hold   (this is what gets resisted)
 *        no swap (liquidity) .. carry
 *   3. compares the pool price with the reference and, past threshold_pct,
 *      trades the amount that takes the price back damp_pct of the way.
 *      SEVENTEENTH AMENDMENT: not at once. The first look past the band
 *      publishes an intent and calls the next look in confirm_minutes; that
 *      look trades on the deviation it then reads, or cancels the intent if
 *      the price has come back inside the band.
 *
 * It WATCHES whatever the switches say — the page is live even when it may not
 * act — and it ACTS only when the rules hash matches, the kill switch is open,
 * it is not halted, and its key is the declared wallet. Every check is a row in
 * stab_checks; every classified transaction is a row in stab_flow. The trade
 * row precedes the money, as for the arms, and the shared confirmer settles it.
 * A refusal from a node or from the register is logged and nothing advances:
 * the stabilizer never guesses who made a move. */

const S = RULES.stabilizer;
const MIN_GAS_WEI = parseUnits("0.00002", 18);
const APPROVE_MAX = (1n << 256n) - 1n;
const DEADLINE_S = 300n;
const LAG_BLOCKS = 2;              /* read a little behind the tip so every node has the logs */
const SPAN = 1000;                 /* blocks per eth_getLogs */
const SPANS_PER_TICK = 6;          /* ≈ 3.3 h of Base blocks; further behind is a catch-up tick */
const MAX_LOOKUPS = 25;            /* eth_getTransactionByHash per tick */
const REGISTER_MAX_AGE = 60 * 60_000;
const DUST_USDC = 0.10;

type Cls = "self-arm" | "self-stab" | "founder" | "outside" | "liquidity";
type Effect = "carry" | "reset" | "hold";

interface StabState {
  ref_price: string | null;
  ref_reason: string | null;
  ref_block: number | null;
  last_block: number | null;
  last_price: string | null;
  halted: number;
  halt_reason: string | null;
  intent_side: string | null;
  intent_at: string | null;
}

interface Log {
  address: string; topics: string[]; data: string;
  blockNumber: string; transactionHash: string; logIndex: string;
}

interface Check {
  block: number | null;
  ref: number | null;
  live: number | null;
  dev: number | null;
  decision: string;
  side?: string | null;
  tokenAmount?: string | null;
  usdcAmount?: string | null;
  target?: number | null;
  tx?: string | null;
  note?: string | null;
  reserves?: { token: bigint; usdc: bigint } | null;
  wallet?: { token: bigint; usdc: bigint; eth: bigint } | null;
}

const priceOf = (token: bigint, usdc: bigint) =>
  token > 0n ? (Number(usdc) / 1e6) / (Number(token) / 1e18) : 0;
const pad = (addr: string) => "0x" + addr.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const fmtPct = (x: number) => (x >= 0 ? "+" : "−") + Math.abs(x * 100).toFixed(2) + "%";
const fmtPx = (x: number) => "$" + x.toFixed(8);
const utcTime = (ts: string | null) => (ts ? ts.slice(11, 16) + " UTC" : "earlier");

/* The trade that moves a constant-product pool to `target`, fee included.
   Aerodrome sends the fee out of the pool, so the reserve grows by the input
   net of the fee and x·y = k holds on that: x' = √(k/p'), y' = √(k·p'). */
export function sizeTo(side: "buy" | "sell", tokenWhole: number, usdcWhole: number, target: number): number {
  const k = tokenWhole * usdcWhole;
  const net = 1 - S.pool_fee_bps / 10_000;
  if (side === "sell") return Math.max(0, (Math.sqrt(k / target) - tokenWhole) / net);
  return Math.max(0, (Math.sqrt(k * target) - usdcWhole) / net);
}

export class StabLock {
  private state: DurableObjectState;
  private env: Env;
  private busy = false;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  /* Control surface, reached only through the worker's authed routes. */
  async fetch(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as { op?: string };
    if (body.op === "start") {
      await this.ensureRow();
      await this.state.storage.deleteAlarm().catch(() => undefined);
      await this.schedule(15_000);
      return Response.json({ started: true });
    }
    if (body.op === "tick") {
      const result = await this.tick();
      return Response.json({ ticked: true, result });
    }
    return Response.json({ stabilizer: true });
  }

  async alarm(): Promise<void> {
    let next = S.check_minutes * 60_000;
    try {
      const r = await this.tick();
      /* after its own trade (or while one is in flight) the next look comes in
         a minute, so the page shows the pool the trade left, not the reading
         that caused it, for nine more minutes */
      if (r === "approving" || r === "sell" || r === "buy" || r === "wait") next = 60_000;
      if (r === "intent" || r === "early") next = S.confirm_minutes * 60_000;
      if (r === "catchup") next = 30_000;
    } catch (err) {
      await event(this.env, STABILIZER_ID, "error", String((err as Error)?.message ?? err).slice(0, 300));
    }
    await this.schedule(next);
  }

  private async schedule(ms: number): Promise<void> {
    const at = Date.now() + ms;
    await this.state.storage.setAlarm(at);
    await this.env.DB.prepare(
      `UPDATE stab_state SET next_check_at = ?1, updated_at = datetime('now') WHERE id = 1`,
    ).bind(new Date(at).toISOString()).run();
  }

  private async ensureRow(): Promise<void> {
    await this.env.DB.prepare(
      `INSERT OR IGNORE INTO stab_state (id, halted, updated_at) VALUES (1, 0, datetime('now'))`,
    ).run();
  }

  private async tick(): Promise<string> {
    if (this.busy) return "busy";
    this.busy = true;
    try { return await this.run(); } finally { this.busy = false; }
  }

  private async run(): Promise<string> {
    const env = this.env;
    await this.ensureRow();
    const st = await env.DB.prepare(
      `SELECT ref_price, ref_reason, ref_block, last_block, last_price, halted, halt_reason,
              intent_side, intent_at
         FROM stab_state WHERE id = 1`,
    ).first<StabState>();
    if (!st) return "no-state";

    const head = Number(big(String(await rpc(env, "eth_blockNumber", [])))) - LAG_BLOCKS;
    const reserves = await this.reservesAt(head);
    const live = priceOf(reserves.token, reserves.usdc);
    if (!(live > 0)) throw new Error("pool reserves unreadable");
    const bal = await this.balances();

    /* first ever look: the pool as it stands is the reference */
    if (st.last_block == null || st.ref_price == null) {
      await env.DB.prepare(
        `UPDATE stab_state SET ref_price = ?1, ref_reason = 'bootstrap', ref_at = datetime('now'),
           ref_block = ?2, ref_tx = NULL, last_block = ?2, last_price = ?1 WHERE id = 1`,
      ).bind(live.toPrecision(12), head).run();
      await event(env, STABILIZER_ID, "stab-reference",
        `reference set to ${fmtPx(live)} at block ${head} — bootstrap: the pool as it stood when the stabilizer first looked`);
      await this.logCheck({ block: head, ref: live, live, dev: 0, decision: "bootstrap", reserves, wallet: bal });
      return "bootstrap";
    }

    let ref = Number(st.ref_price);
    let refChanged: { reason: string; block: number; tx: string } | null = null;
    const register = await this.register();
    if (!register) {
      await this.logCheck({ block: head, ref, live, dev: live / ref - 1, decision: "skipped",
        note: "the founder register could not be read, so no move can be attributed; nothing advances", reserves, wallet: bal });
      return "skipped";
    }

    /* 1. the pool's history since the last look */
    const from = st.last_block + 1;
    let to = Math.min(head, st.last_block + SPAN * SPANS_PER_TICK);
    let logs: Log[] = [];
    try {
      for (let a = from; a <= to; a += SPAN) {
        const b = Math.min(to, a + SPAN - 1);
        const part = (await rpc(env, "eth_getLogs", [{
          address: S.pool, fromBlock: hexBlock(a), toBlock: hexBlock(b),
          topics: [[SYNC_TOPIC, SWAP_TOPIC]],
        }])) as Log[];
        logs = logs.concat(part);
      }
    } catch (err) {
      await this.logCheck({ block: head, ref, live, dev: live / ref - 1, decision: "skipped",
        note: `pool logs unreadable (${String((err as Error)?.message ?? err).slice(0, 80)}); nothing advances`, reserves, wallet: bal });
      return "skipped";
    }
    logs.sort((x, y) => Number(big(x.blockNumber) - big(y.blockNumber)) || Number(big(x.logIndex) - big(y.logIndex)));

    /* 2. whose transactions are these */
    const txOrder: string[] = [];
    const byTx = new Map<string, Log[]>();
    for (const l of logs) {
      const h = l.transactionHash.toLowerCase();
      if (!byTx.has(h)) { byTx.set(h, []); txOrder.push(h); }
      byTx.get(h)!.push(l);
    }
    const own = new Map<string, string>();
    for (let i = 0; i < txOrder.length; i += 50) {
      const chunk = txOrder.slice(i, i + 50);
      const rows = await env.DB.prepare(
        `SELECT tx_hash, arm FROM trades WHERE tx_hash IN (${chunk.map((_, j) => `?${j + 1}`).join(",")})`,
      ).bind(...chunk).all<{ tx_hash: string; arm: string }>();
      for (const r of rows.results) own.set(r.tx_hash.toLowerCase(), r.arm);
    }
    const senders = new Map<string, string>();
    let lookups = 0;
    let cut: number | null = null;          /* first block we could not attribute */
    for (const h of txOrder) {
      if (own.has(h)) continue;
      const swaps = byTx.get(h)!.filter((l) => l.topics[0]?.toLowerCase() === SWAP_TOPIC);
      if (!swaps.length) continue;          /* liquidity only: carried, no sender needed */
      if (lookups >= MAX_LOOKUPS) { cut = Number(big(byTx.get(h)![0].blockNumber)); break; }
      lookups += 1;
      try {
        const tx = (await rpc(env, "eth_getTransactionByHash", [h])) as { from?: string } | null;
        if (!tx?.from) throw new Error("no sender");
        senders.set(h, tx.from.toLowerCase());
      } catch {
        cut = Number(big(byTx.get(h)![0].blockNumber));
        break;
      }
    }
    if (cut !== null) {
      to = cut - 1;
      if (to < from) {
        await this.logCheck({ block: head, ref, live, dev: live / ref - 1, decision: "skipped",
          note: "a transaction's sender could not be read; nothing advances", reserves, wallet: bal });
        return "skipped";
      }
    }

    /* 3. fold every transaction into the reference */
    let running = Number(st.last_price ?? ref);
    for (const h of txOrder) {
      const txLogs = byTx.get(h)!;
      const blockNo = Number(big(txLogs[0].blockNumber));
      if (blockNo > to) break;
      const syncs = txLogs.filter((l) => l.topics[0]?.toLowerCase() === SYNC_TOPIC);
      const swaps = txLogs.filter((l) => l.topics[0]?.toLowerCase() === SWAP_TOPIC);
      if (!syncs.length) continue;

      let usdcIn = 0n, usdcOut = 0n, tokIn = 0n, tokOut = 0n;
      let swapTo = "";
      for (const sw of swaps) {
        const d = decodeSwap(sw.data as `0x${string}`);
        usdcIn += d.a1In; usdcOut += d.a1Out; tokIn += d.a0In; tokOut += d.a0Out;
        if (sw.topics[2]) swapTo = ("0x" + sw.topics[2].slice(26)).toLowerCase();
      }
      const side = !swaps.length ? null : usdcIn > usdcOut ? "buy" : "sell";
      const usdcLeg = usdcIn > usdcOut ? usdcIn - usdcOut : usdcOut - usdcIn;
      const tokLeg = tokIn > tokOut ? tokIn - tokOut : tokOut - tokIn;

      let cls: Cls;
      const arm = own.get(h);
      if (arm) cls = arm === STABILIZER_ID ? "self-stab" : "self-arm";
      else if (!swaps.length) cls = "liquidity";
      else if (register.has(senders.get(h) ?? "") || register.has(swapTo)) cls = "founder";
      else cls = "outside";

      const large = Number(usdcLeg) / 1e6 >= S.reset_outside_usdc;
      const effect: Effect =
        cls === "self-arm" || cls === "liquidity" ? "carry"
        : cls === "outside" && !large ? "hold"
        : "reset";

      const before = running;
      for (const sy of syncs) {
        const after = priceOf(big("0x" + sy.data.slice(2, 66)), big("0x" + sy.data.slice(66, 130)));
        if (!(after > 0)) continue;
        if (effect === "carry") ref = ref * (after / running);
        else if (effect === "reset") ref = after;
        running = after;
      }
      const reason = cls === "self-stab" ? "own trade"
        : cls === "founder" ? "founder trade"
        : cls === "outside" && large ? "outside trade of $100 or more" : null;
      if (effect === "reset" && reason) refChanged = { reason, block: blockNo, tx: h };

      await env.DB.prepare(
        `INSERT OR IGNORE INTO stab_flow
           (tx_hash, block, cls, side, token_amount, usdc_amount, sender, price_before, price_after,
            effect, ref_after, at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, datetime('now'))`,
      ).bind(
        h, blockNo, cls, side, String(tokLeg), String(usdcLeg), senders.get(h) ?? null,
        before.toPrecision(12), running.toPrecision(12), effect, ref.toPrecision(12),
      ).run();

      if (cls === "outside" || cls === "founder") {
        const usd = (Number(usdcLeg) / 1e6).toFixed(2);
        await event(env, STABILIZER_ID, "stab-attribution",
          `${cls} ${side} of $${usd} in block ${blockNo} (${h}) moved the price ` +
          `${fmtPct(running / before - 1)} — ${effect === "reset"
            ? "the reference moves to the price it left"
            : "under $" + S.reset_outside_usdc + ", so the reference stays and the move counts"}`);
      }
    }

    await env.DB.prepare(
      `UPDATE stab_state SET ref_price = ?1, last_block = ?2, last_price = ?3,
         ref_reason = COALESCE(?4, ref_reason), ref_block = COALESCE(?5, ref_block),
         ref_tx = CASE WHEN ?4 IS NULL THEN ref_tx ELSE ?6 END,
         ref_at = CASE WHEN ?4 IS NULL THEN ref_at ELSE datetime('now') END
       WHERE id = 1`,
    ).bind(
      ref.toPrecision(12), to, running.toPrecision(12),
      refChanged?.reason ?? null, refChanged?.block ?? null, refChanged?.tx ?? null,
    ).run();
    if (refChanged) {
      await event(env, STABILIZER_ID, "stab-reference",
        `reference set to ${fmtPx(ref)} at block ${refChanged.block} — ${refChanged.reason} (${refChanged.tx})`);
    }

    if (to < head) {
      await this.logCheck({ block: to, ref, live: running, dev: running / ref - 1, decision: "catchup",
        note: `read the pool up to block ${to} of ${head}; no decision until the history is complete`, reserves: null, wallet: bal });
      return "catchup";
    }

    /* 4. the decision */
    const dev = live / ref - 1;
    const th = S.threshold_pct / 100;
    const intentSide = st.intent_side === "buy" || st.intent_side === "sell" ? st.intent_side : null;
    if (Math.abs(dev) <= th) {
      if (intentSide) {
        await this.setIntent(null);
        await this.logCheck({ block: head, ref, live, dev, decision: "cancelled", side: intentSide, reserves, wallet: bal,
          note: `the price is back inside the band; the ${intentSide} intent of ${utcTime(st.intent_at)} is cancelled` });
        await event(env, STABILIZER_ID, "stab-cancel",
          `${intentSide} intent of ${utcTime(st.intent_at)} cancelled — deviation now ${fmtPct(dev)}, inside ±${S.threshold_pct}%`);
        return "cancelled";
      }
      await this.logCheck({ block: head, ref, live, dev, decision: "none", reserves, wallet: bal });
      await this.approveWhileIdle(bal);
      return "none";
    }

    const side: "buy" | "sell" = dev > 0 ? "sell" : "buy";
    const target = ref * (1 + (1 - S.damp_pct / 100) * dev);
    const tokWhole = Number(reserves.token) / 1e18;
    const usdWhole = Number(reserves.usdc) / 1e6;
    const want = sizeTo(side, tokWhole, usdWhole, target);
    const wantUsd = side === "sell"
      ? usdWhole - (tokWhole * usdWhole) / (tokWhole + want * (1 - S.pool_fee_bps / 10_000))
      : want;
    const base: Check = {
      block: head, ref, live, dev, decision: "cannot", side, target,
      tokenAmount: side === "sell" ? parseUnits(want.toFixed(6), 18).toString() : null,
      usdcAmount: parseUnits(wantUsd.toFixed(6), 6).toString(),
      reserves, wallet: bal,
    };

    const pendingOwn = await env.DB.prepare(
      `SELECT t.tx_hash FROM trades t LEFT JOIN stab_flow f ON f.tx_hash = t.tx_hash
        WHERE t.arm = ?1 AND t.status != 'failed' AND f.tx_hash IS NULL
          AND t.created_at > datetime('now', '-2 hours') LIMIT 1`,
    ).bind(STABILIZER_ID).first<string>("tx_hash");
    if (pendingOwn) {
      await this.logCheck({ ...base, decision: "wait", note: `own trade ${pendingOwn} is not in the pool history yet` });
      return "wait";
    }

    /* an intent is only announced when the wallet could act on it */
    const gate = await this.gate(bal);
    if (gate) {
      await this.logCheck({ ...base, note: gate });
      return "cannot";
    }

    const fundable = side === "buy"
      ? Number(bal.usdc) / 1e6 >= DUST_USDC
      : (Number(bal.token) / 1e18) * live >= DUST_USDC;
    if (!fundable) {
      await this.logCheck({ ...base, note: side === "buy"
        ? `the wallet holds $${(Number(bal.usdc) / 1e6).toFixed(2)} USDC — it cannot buy until it has earned some by selling`
        : `the wallet holds ${(Number(bal.token) / 1e18).toFixed(0)} BYKO — nothing to sell` });
      return "cannot";
    }

    /* SEVENTEENTH AMENDMENT: announce first, act on the next look. */
    if (intentSide !== side) {
      await this.setIntent(side);
      const replaced = intentSide ? `; replaces the ${intentSide} intent of ${utcTime(st.intent_at)}` : "";
      await this.logCheck({ ...base, decision: "intent",
        note: `next look in ${S.confirm_minutes} min: ${side} if the price is still more than ${S.threshold_pct}% away, cancel if not${replaced}` });
      await event(env, STABILIZER_ID, "stab-intent",
        `deviation ${fmtPct(dev)} from ${fmtPx(ref)} — intends to ${side} about ` +
        (side === "sell" ? `${want.toFixed(0)} BYKO ($${wantUsd.toFixed(2)})` : `$${wantUsd.toFixed(2)} of BYKO`) +
        ` to land at ${fmtPct(target / ref - 1)}; confirms or cancels at the next look, in ${S.confirm_minutes} min${replaced}`);
      return "intent";
    }
    /* a look that comes early (a manual tick) neither confirms nor re-announces */
    const intentAge = st.intent_at ? Date.now() - Date.parse(st.intent_at.replace(" ", "T") + "Z") : Infinity;
    if (intentAge < (S.confirm_minutes * 60 - 30) * 1000) return "early";

    let amountIn: bigint;
    let inputToken: Address;
    const token = getAddress(S.token.toLowerCase());
    const quote = getAddress(RULES.venue.quote.toLowerCase());
    let capped = false;
    if (side === "sell") {
      inputToken = token;
      amountIn = parseUnits(want.toFixed(6), 18);
      const cap = (bal.token * 999n) / 1000n;
      if (amountIn > cap) { amountIn = cap; capped = true; }
      const valueUsd = (Number(amountIn) / 1e18) * live;
      if (valueUsd < DUST_USDC) {
        await this.logCheck({ ...base, note: `the wallet holds ${(Number(bal.token) / 1e18).toFixed(0)} BYKO — nothing to sell` });
        return "cannot";
      }
    } else {
      inputToken = quote;
      amountIn = parseUnits(want.toFixed(6), 6);
      const cap = (bal.usdc * 999n) / 1000n;
      if (amountIn > cap) { amountIn = cap; capped = true; }
      if (Number(amountIn) / 1e6 < DUST_USDC) {
        await this.logCheck({ ...base, note: `the wallet holds $${(Number(bal.usdc) / 1e6).toFixed(2)} USDC — it cannot buy until it has earned some by selling` });
        return "cannot";
      }
    }

    const key = env.STABILIZER_PRIVATE_KEY!.trim();
    const acct = account(key);
    const rd = reader(env);
    const wl = wallet(env, acct);
    const router = getAddress(RULES.venue.router.toLowerCase());

    const allowance = await rd.readContract({
      address: inputToken, abi: ERC20_ABI, functionName: "allowance", args: [acct.address, router],
    }) as bigint;
    if (allowance < amountIn) {
      await this.approve(inputToken);
      await this.logCheck({ ...base, note: "approving the router for this token; the trade follows at the next look, in about a minute" });
      return "approving";
    }

    const rt = route(inputToken, side === "buy" ? token : quote, RULES.venue.stable, RULES.venue.factory);
    const amounts = await rd.readContract({
      address: router, abi: ROUTER_ABI, functionName: "getAmountsOut", args: [amountIn, [rt]],
    }) as readonly bigint[];
    const expectedOut = amounts[amounts.length - 1];
    const minOut = (expectedOut * BigInt(10_000 - S.slippage_bps)) / 10_000n;
    const nonce = await rd.getTransactionCount({ address: acct.address, blockTag: "pending" });
    const deadline = BigInt(Math.floor(Date.now() / 1000)) + DEADLINE_S;
    const data = swapData(amountIn, minOut, rt, acct.address, deadline);
    const req = await wl.prepareTransactionRequest({ account: acct, to: router, data, nonce } as never);
    const signed = await wl.signTransaction(req as never);
    const hash = keccak256(signed);

    const usdValue = side === "sell" ? Number(expectedOut) / 1e6 : Number(amountIn) / 1e6;
    const tokenQty = side === "sell" ? amountIn : expectedOut;

    /* the record precedes the money */
    await env.DB.prepare(
      `INSERT INTO trades
         (arm, wallet, token, decided_at, side, usdc_amount, delay_min, trigger_usdc,
          price_before, reserve_token_before, reserve_usdc_before, amount_in, min_out,
          nonce, tx_hash, status, broadcast_at)
       VALUES (?1,?2,?3,datetime('now'),?4,?5,0,?6,?7,?8,?9,?10,?11,?12,?13,'pending',datetime('now'))`,
    ).bind(
      STABILIZER_ID, S.wallet, token, side, usdValue.toFixed(6), (Number(bal.usdc) / 1e6).toFixed(6),
      live.toPrecision(12), String(reserves.token), String(reserves.usdc),
      String(amountIn), String(minOut), nonce, hash,
    ).run();
    await this.logCheck({
      ...base, decision: side, tx: hash,
      tokenAmount: tokenQty.toString(),
      usdcAmount: parseUnits(usdValue.toFixed(6), 6).toString(),
      note: capped ? "capped by the wallet's balance — the full correction was larger" : null,
    });
    await event(env, STABILIZER_ID, "stab-trade",
      `${side} ${(Number(tokenQty) / 1e18).toFixed(0)} BYKO for about $${usdValue.toFixed(2)} — ` +
      `deviation ${fmtPct(dev)} from ${fmtPx(ref)}, aiming for ${fmtPx(target)} ` +
      `(${S.damp_pct}% back)${capped ? ", capped by the balance" : ""}; min out ${minOut} · ${hash}`);

    await this.setIntent(null);
    try {
      await wl.sendRawTransaction({ serializedTransaction: signed });
    } catch (err) {
      await event(env, STABILIZER_ID, "error", `broadcast: ${String((err as Error)?.message ?? err).slice(0, 200)}`);
    }
    return side;
  }

  private async setIntent(side: "buy" | "sell" | null): Promise<void> {
    await this.env.DB.prepare(
      `UPDATE stab_state SET intent_side = ?1,
         intent_at = CASE WHEN ?1 IS NULL THEN NULL ELSE datetime('now') END WHERE id = 1`,
    ).bind(side).run();
  }

  /* Why the stabilizer may not act right now, or null if it may. */
  private async gate(bal: { eth: bigint }): Promise<string | null> {
    const env = this.env;
    const live = await rulesHash();
    const stored = await env.DB.prepare(`SELECT sha256 FROM rules WHERE id = 1`).first<string>("sha256");
    if (!stored || stored !== live) return `rules hash mismatch (live ${live.slice(0, 12)}, stored ${(stored ?? "none").slice(0, 12)}) — watching only`;
    if (env.MARKET_OPEN !== "1") return "kill switch closed — watching only";
    const st = await env.DB.prepare(`SELECT halted, halt_reason FROM stab_state WHERE id = 1`)
      .first<{ halted: number; halt_reason: string | null }>();
    if (st?.halted === 1) return `halted (${st.halt_reason ?? "manual"}) — watching only`;
    const key = env.STABILIZER_PRIVATE_KEY?.trim();
    if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) return "no signing key is set — watching only";
    if (account(key).address.toLowerCase() !== S.wallet.toLowerCase()) return "the key does not match the declared wallet — watching only";
    if (bal.eth < MIN_GAS_WEI) return "the wallet is out of gas";
    return null;
  }

  /* While nothing is to be done, approve the router for whichever token still
     needs it, one per look, so the first real correction is not a minute late. */
  private async approveWhileIdle(bal: { eth: bigint }): Promise<void> {
    if (await this.gate(bal)) return;
    const acct = account(this.env.STABILIZER_PRIVATE_KEY!.trim());
    const rd = reader(this.env);
    const router = getAddress(RULES.venue.router.toLowerCase());
    for (const t of [S.token, RULES.venue.quote]) {
      const addr = getAddress(t.toLowerCase());
      const allowance = await rd.readContract({
        address: addr, abi: ERC20_ABI, functionName: "allowance", args: [acct.address, router],
      }) as bigint;
      if (allowance < APPROVE_MAX / 2n) { await this.approve(addr); return; }
    }
  }

  private async approve(tokenAddr: Address): Promise<void> {
    const acct = account(this.env.STABILIZER_PRIVATE_KEY!.trim());
    const rd = reader(this.env);
    const wl = wallet(this.env, acct);
    const router = getAddress(RULES.venue.router.toLowerCase());
    const nonce = await rd.getTransactionCount({ address: acct.address, blockTag: "pending" });
    const req = await wl.prepareTransactionRequest({
      account: acct, to: tokenAddr, data: approveData(router, APPROVE_MAX), nonce,
    } as never);
    const signed = await wl.signTransaction(req as never);
    const hash = keccak256(signed);
    await event(this.env, STABILIZER_ID, "approve", `${tokenAddr} -> router ${hash}`);
    await wl.sendRawTransaction({ serializedTransaction: signed }).catch(() => undefined);
  }

  private async reservesAt(block: number): Promise<{ token: bigint; usdc: bigint }> {
    const r = String(await rpc(this.env, "eth_call", [{ to: S.pool, data: "0x0902f1ac" }, hexBlock(block)]));
    const hex = r.slice(2);
    if (hex.length < 128) throw new Error("getReserves refused");
    return { token: big("0x" + hex.slice(0, 64)), usdc: big("0x" + hex.slice(64, 128)) };
  }

  private async balances(): Promise<{ token: bigint; usdc: bigint; eth: bigint }> {
    const call = async (to: string) => {
      const r = String(await rpc(this.env, "eth_call", [{ to, data: "0x70a08231" + pad(S.wallet).slice(2) }, "latest"]));
      if (r.length < 66) throw new Error("balanceOf refused");
      return big(r);
    };
    const eth = big(String(await rpc(this.env, "eth_getBalance", [S.wallet, "latest"])));
    return { token: await call(S.token), usdc: await call(RULES.venue.quote), eth };
  }

  /* The published register, lower-cased. A failed read falls back to the last
     good copy of any age; with no copy at all, nothing can be attributed. */
  private async register(): Promise<Set<string> | null> {
    const cached = await readCache<string[]>(this.env, "register");
    if (cached && ageOf(cached) < REGISTER_MAX_AGE) return new Set(cached.value);
    try {
      const res = await fetch(S.register, {
        headers: { "User-Agent": "byko-market/1.0 (+https://byko.bykovas.lt/stabilizer)" },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) throw new Error(`http ${res.status}`);
      const body = (await res.json()) as { wallets?: Array<{ address?: string }> };
      const list = (body.wallets ?? []).map((w) => String(w.address ?? "").toLowerCase()).filter((a) => /^0x[0-9a-f]{40}$/.test(a));
      if (!list.length) throw new Error("empty register");
      await writeCache(this.env, "register", list, S.register);
      return new Set(list);
    } catch {
      return cached ? new Set(cached.value) : null;
    }
  }

  private async logCheck(c: Check): Promise<void> {
    await this.env.DB.prepare(
      `INSERT INTO stab_checks
         (at, block, ref_price, live_price, dev_pct, decision, side, token_amount, usdc_amount,
          target_price, tx_hash, note, reserve_token, reserve_usdc, wallet_token, wallet_usdc, wallet_eth)
       VALUES (datetime('now'),?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)`,
    ).bind(
      c.block, c.ref != null ? c.ref.toPrecision(12) : null, c.live != null ? c.live.toPrecision(12) : null,
      c.dev != null ? Number((c.dev * 100).toFixed(4)) : null, c.decision, c.side ?? null,
      c.tokenAmount ?? null, c.usdcAmount ?? null, c.target != null ? c.target.toPrecision(12) : null,
      c.tx ?? null, c.note ?? null,
      c.reserves ? String(c.reserves.token) : null, c.reserves ? String(c.reserves.usdc) : null,
      c.wallet ? String(c.wallet.token) : null, c.wallet ? String(c.wallet.usdc) : null,
      c.wallet ? String(c.wallet.eth) : null,
    ).run();
  }
}
