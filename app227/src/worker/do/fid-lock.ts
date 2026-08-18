import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  parseUnits,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Env } from "../../shared/types";

/* The treasury. One instance ("treasury") serialises EVERYTHING that moves
 * money: limit checks, the nonce, the send, the record. With one sender
 * wallet the nonce is a global sequence anyway, so one lock is both correct
 * and sufficient at this faucet's volume (≤ MAX_ADVANCES_PER_DAY).
 *
 * The rules it enforces, in order, all inside the lock:
 *   1. faucet is open (ADVANCES_OPEN, key present)
 *   2. one advance per wallet per UTC day      (advances.advance_date)
 *   3. five advances per wallet lifetime       (count of non-failed rows)
 *   4. global cap per day                      (MAX_ADVANCES_PER_DAY)
 *   5. ops stock above the floor               (MIN_OPS_BALANCE, on-chain read)
 *
 * The row is written BEFORE the send ('sending'): if the isolate dies midway
 * the wallet stays blocked for the day and the cron reconciles the orphan.
 * Money is only ever sent between the insert and the update. */

const ERC20_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "value", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export type AdvanceReason =
  | "not-open"
  | "already-today"
  | "lifetime-limit"
  | "faucet-cap"
  | "faucet-closed"
  | "send-failed";

export interface AdvanceOutcome {
  advanced: boolean;
  tx_hash?: string;
  reason?: AdvanceReason;
}

interface DurableObjectState {
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<boolean>;
  };
  blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T>;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export class FidLock {
  private state: DurableObjectState;
  private env: Env;
  private busy: Promise<unknown> = Promise.resolve();

  constructor(state: unknown, env: Env) {
    this.state = state as DurableObjectState;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return new Response("treasury\n", { status: 405 });
    const body = (await request.json()) as { fid?: number; address?: string };
    const fid = Number(body.fid);
    const address = typeof body.address === "string" ? body.address : "";
    if (!Number.isInteger(fid) || fid <= 0 || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return Response.json({ advanced: false, reason: "send-failed" } satisfies AdvanceOutcome, { status: 400 });
    }

    /* strict serialisation: one advance at a time, arrival order */
    const run = this.busy.then(() => this.advance(fid, address as Hex));
    this.busy = run.catch(() => undefined);
    const outcome = await run;
    return Response.json(outcome);
  }

  private async advance(fid: number, to: Hex): Promise<AdvanceOutcome> {
    const env = this.env;
    if (env.ADVANCES_OPEN !== "1" || !env.OPS_PRIVATE_KEY) return { advanced: false, reason: "not-open" };

    const day = today();

    const todayRow = await env.DB.prepare(
      `SELECT 1 AS x FROM advances WHERE fid = ?1 AND advance_date = ?2 AND status != 'failed'`,
    ).bind(fid, day).first<number>("x");
    if (todayRow !== null) return { advanced: false, reason: "already-today" };

    const lifetime = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM advances WHERE fid = ?1 AND status != 'failed'`,
    ).bind(fid).first<number>("n") ?? 0;
    if (lifetime >= Number(env.MAX_CLAIMS_LIFETIME)) return { advanced: false, reason: "lifetime-limit" };

    const globalToday = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM advances WHERE advance_date = ?1 AND status != 'failed'`,
    ).bind(day).first<number>("n") ?? 0;
    if (globalToday >= Number(env.MAX_ADVANCES_PER_DAY)) return { advanced: false, reason: "faucet-cap" };

    const account = privateKeyToAccount(env.OPS_PRIVATE_KEY as Hex);
    const chain = {
      id: Number(env.CHAIN_ID),
      name: "base",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [env.RPC_URL] } },
    };
    const reader = createPublicClient({ chain, transport: http(env.RPC_URL) });
    const wallet = createWalletClient({ account, chain, transport: http(env.RPC_URL) });

    const amount = parseUnits(env.ADVANCE_AMOUNT, 18);
    const floor = parseUnits(env.MIN_OPS_BALANCE, 18);
    let stock: bigint;
    try {
      stock = await reader.readContract({
        address: env.TOKEN_ADDRESS as Hex,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [account.address],
      });
    } catch {
      return { advanced: false, reason: "faucet-closed" };
    }
    if (stock < amount || stock - amount < floor) return { advanced: false, reason: "faucet-closed" };

    /* the record precedes the money — an orphaned 'sending' row blocks the
       wallet for the day instead of paying it twice */
    const inserted = await env.DB.prepare(
      `INSERT INTO advances (fid, address, amount, status, advance_date)
       VALUES (?1, ?2, ?3, 'sending', ?4)`,
    ).bind(fid, to, Number(env.ADVANCE_AMOUNT), day).run();
    if (!inserted.success) return { advanced: false, reason: "send-failed" };

    try {
      let nonce = await this.state.storage.get<number>("nonce");
      if (nonce === undefined) {
        nonce = await reader.getTransactionCount({ address: account.address, blockTag: "pending" });
      }

      const hash = await wallet.sendTransaction({
        to: env.TOKEN_ADDRESS as Hex,
        data: encodeFunctionData({ abi: ERC20_ABI, functionName: "transfer", args: [to, amount] }),
        nonce,
        chain,
      });

      await this.state.storage.put("nonce", nonce + 1);
      await env.DB.prepare(
        `UPDATE advances SET tx_hash = ?1, status = 'pending'
          WHERE fid = ?2 AND advance_date = ?3 AND status = 'sending'`,
      ).bind(hash, fid, day).run();
      return { advanced: true, tx_hash: hash };
    } catch (err) {
      /* the nonce may be stale (a competing send, an RPC lie) — resync next time */
      await this.state.storage.delete("nonce");
      console.error("treasury send", err);
      await env.DB.prepare(
        `UPDATE advances SET status = 'failed'
          WHERE fid = ?1 AND advance_date = ?2 AND status = 'sending'`,
      ).bind(fid, day).run();
      return { advanced: false, reason: "send-failed" };
    }
  }
}
