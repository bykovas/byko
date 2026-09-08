import {
  getAddress, keccak256, parseUnits, type Address, type Hex, type PublicClient,
} from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import type { DurableObjectState, Env } from "../types";
import {
  account, wallet, reader, readReserves, priceFrom, route, swapData, approveData,
  ERC20_ABI, ROUTER_ABI, type Reserves,
} from "../lib/chain";
import { RULES, armRules, rulesHash } from "../lib/rules";
import { event, halt } from "../lib/db";

/* One instance per arm ("byko" | "luko"), created by idFromName. It owns that
 * arm's money and the alarm that paces it. Everything that can move funds runs
 * inside the alarm, single-threaded by the DO. The invariant is app227's: the
 * trade row, with its tx hash, is written BEFORE the broadcast, and a broadcast
 * failure is never marked 'failed' here — the confirmer resolves it. */

const MIN_GAS_WEI = parseUnits("0.00002", 18);   /* a swap's worth of gas on Base */
const APPROVE_MAX = (1n << 256n) - 1n;
const DEADLINE_S = 300n;

function uniform(lo: number, hi: number): number {
  const u = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
  return lo + u * (hi - lo);
}

function logUniform(lo: number, hi: number): number {
  if (!(lo > 0) || !(hi > lo)) return uniform(Math.min(lo, hi), Math.max(lo, hi));
  const u = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
  return lo * Math.exp(u * Math.log(hi / lo));
}

/* Every published probability is thrown by the same CSPRNG as the sizes. */
function chance(pct: number): boolean {
  return pct > 0 && uniform(0, 100) < pct;
}

/* TWELFTH AMENDMENT: cadence is a MODE, drawn by published weight and held for
   a drawn number of fires. Waits drawn i.i.d. from one distribution have an
   even texture; a real tape clusters — bursts of trades, then silence. Holding
   a mode across several fires is what produces that clustering. */
function drawMode(): { id: string; left: number } {
  const modes = RULES.strategy.modes;
  const total = modes.reduce((sum, m) => sum + m.weight, 0);
  let u = uniform(0, total);
  for (const m of modes) {
    u -= m.weight;
    if (u <= 0) return { id: m.id, left: Math.max(1, Math.round(uniform(m.fires[0], m.fires[1]))) };
  }
  const last = modes[modes.length - 1];
  return { id: last.id, left: Math.max(1, Math.round(uniform(last.fires[0], last.fires[1]))) };
}

/* SEVENTH AMENDMENT still holds, now inside the mode's own bounds: log-uniform,
   so every doubling of the wait is equally likely within the mode. */
function drawDelayMin(modeId: string | null): number {
  const modes = RULES.strategy.modes;
  const m = modes.find((x) => x.id === modeId) ?? modes[0];
  const [lo, hi] = m.interval_minutes;
  const drawn = RULES.strategy.interval_curve === "log-uniform" ? logUniform(lo, hi) : uniform(lo, hi);
  return capGap(drawn);
}

/* THIRTEENTH AMENDMENT: a hard ceiling on any wait. The twelfth's quiet mode
   was 4-24h held for up to six fires, which could silence an arm for two days —
   and for a token that trades in order to show sustained two-sided trading, a
   dead chart is a worse failure than the metronome it replaced. */
function capGap(minutes: number): number {
  const cap = RULES.strategy.max_gap_minutes;
  return cap > 0 ? Math.min(minutes, cap) : minutes;
}

/* A skip means "not this alarm", not "sleep another cycle": it draws its own
   short wait instead of the current mode's, which used to stack. */
function drawSkipWaitMin(): number {
  const [lo, hi] = RULES.strategy.skip_wait_minutes;
  return capGap(logUniform(lo, hi));
}

/* A run's cash target, drawn BEFORE the run's first trade and written to
   wallet_state, exactly as run_target_pct was: the figure is committed in
   advance and published, not chosen once the outcome is known. A sell run aims
   up into run_ceiling_usdc, a buy run down into run_floor_usdc; the run ends on
   the trade that CROSSES the target, so the overshoot varies by itself. The
   0.75 gap keeps the target far enough from the balance to be a run at all. */
