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
      const key = (arm === "byko" ? env.ARM_PRIVATE_KEY_BYKO : env.ARM_PRIVATE_KEY_LUKO)?.trim();
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
    const [lower, upper] = RULES.strategy.band_usdc;

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
      `SELECT started_at, start_price, usdc_spent FROM wallets WHERE address = ?1`,
    ).bind(r.wallet).first<{ started_at: string | null; start_price: string | null; usdc_spent: string }>();
    const startPrice = row?.start_price ? Number(row.start_price) : null;
    const spent = row?.usdc_spent ? Number(row.usdc_spent) : 0;

    if (startPrice && startPrice > 0) {
      const dev = Math.abs(price - startPrice) / startPrice * 100;
      if (dev > r.guards.max_price_deviation_pct) {
        await halt(env, r.wallet, arm, `price-deviation ${dev.toFixed(1)}%`);
        return;
      }
    }
    if (spent > r.guards.max_gross_usdc) {
      await halt(env, r.wallet, arm, `spend-cap ${spent.toFixed(2)}`);
      return;
    }

    /* someone else moved the pool since our last trade: skip this fire */
    const lastRes = await env.DB.prepare(
      `SELECT reserve_usdc_after FROM trades WHERE arm = ?1 AND reserve_usdc_after IS NOT NULL
        ORDER BY id DESC LIMIT 1`,
    ).bind(arm).first<string>("reserve_usdc_after");
    if (lastRes) {
      const prev = Number(lastRes);
      const jump = prev > 0 ? Math.abs(Number(reserves.usdc) - prev) / prev * 100 : 0;
      if (jump > r.guards.max_reserve_jump_pct) {
        await event(env, arm, "skip", `reserve jump ${jump.toFixed(1)}% — not trading into an unknown move`);
        await this.reschedule(r.wallet);
        return;
      }
    }

    /* stop conditions (byko only): max days, or the flag actually cleared */
    if (row?.started_at && r.stop.max_days != null) {
      const days = (Date.now() - Date.parse(row.started_at + "Z")) / 86_400_000;
      if (days >= r.stop.max_days) { await halt(env, r.wallet, arm, `max-days ${r.stop.max_days}`); return; }
    }
    if (r.stop.on_signal_cleared && await this.signalCleared(arm)) {
      await halt(env, r.wallet, arm, "signal-cleared");
      return;
    }

    /* --- decide the trade ---
       Hysteresis, not a pivot. A single threshold makes every trade near it
       reverse direction, so the wallet alternates buy/sell/buy/sell like a
       metronome — the most machine-shaped pattern available. A band keeps the
       current direction until the balance leaves it, which gives runs of one
       to three trades the same way an ordinary trader's day does. */
    const prev = await env.DB.prepare(
      `SELECT direction FROM wallet_state WHERE address = ?1`,
    ).bind(r.wallet).first<string>("direction");
    let side: "buy" | "sell" = prev === "sell" ? "sell" : "buy";
    if (usdcWhole > upper) side = "buy";
    else if (usdcWhole < lower) side = "sell";
    await env.DB.prepare(
      `UPDATE wallet_state SET direction = ?2 WHERE address = ?1`,
    ).bind(r.wallet, side).run();
    const size = uniform(RULES.strategy.trade_usdc[0], RULES.strategy.trade_usdc[1]);

    let inputToken: Address;
    let amountIn: bigint;
    if (side === "buy") {
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
        await halt(env, r.wallet, arm, arm === "luko" ? "funds-withdrawn" : "token-dust");
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
    const rt = route(inputToken, side === "buy" ? token : quote, RULES.venue.stable, RULES.venue.factory);
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
      arm, r.wallet, token, side, size.toFixed(6), 0, usdcWhole.toFixed(6),
      price.toPrecision(12), String(reserves.token), String(reserves.usdc),
      String(amountIn), String(minOut), nonce, hash,
    ).run();

    /* first trade marks the arm's start (for the day/deviation stops) */
    if (!row?.started_at) {
      await env.DB.prepare(
        `UPDATE wallets SET started_at = datetime('now'), start_price = ?2 WHERE address = ?1`,
      ).bind(r.wallet, price.toPrecision(12)).run();
    }
    if (side === "buy") {
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

    /* set delay_min on the row we just wrote, then schedule the next fire */
    const delayMin = uniform(RULES.strategy.interval_minutes[0], RULES.strategy.interval_minutes[1]);
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

  private async reschedule(wallet: string, ms = 0): Promise<void> {
    const delay = ms > 0 ? ms : uniform(RULES.strategy.interval_minutes[0], RULES.strategy.interval_minutes[1]) * 60_000;
    const at = Date.now() + delay;
    await this.state.storage.setAlarm(at);
    await this.env.DB.prepare(
      `UPDATE wallet_state SET next_fire_at = ?2, updated_at = datetime('now') WHERE address = ?1`,
    ).bind(wallet, new Date(at).toISOString()).run();
  }
}
