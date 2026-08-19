import type { Env } from "../types";
import { armRules } from "./rules";
import { SWAP_TOPIC, decodeSwap } from "./chain";
import { event } from "./db";

/* The confirmer: settle 'pending' trades from their receipts, exactly as
 * app227's confirm.ts settles advances. It fills the values that only exist
 * after the fact — the token/USDC actually swapped (from the pool's own Swap
 * log), the price after, and the gas — and never invents them. Raw JSON-RPC,
 * keyed node first, so a rate-limited read cannot stall the ledger. */

function nodes(env: Env): string[] {
  return [env.DRPC_URL, env.RPC_URL, "https://base-rpc.publicnode.com", "https://base.drpc.org"]
    .filter((u): u is string => Boolean(u))
    .filter((u, i, all) => all.indexOf(u) === i);
}

async function rpc(env: Env, method: string, params: unknown[]): Promise<unknown> {
  let last: unknown = null;
  for (const url of nodes(env)) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) throw new Error(`rpc ${res.status}`);
      const body = (await res.json()) as { result?: unknown; error?: { message?: string } };
      if (body.error) throw new Error(body.error.message ?? "rpc error");
      return body.result;
    } catch (err) { last = err; }
  }
  throw last instanceof Error ? last : new Error("rpc unavailable");
}

interface Log { address: string; topics: string[]; data: string }
interface Receipt { status: string; blockNumber: string; gasUsed: string; effectiveGasPrice: string; logs: Log[] }

const CONFIRMATIONS = 2n;
const big = (h: string) => (h && h !== "0x" ? BigInt(h) : 0n);

async function totalSupply(env: Env, token: string): Promise<bigint> {
  const r = await rpc(env, "eth_call", [{ to: token, data: "0x18160ddd" }, "latest"]);
  return big(String(r));
}

async function reservesLatest(env: Env, pool: string): Promise<{ token: bigint; usdc: bigint }> {
  const r = String(await rpc(env, "eth_call", [{ to: pool, data: "0x0902f1ac" }, "latest"]));
  const hex = r.slice(2);
  return { token: big("0x" + hex.slice(0, 64)), usdc: big("0x" + hex.slice(64, 128)) };
}

export async function confirmTrades(env: Env): Promise<void> {
  const pending = await env.DB.prepare(
    `SELECT id, arm, side, tx_hash FROM trades WHERE status = 'pending' AND tx_hash IS NOT NULL LIMIT 40`,
  ).all<{ id: number; arm: string; side: string; tx_hash: string }>();

  if (pending.results.length > 0) {
    const latest = big(String(await rpc(env, "eth_blockNumber", [])));
    for (const row of pending.results) {
      try {
        const receipt = (await rpc(env, "eth_getTransactionReceipt", [row.tx_hash])) as Receipt | null;
        if (!receipt) continue;                 /* not mined yet */
        if (receipt.status !== "0x1") {
          await env.DB.prepare(`UPDATE trades SET status = 'failed', error = 'reverted' WHERE id = ?1`)
            .bind(row.id).run();
          await event(env, row.arm, "error", `trade ${row.id} reverted (${row.tx_hash})`);
          continue;
        }
        if (latest - big(receipt.blockNumber) < CONFIRMATIONS) continue;

        const rules = armRules(row.arm);
        if (!rules) continue;
        const pool = rules.pool.toLowerCase();
        const swap = receipt.logs.find(
          (l) => l.address.toLowerCase() === pool && l.topics[0]?.toLowerCase() === SWAP_TOPIC,
        );

        let tokenAmount = "";
        let usdcSettled = "";
        if (swap) {
          const s = decodeSwap(swap.data as `0x${string}`);
          /* token0 = project token, token1 = USDC in both pools */
          if (row.side === "buy") { tokenAmount = String(s.a0Out); usdcSettled = String(s.a1In); }
          else { tokenAmount = String(s.a0In); usdcSettled = String(s.a1Out); }
        }

        const res = await reservesLatest(env, pool);
        const price = res.token > 0n ? (Number(res.usdc) / 1e6) / (Number(res.token) / 1e18) : 0;
        const supply = await totalSupply(env, rules.token);
        const fdv = price * (Number(supply) / 1e18);
        const gasWei = big(receipt.gasUsed) * big(receipt.effectiveGasPrice);

        await env.DB.prepare(
          `UPDATE trades SET status = 'confirmed', confirmed_at = datetime('now'),
             block_number = ?2, token_amount = ?3, usdc_settled = ?4,
             price_after = ?5, fdv_after = ?6, reserve_usdc_after = ?7, gas_wei = ?8
           WHERE id = ?1`,
        ).bind(
          row.id, Number(big(receipt.blockNumber)), tokenAmount, usdcSettled,
          price.toPrecision(12), fdv.toFixed(2), String(res.usdc), String(gasWei),
        ).run();
      } catch (err) {
        await event(env, row.arm, "error", `confirm ${row.tx_hash}: ${String((err as Error)?.message ?? err).slice(0, 160)}`);
      }
    }
  }

  /* a pending whose receipt never came: after 2h the signed bytes were never
     re-shared and no tx exists to settle. Mark failed with a visible reason. */
  const stale = await env.DB.prepare(
    `SELECT id, arm FROM trades WHERE status = 'pending' AND created_at < datetime('now', '-2 hours')`,
  ).all<{ id: number; arm: string }>();
  for (const s of stale.results) {
    await env.DB.prepare(`UPDATE trades SET status = 'failed', error = 'expired' WHERE id = ?1`).bind(s.id).run();
    await event(env, s.arm, "error", `trade ${s.id} expired without a receipt`);
  }

}