function drawRunTarget(side: "buy" | "sell", balance: number): number {
  const [floorLo, floorHi] = RULES.strategy.run_floor_usdc;
  const [ceilLo, ceilHi] = RULES.strategy.run_ceiling_usdc;
  if (side === "sell") {
    const lo = balance + 0.75;
    let hi = uniform(ceilLo, ceilHi);
    if (hi < lo + 0.5) hi = lo + uniform(1, 5);
    return uniform(lo, hi);
  }
  const hi = balance - 0.75;
  if (hi <= floorLo) return floorLo;
  let lo = uniform(floorLo, floorHi);
  if (lo > hi - 0.5) lo = Math.max(floorLo, hi - uniform(1, 5));
  return uniform(lo, hi);
}

export class ArmLock {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  /* Control surface, called only by the worker (itself behind ADMIN_TOKEN). */
  async fetch(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as { op?: string; arm?: string };
    if (body.op === "arm" && body.arm) {
      await this.state.storage.deleteAlarm().catch(() => undefined);
      await this.state.blockConcurrencyWhile(async () => {
        await (this.state.storage as unknown as { put(k: string, v: unknown): Promise<void> })
          .put("arm", body.arm);
      });
      /* first fire soon, but not instantly — lets a fresh deploy settle */
      await this.state.storage.setAlarm(Date.now() + 30_000);
      return Response.json({ armed: body.arm });
    }
    if (body.op === "halt") {
      await this.state.storage.deleteAlarm().catch(() => undefined);
      const arm = await this.armId();
      if (arm) {
        const r = armRules(arm);
        if (r) await halt(this.env, r.wallet, arm, "manual");
      }
      return Response.json({ halted: true });
    }
    return Response.json({ arm: await this.armId() });
  }

  private async armId(): Promise<string | null> {
    const s = this.state.storage as unknown as { get<T>(k: string): Promise<T | undefined> };
    return (await s.get<string>("arm")) ?? null;
  }

