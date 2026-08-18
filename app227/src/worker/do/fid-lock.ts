import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  fallback,
  getAddress,
  http,
  keccak256,
  parseUnits,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import * as Sentry from "@sentry/cloudflare";
import type { Env } from "../../shared/types";

/* The treasury. One instance ("treasury") serialises EVERYTHING that moves
 * money: limit checks, the nonce, the send, the record. With one sender
 * wallet the nonce is a global sequence anyway, so one lock is both correct
 * and sufficient at this faucet's volume (≤ MAX_ADVANCES_PER_DAY).
 *
 * The rules, all inside the lock, in order:
 *   1. faucet open (ADVANCES_OPEN + a valid key matching OPS_ADDRESS)
 *   2. one attempt per wallet per UTC day — ANY row burns the day, failed
 *      included: honesty over generosity, retry tomorrow
 *   3. five advances per wallet lifetime (failed sends excluded)
 *   4. global cap per day (failed excluded)
 *   5. stock above the floor, counting unmined outflow; gas above a minimum
 *
 * The send is PRE-SIGNED: the tx hash is computed locally and written to the
 * row BEFORE the broadcast. After that point nothing marks the row 'failed'
 * on this path — the cron resolves it by receipt (or expires it). A row can
 * therefore never claim "no money moved" while money moved. */

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

/* enough gas for a few dozen ERC-20 transfers on Base */
const MIN_GAS_WEI = parseUnits("0.00005", 18);

/* One advance costs ~7 RPC calls; a single public node rate-limits long
   before the faucet's own caps do (that is exactly what the first live claim
   hit). The configured URL leads, the rest catch the overflow. */
const FALLBACK_RPCS = [
  "https://base-rpc.publicnode.com",
  "https://base.drpc.org",
  "https://1rpc.io/base",
];

/* the keyed node leads when configured, the public ones catch the overflow */
function transportFor(env: Env) {
  const urls = [env.DRPC_URL, env.RPC_URL, ...FALLBACK_RPCS]
    .filter((u): u is string => Boolean(u))
    .filter((u, i, all) => all.indexOf(u) === i);
  return fallback(urls.map((url) => http(url, { retryCount: 2, timeout: 8_000 })), { rank: false });
}

export type AdvanceReason =
  | "not-open"          /* the flag is off — the faucet was never opened */
  | "already-today"
  | "lifetime-limit"
  | "faucet-cap"
  | "faucet-closed"     /* open flag but the faucet cannot pay: config/stock/gas */
  | "send-failed";

export interface AdvanceOutcome {
  advanced: boolean;
  tx_hash?: string;
  tx_url?: string;
  reason?: AdvanceReason;
}

interface DurableObjectState {
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<boolean>;
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function explorerBase(chainId: string): string {
  return chainId === "84532" ? "https://sepolia.basescan.org" : "https://basescan.org";
}

export class FidLock {
  private env: Env;
  private busy: Promise<unknown> = Promise.resolve();
  private account: PrivateKeyAccount | null = null;
  private reader: PublicClient | null = null;
  private wallet: WalletClient | null = null;
  private chain: Chain | null = null;