  /* the trade cycle */
  async alarm(): Promise<void> {
    const env = this.env;
    const arm = await this.armId();
    if (!arm) return;
    const rules = armRules(arm);
    if (!rules) return;

    try {
      /* 1. the parameters must match what is published and hashed */
      const liveHash = await rulesHash();
      const stored = await env.DB.prepare(`SELECT sha256 FROM rules WHERE id = 1`).first<string>("sha256");
      if (!stored || stored !== liveHash) {
        await event(env, arm, "rules-mismatch", `live ${liveHash.slice(0, 12)} vs stored ${(stored ?? "none").slice(0, 12)}`);
        await halt(env, rules.wallet, arm, "rules-mismatch");
        return;
      }

      /* 2. the kill switch gates SENDING; when off, halt cleanly and wait to be re-armed */
      if (env.MARKET_OPEN !== "1") {
        await halt(env, rules.wallet, arm, "killswitch");
        return;
      }

      /* 3. already halted? nothing to do */
      const st = await env.DB.prepare(
        `SELECT halted FROM wallet_state WHERE address = ?1`,
      ).bind(rules.wallet).first<number>("halted");
      if (st === 1) return;

      /* 4. the key for this arm */
      /* One secret per arm, ARM_PRIVATE_KEY_<ID in caps>. The ternary this
         replaces knew exactly two arms and would have handed a third arm luko's
         key: the address check below would still have caught it, but as a
         key-mismatch rather than as the missing secret it actually is. */
      const keyName = `ARM_PRIVATE_KEY_${arm.toUpperCase().replace(/[^A-Z0-9]/g, "_")}` as const;
      const key = env[keyName]?.trim();
      if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
        await halt(env, rules.wallet, arm, "no-key");
        return;
      }
      const acct = account(key);
      if (acct.address.toLowerCase() !== rules.wallet.toLowerCase()) {
        await event(env, arm, "error", "key does not match declared wallet");
        await halt(env, rules.wallet, arm, "key-mismatch");
        return;
      }

      await this.cycle(arm, rules, acct);
    } catch (err) {
      /* unexpected: record it and reschedule a fresh delay rather than let the
         platform retry-storm the alarm */
      await event(env, arm, "error", String((err as Error)?.message ?? err).slice(0, 300));
      await this.reschedule(rules.wallet);
    }
  }

  private async cycle(arm: string, rules: ReturnType<typeof armRules> & object, acct: PrivateKeyAccount): Promise<void> {
    const env = this.env;
    const r = rules as NonNullable<ReturnType<typeof armRules>>;
    const rd = reader(env);
    const wl = wallet(env, acct);

    const token = getAddress(r.token.toLowerCase());
    const quote = getAddress(RULES.venue.quote.toLowerCase());
    const router = getAddress(RULES.venue.router.toLowerCase());
    /* TWELFTH AMENDMENT: the fixed band is gone. What remains of it is the
       self-funding envelope — the outer values of the two target ranges. */
    const [floorLo, floorHi] = RULES.strategy.run_floor_usdc;
    const [ceilLo, ceilHi] = RULES.strategy.run_ceiling_usdc;
    const typicalCeiling = (ceilLo + ceilHi) / 2;

    /* read state */
    const [usdcBal, tokenBal, gas, reserves] = await Promise.all([
      rd.readContract({ address: quote, abi: ERC20_ABI, functionName: "balanceOf", args: [acct.address] }) as Promise<bigint>,
      rd.readContract({ address: token, abi: ERC20_ABI, functionName: "balanceOf", args: [acct.address] }) as Promise<bigint>,
      rd.getBalance({ address: acct.address }),
      readReserves(rd, r.pool),
    ]);
    const price = priceFrom(reserves);
    const usdcWhole = Number(usdcBal) / 1e6;

    /* persist a fresh state snapshot regardless of what happens next */
    await env.DB.prepare(
      `UPDATE wallet_state SET usdc_balance = ?2, token_balance = ?3, updated_at = datetime('now')
        WHERE address = ?1`,
    ).bind(r.wallet, String(usdcBal), String(tokenBal)).run();

    /* --- guards and stops --- */
    if (gas < MIN_GAS_WEI) {
      /* for luko this is exactly how the owner stops it: take the money out */
      await halt(env, r.wallet, arm, arm === "luko" ? "funds-withdrawn" : "insufficient-gas");
      return;
    }

    const row = await env.DB.prepare(
      `SELECT started_at, usdc_spent FROM wallets WHERE address = ?1`,
    ).bind(r.wallet).first<{ started_at: string | null; usdc_spent: string }>();
    const spent = row?.usdc_spent ? Number(row.usdc_spent) : 0;

    /* The only ceiling left is total gross spend — a hard money cap, not a
       price one. NINTH AMENDMENT: the price is out of every decision now (see
       the band below and rules.json), so nothing reads start_price for a
       deviation and there is no per-trade price guard to trip. */
    if (spent > r.guards.max_gross_usdc) {
      await halt(env, r.wallet, arm, `spend-cap ${spent.toFixed(2)}`);
      return;
    }

    /* The reserve-jump skip is gone (eighth amendment): it compared the pool's
       USDC reserve against the level after this arm's own last trade and
       skipped on a move past the limit, but the baseline only advanced on a
       trade, so any large legitimate change (a real buyer taking a chunk out of
       the pool — the experiment succeeding) locked the arm out for good. The
       price-deviation guard that used to sit here is gone too (ninth
       amendment); the band alone decides direction. */

    /* stop conditions (byko only): max days, or the flag actually cleared */
    if (row?.started_at && r.stop.max_days != null) {
      const days = (Date.now() - Date.parse(row.started_at + "Z")) / 86_400_000;
      if (days >= r.stop.max_days) { await halt(env, r.wallet, arm, `max-days ${r.stop.max_days}`); return; }
    }
    if (r.stop.on_signal_cleared && await this.signalCleared(arm)) {
      await halt(env, r.wallet, arm, "signal-cleared");
      return;
    }

    /* The band is crossed by SELLING the way up, so the wallet has to hold
       enough token value to climb from the lower bound past the upper one. A
       portfolio smaller than the upper bound cannot complete a cycle: it will
       trade a few times and then stop on token-dust, which is a true reason but
       a late one. Say it in advance instead, once. */
    /* What the token leg is worth is what the pool would actually pay for it,
       not spot times quantity. This wallet holds a visible fraction of its own
       pool's token side, so the spot figure overstates by double digits — and
       a project measuring a pool precisely because it is thin has no business
       valuing its own bag as if the pool were deep. Constant product, fee
       included, same maths the router uses. */
    const tokQty = Number(tokenBal) / 1e18;
    const poolTok = Number(reserves.token) / 1e18;
    const poolUsd = Number(reserves.usdc) / 1e6;
    const inAfterFee = tokQty * 0.997;
    const realisable = poolTok > 0 ? (poolUsd * inAfterFee) / (poolTok + inAfterFee) : 0;
    const portfolio = usdcWhole + realisable;
    if (portfolio < typicalCeiling * 1.15) {
      const said = await env.DB.prepare(
        `SELECT 1 AS x FROM events WHERE arm = ?1 AND kind = 'underfunded' LIMIT 1`,
      ).bind(arm).first<number>("x");
      if (said === null) {
        await event(env, arm, "underfunded",
          `portfolio $${portfolio.toFixed(2)} (USDC $${usdcWhole.toFixed(2)} + $${realisable.toFixed(2)} ` +
          `realisable for the token leg, not $${(tokQty * price).toFixed(2)} at spot) ` +
          `against sell targets drawn from $${ceilLo}–${ceilHi}: ` +
          `this arm cannot sell its way to a typical run's target and will stop on token-dust`);
      }
    }

    /* --- decide the trade ---
       Direction is set by cash alone, with hysteresis. Buy while the wallet
       holds more than the upper band, sell below the lower, and keep the
       current direction in between — so a run's length is set by the cash
       corridor and the drawn sizes, not by a fixed count, and not by a single
       threshold that would make every trade near it flip (a buy/sell/buy/sell
       metronome). NINTH AMENDMENT: the price is out of this decision entirely.
       A run no longer reverses on how far the pool has moved, and no trade is
       blocked (nor the arm halted) for price deviation. The bot spends the cash
       on hand to buy and sells to refill it; what that does to the quoted price
       is the experiment's output, never its input — see the note in rules.json. */
    const st = await env.DB.prepare(
      `SELECT direction, run_target_usdc, mode, mode_left FROM wallet_state WHERE address = ?1`,
    ).bind(r.wallet).first<{
      direction: string | null; run_target_usdc: string | null;
      mode: string | null; mode_left: number | null;
    }>();

    /* Cadence first: which mode are we in? The mode is held across several
       fires, so gaps cluster into bursts and silences instead of arriving
       independently. Drawn by published weight, written down before it is used. */
    let modeId = st?.mode ?? null;
    let modeLeft = st?.mode_left ?? 0;
    if (!modeId || modeLeft <= 0) {
      const drawn = drawMode();
      modeId = drawn.id;
      modeLeft = drawn.left;
      await env.DB.prepare(
        `UPDATE wallet_state SET mode = ?2, mode_left = ?3 WHERE address = ?1`,
      ).bind(r.wallet, modeId, modeLeft).run();
      await event(env, arm, "mode",
        `cadence mode ${modeId} for the next ${modeLeft} fire(s) — drawn from the published weights`);
    }

    /* A published skip: the alarm fires and no trade is made. Trading on every
       single alarm is itself a pattern. */
    if (chance(RULES.strategy.skip_pct ?? 0)) {
      const skipWait = drawSkipWaitMin();
      await event(env, arm, "skip",
        `alarm fired, no trade — drawn at ${RULES.strategy.skip_pct}%; ` +
        `next look in ${skipWait.toFixed(1)}m (a skip does not sleep a whole ${modeId} wait)`);
      await env.DB.prepare(
        `UPDATE wallet_state SET mode_left = ?2 WHERE address = ?1`,
      ).bind(r.wallet, Math.max(0, modeLeft - 1)).run();
      await this.reschedule(r.wallet, skipWait * 60_000);
      return;
    }

    /* TWELFTH AMENDMENT: instead of two fixed band bounds, each run carries its
       own drawn cash target — a sell run aims up into run_ceiling_usdc, a buy
       run down into run_floor_usdc — and the run turns on the trade that
       CROSSES it. Amplitude and reversal level differ every run, which a fixed
       band could never do. */
    const prev = st?.direction === "sell" || st?.direction === "buy" ? st.direction : null;
    const storedTarget = st?.run_target_usdc != null ? Number(st.run_target_usdc) : NaN;
    let side: "buy" | "sell" = prev ?? (usdcWhole > (floorHi + ceilLo) / 2 ? "buy" : "sell");
    let newRun = prev === null || !Number.isFinite(storedTarget);
    let reason = newRun ? "no run on record" : "";

    if (!newRun) {
      if (side === "sell" && usdcWhole >= storedTarget) {
        side = "buy"; newRun = true;
        reason = `sell run crossed its $${storedTarget.toFixed(2)} target`;
      } else if (side === "buy" && usdcWhole <= storedTarget) {
        side = "sell"; newRun = true;
        reason = `buy run crossed its $${storedTarget.toFixed(2)} target`;
      } else if (chance(RULES.strategy.early_reversal_pct ?? 0)) {
        side = side === "buy" ? "sell" : "buy"; newRun = true;
        reason = `early reversal — drawn at ${RULES.strategy.early_reversal_pct}%, ` +
          `the $${storedTarget.toFixed(2)} target is abandoned`;
        await event(env, arm, "early-reversal", reason);
      }
    }

    /* What is left of the band: the self-funding envelope. Never start a buy
       run below the floor range, never a sell run above the ceiling range. */
    if (newRun) {
      if (side === "buy" && usdcWhole <= floorLo) side = "sell";
      else if (side === "sell" && usdcWhole >= ceilHi) side = "buy";
    }

    let runTarget = storedTarget;
    if (newRun) {
      runTarget = drawRunTarget(side, usdcWhole);
      await env.DB.prepare(
        `UPDATE wallet_state SET direction = ?2, run_target_usdc = ?3 WHERE address = ?1`,
      ).bind(r.wallet, side, runTarget.toFixed(6)).run();
      await event(env, arm, "run-start",
        `${side} run begins — cash $${usdcWhole.toFixed(2)}, target $${runTarget.toFixed(2)} ` +
        `(${reason || "reversal"}); the target is drawn and written before the run's first trade`);
    } else {
      await env.DB.prepare(
        `UPDATE wallet_state SET direction = ?2 WHERE address = ?1`,
      ).bind(r.wallet, side).run();
    }

    /* SIXTH AMENDMENT: one trade in five runs against its own run. A pure run
       process can never print a lone contrarian trade — direction changes only
       at a reversal — and the ledger showed it: neat alternating stretches a
       spreadsheet could have generated. The coin is thrown by the same CSPRNG
       as every other draw, at the published contrarian_pct, and every
       contrarian trade names itself in the events log. It fires only inside the
       band (outside, the corrective side is forced and noise would un-force it)
       and only when the opposite leg can fund a trade at all. NINTH AMENDMENT:
       the "within the deviation guard's limit" condition is gone with the guard
       itself — price no longer gates the coin. */
    let tradeSide: "buy" | "sell" = side;
    const cp = RULES.strategy.contrarian_pct ?? 0;
    /* TWELFTH AMENDMENT: "inside the band" becomes "comfortably inside the
       envelope" — near either edge the corrective side is forced, and noise
       there would un-force it. */
    const insideEnvelope = usdcWhole > floorHi && usdcWhole < ceilLo;
    if (cp > 0 && insideEnvelope && chance(cp)) {
      const flipped: "buy" | "sell" = side === "buy" ? "sell" : "buy";
      const fundable = flipped === "buy"
        ? Number(usdcBal) / 1e6 >= 0.40
        : price > 0 && (Number(tokenBal) / 1e18) * price >= 0.40;
      if (fundable) {
        tradeSide = flipped;
        await event(env, arm, "contrarian",
          `run is ${side}, this trade goes ${flipped} — drawn at ${cp}%, run and target unchanged`);
      }
    }

    /* $9 was 6% of this pool and moved the price about 12% in one trade, which
       spends a whole run in a single step; the same $9 against a deep pool
       would be invisible. The cap scales the instrument to what it measures.
       FIFTH AMENDMENT: the draw happens over the effective range, not before
       it. Drawing from [0.30, 9] and clamping after put 62% of all draws
       exactly at the cap — the ledger printed 3.61, 3.57, 3.49 in a row and
       called it random, while the page published "drawn from $0.30–3.61".
       Now the draw is uniform over what the page says it is. The cap keeps
       the last word for the corner where the pool shrinks below the minimum
       mid-flight. */
    const poolUsdcNow = Number(reserves.usdc) / 1e6;
    const cap = poolUsdcNow * RULES.strategy.max_trade_pct_pool / 100;
    const sizeLo = RULES.strategy.trade_usdc[0];
    let sizeHi = RULES.strategy.trade_usdc[1];
    if (cap > 0 && cap < sizeHi) sizeHi = cap;
    /* TWELFTH AMENDMENT: the draw over that effective range becomes LOG-UNIFORM.
       Uniform has a flat profile — no tail — and a tape of evenly sized trades
       reads as generated. Log-uniform gives many small trades and few large
       ones, which is the shape real flow has. A published spike coin can send a
       single trade up near the cap. */
    const hiEff = Math.max(sizeHi, sizeLo);
    let size = RULES.strategy.size_curve === "log-uniform"
      ? logUniform(sizeLo, hiEff)
      : uniform(sizeLo, hiEff);
    if (chance(RULES.strategy.spike_pct ?? 0)) {
      size = uniform(hiEff * 0.8, hiEff);
      await event(env, arm, "spike",
        `size drawn near the cap ($${size.toFixed(2)} of $${hiEff.toFixed(2)}) — ` +
        `drawn at ${RULES.strategy.spike_pct}%`);
    }
    if (cap > 0 && size > cap) size = cap;

    let inputToken: Address;
    let amountIn: bigint;
    if (tradeSide === "buy") {
      inputToken = quote;
      amountIn = parseUnits(size.toFixed(6), 6);
      const cap = (usdcBal * 999n) / 1000n;
      if (amountIn > cap) amountIn = cap;
      if (amountIn < parseUnits("0.10", 6)) { await halt(env, r.wallet, arm, "usdc-dust"); return; }
    } else {
      inputToken = token;
      const tokens = price > 0 ? size / price : 0;
      amountIn = parseUnits(tokens.toFixed(6), 18);
      const cap = (tokenBal * 999n) / 1000n;
      if (amountIn > cap) amountIn = cap;
      const dustTokens = price > 0 ? 0.10 / price : 0;
      if (amountIn < parseUnits(dustTokens.toFixed(6), 18)) {
        /* Running out of tokens to sell is not the owner taking the money out.
           Only the gas check can mean that. Naming this 'funds-withdrawn' would
           put a false claim about a person into a public log. */
        await halt(env, r.wallet, arm, "token-dust");
        return;
      }
    }

    /* --- allowance: approve once, then trade on the NEXT fire (no nonce race) --- */
    const allowance = await rd.readContract({
      address: inputToken, abi: ERC20_ABI, functionName: "allowance", args: [acct.address, router],
    }) as bigint;
    if (allowance < amountIn) {
      const nonce = await rd.getTransactionCount({ address: acct.address, blockTag: "pending" });
      const req = await wl.prepareTransactionRequest({
        account: acct, to: inputToken, data: approveData(router, APPROVE_MAX), nonce,
      } as never);
      const signed = await wl.signTransaction(req as never);
      const hash = keccak256(signed);
      await event(env, arm, "approve", `${inputToken} -> router ${hash}`);
      await wl.sendRawTransaction({ serializedTransaction: signed }).catch(() => undefined);
      await this.reschedule(r.wallet, 60_000);   /* let it confirm before trading */
      return;
    }

    /* --- quote, then pre-sign the swap --- */
    const rt = route(inputToken, tradeSide === "buy" ? token : quote, RULES.venue.stable, RULES.venue.factory);
    const amounts = await rd.readContract({
      address: router, abi: ROUTER_ABI, functionName: "getAmountsOut", args: [amountIn, [rt]],
    }) as readonly bigint[];
    const expectedOut = amounts[amounts.length - 1];
    const minOut = (expectedOut * BigInt(10000 - RULES.strategy.slippage_bps)) / 10000n;

    const nonce = await rd.getTransactionCount({ address: acct.address, blockTag: "pending" });
    const deadline = BigInt(Math.floor(Date.now() / 1000)) + DEADLINE_S;
    const data = swapData(amountIn, minOut, rt, acct.address, deadline);
    const req = await wl.prepareTransactionRequest({ account: acct, to: router, data, nonce } as never);
    const signed = await wl.signTransaction(req as never);
    const hash = keccak256(signed);

    /* the record precedes the money */
    await env.DB.prepare(
      `INSERT INTO trades
         (arm, wallet, token, decided_at, side, usdc_amount, delay_min, trigger_usdc,
          price_before, reserve_token_before, reserve_usdc_before, amount_in, min_out,
          nonce, tx_hash, status, broadcast_at)
       VALUES (?1,?2,?3,datetime('now'),?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,'pending',datetime('now'))`,
    ).bind(
      arm, r.wallet, token, tradeSide, size.toFixed(6), 0, usdcWhole.toFixed(6),
      price.toPrecision(12), String(reserves.token), String(reserves.usdc),
      String(amountIn), String(minOut), nonce, hash,
    ).run();

    /* first trade marks the arm's start (for the max-days stop); start_price is
       kept only as a historical record now — nothing reads it for a guard */
    if (!row?.started_at) {
      await env.DB.prepare(
        `UPDATE wallets SET started_at = datetime('now'), start_price = ?2 WHERE address = ?1`,
      ).bind(r.wallet, price.toPrecision(12)).run();
    }
    if (tradeSide === "buy") {
      await env.DB.prepare(
        `UPDATE wallets SET usdc_spent = ?2 WHERE address = ?1`,
      ).bind(r.wallet, (spent + size).toFixed(6)).run();
    }

    try {
      await wl.sendRawTransaction({ serializedTransaction: signed });
    } catch (err) {
      /* the hash is on record; the confirmer owns this row's fate now */
      await event(env, arm, "error", `broadcast: ${String((err as Error)?.message ?? err).slice(0, 200)}`);
    }

    /* set delay_min on the row we just wrote, then schedule the next fire.
       TWELFTH AMENDMENT: the wait comes from the mode this arm is holding, and
       a published double coin can bring the next fire in seconds instead — a
       mini burst that no single-distribution draw would produce. A double does
       not consume one of the mode's fires; it is an extra one inside it. */
    let delayMin: number;
    if (chance(RULES.strategy.double_pct ?? 0)) {
      const [dLo, dHi] = RULES.strategy.double_seconds;
      const seconds = uniform(dLo, dHi);
      delayMin = seconds / 60;
      await event(env, arm, "double",
        `next fire in ${Math.round(seconds)}s instead of the ${modeId} wait — ` +
        `drawn at ${RULES.strategy.double_pct}%`);
    } else {
      delayMin = drawDelayMin(modeId);
      await env.DB.prepare(
        `UPDATE wallet_state SET mode_left = ?2 WHERE address = ?1`,
      ).bind(r.wallet, Math.max(0, modeLeft - 1)).run();
    }
    await env.DB.prepare(
      `UPDATE trades SET delay_min = ?2 WHERE tx_hash = ?1`,
    ).bind(hash, delayMin).run();
    await this.reschedule(r.wallet, delayMin * 60_000);
  }

  /* the byko arm's two declared exits, read from what the collector recorded */
  private async signalCleared(arm: string): Promise<boolean> {
    const env = this.env;
    const price = await env.DB.prepare(
      `SELECT ok, value FROM flag_checks WHERE arm = ?1 AND source = 'metamask-price'
        ORDER BY id DESC LIMIT 1`,
    ).bind(arm).first<{ ok: number; value: string | null }>();
    /* A cleared machine signal means a real, positive quote — not merely "the
       response was not a 500". The collector writes anything that is not a
       price as `no-price:<status>`, which parses to NaN and can never pass. */
    if (price && price.ok === 1 && price.value) {
      const quoted = Number(price.value);
      if (Number.isFinite(quoted) && quoted > 0) return true;
    }

    const base = await env.DB.prepare(
      `SELECT value FROM flag_checks WHERE arm = ?1 AND source = 'base-app' AND method = 'manual'
        ORDER BY id DESC LIMIT 2`,
    ).bind(arm).all<{ value: string | null }>();
    if (base.results.length === 2 && base.results.every((x) => x.value === "clean")) return true;
    return false;
  }

  private async reschedule(wallet: string, ms = 0, modeId: string | null = null): Promise<void> {
    const delay = ms > 0 ? ms : drawDelayMin(modeId) * 60_000;
    const at = Date.now() + delay;
    await this.state.storage.setAlarm(at);
    await this.env.DB.prepare(
      `UPDATE wallet_state SET next_fire_at = ?2, updated_at = datetime('now') WHERE address = ?1`,
    ).bind(wallet, new Date(at).toISOString()).run();
  }
}