  constructor(_state: unknown, env: Env) {
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

  /* Lazily build the signer once per instance; refuse cleanly on any
     misconfiguration — a config error must read as a closed faucet, never
     as a crash the client could misrender. */
  private setup(): "not-open" | "faucet-closed" | null {
    const env = this.env;
    if (env.ADVANCES_OPEN !== "1") return "not-open";

    const key = env.OPS_PRIVATE_KEY?.trim();
    if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) return "faucet-closed";

    const life = Number(env.MAX_CLAIMS_LIFETIME);
    const cap = Number(env.MAX_ADVANCES_PER_DAY);
    if (!Number.isFinite(life) || !Number.isFinite(cap)) return "faucet-closed";

    if (!this.account) {
      const account = privateKeyToAccount(key as Hex);
      if (account.address.toLowerCase() !== env.OPS_ADDRESS.toLowerCase()) {
        console.error("treasury: OPS_PRIVATE_KEY does not match OPS_ADDRESS");
        return "faucet-closed";
      }
      const chain: Chain = {
        id: Number(env.CHAIN_ID),
        name: "base",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [env.RPC_URL] } },
      };
      const transport = transportFor(env);
      this.account = account;
      this.chain = chain;
      this.reader = createPublicClient({ chain, transport });
      this.wallet = createWalletClient({ account, chain, transport });
    }
    return null;
  }

  private async advance(fid: number, to: Hex): Promise<AdvanceOutcome> {
    const env = this.env;
    const refused = this.setup();
    if (refused) return { advanced: false, reason: refused };
    const account = this.account!;
    const reader = this.reader!;
    const wallet = this.wallet!;
    const chain = this.chain!;

    /* viem checks EIP-55 strictly; config casing must not decide whether the
       faucet works. Normalise from lowercase so the checksum is always right. */
    let token: Address;
    let dest: Address;
    try {
      token = getAddress(env.TOKEN_ADDRESS.toLowerCase());
      dest = getAddress(to.toLowerCase());
    } catch {
      return { advanced: false, reason: "faucet-closed" };
    }

    const day = today();

    /* ANY attempt today burns the day — failed included, by design */
    const todayRow = await env.DB.prepare(
      `SELECT 1 AS x FROM advances WHERE fid = ?1 AND advance_date = ?2`,
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

    /* stock floor counts money already committed but not yet mined */
    const amount = parseUnits(env.ADVANCE_AMOUNT, 18);
    const floor = parseUnits(env.MIN_OPS_BALANCE, 18);
    try {
      const [stock, gas, unmined] = await Promise.all([
        reader.readContract({
          address: token,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [account.address],
        }),
        reader.getBalance({ address: account.address }),
        env.DB.prepare(
          `SELECT COALESCE(SUM(amount), 0) AS n FROM advances WHERE status IN ('sending', 'pending')`,
        ).first<number>("n"),
      ]);
      const committed = parseUnits(String(unmined ?? 0), 18);
      if (stock - committed < amount + floor) return { advanced: false, reason: "faucet-closed" };
      if (gas < MIN_GAS_WEI) return { advanced: false, reason: "faucet-closed" };
    } catch (err) {
      /* a silent faucet-closed is exactly how the EIP-55 bug hid for a day */
      Sentry.setContext("treasury", { stage: "preflight", fid, chain: env.CHAIN_ID });
      Sentry.captureException(err);
      console.error("treasury preflight", err);
      return { advanced: false, reason: "faucet-closed" };
    }

    /* the record precedes the money */
    const inserted = await env.DB.prepare(
      `INSERT INTO advances (fid, address, amount, status, advance_date)
       VALUES (?1, ?2, ?3, 'sending', ?4)`,
    ).bind(fid, to, Number(env.ADVANCE_AMOUNT), day).run();
    if (!inserted.success) return { advanced: false, reason: "send-failed" };

    /* PRE-SIGN: prepare, sign locally, record the hash — only then broadcast.
       Failures before the hash is recorded mark the row failed (nothing left
       the building); failures after leave it 'pending' for the cron. */
    let serialized: Hex;
    let hash: Hex;
    try {
      /* no cached nonce: the fresh pending count under the lock is the truth,
         and a dropped tx heals itself on the next send */
      const nonce = await reader.getTransactionCount({ address: account.address, blockTag: "pending" });
      const request = await wallet.prepareTransactionRequest({
        account,
        chain,
        to: token,
        data: encodeFunctionData({ abi: ERC20_ABI, functionName: "transfer", args: [dest, amount] }),
        nonce,
      });
      serialized = await wallet.signTransaction(request as never);
      hash = keccak256(serialized);
    } catch (err) {
      Sentry.setContext("treasury", { stage: "prepare-sign", fid, to: dest });
      Sentry.captureException(err);
      console.error("treasury prepare", err);
      await env.DB.prepare(
        `UPDATE advances SET status = 'failed'
          WHERE fid = ?1 AND advance_date = ?2 AND status = 'sending'`,
      ).bind(fid, day).run();
      return { advanced: false, reason: "send-failed" };
    }

    await env.DB.prepare(
      `UPDATE advances SET tx_hash = ?1, status = 'pending'
        WHERE fid = ?2 AND advance_date = ?3 AND status = 'sending'`,
    ).bind(hash, fid, day).run();

    try {
      await wallet.sendRawTransaction({ serializedTransaction: serialized });
    } catch (err) {
      /* the hash is on record; whether this broadcast landed is now solely
         the cron's question — never mark failed here */
      Sentry.setContext("treasury", { stage: "broadcast", fid, tx: hash });
      Sentry.captureException(err);
      console.error("treasury broadcast", err);
    }

    return {
      advanced: true,
      tx_hash: hash,
      tx_url: `${explorerBase(env.CHAIN_ID)}/tx/${hash}`,
    };
  }
}
