import * as Sentry from "@sentry/cloudflare";
import type { Env } from "../../shared/types";

/* The cron's half of the money path: promote 'pending' advances to
 * 'confirmed' once their receipt is final, mark reverted ones 'failed', and
 * fail orphaned 'sending' rows (an isolate died between the insert and the
 * send — no tx exists, the day stays burned for that wallet, honesty over
 * generosity). Runs every 15 minutes; each pass is idempotent. */

interface Receipt {
  status: string;        /* 0x1 success, 0x0 reverted */
  blockNumber: string;
}

async function rpc(env: Env, method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(env.RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`rpc ${response.status}`);
  const body = (await response.json()) as { result?: unknown; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message ?? "rpc error");
  return body.result;
}

const CONFIRMATIONS = 2n;

export async function confirmAdvances(env: Env): Promise<void> {
  const pending = await env.DB.prepare(
    `SELECT id, tx_hash FROM advances WHERE status = 'pending' AND tx_hash IS NOT NULL LIMIT 50`,
  ).all<{ id: number; tx_hash: string }>();

  if (pending.results.length > 0) {
    const latest = BigInt(String(await rpc(env, "eth_blockNumber", [])));
    for (const row of pending.results) {
      try {
        const receipt = (await rpc(env, "eth_getTransactionReceipt", [row.tx_hash])) as Receipt | null;
        if (!receipt) continue; /* not mined yet */
        if (receipt.status !== "0x1") {
          await env.DB.prepare(`UPDATE advances SET status = 'failed' WHERE id = ?1`).bind(row.id).run();
          continue;
        }
        if (latest - BigInt(receipt.blockNumber) >= CONFIRMATIONS) {
          await env.DB.prepare(
            `UPDATE advances SET status = 'confirmed', confirmed_at = datetime('now') WHERE id = ?1`,
          ).bind(row.id).run();
        }
      } catch (err) {
        Sentry.setContext("confirm", { tx: row.tx_hash, id: row.id });
        Sentry.captureException(err);
        console.error("confirm", row.tx_hash, err);
      }
    }
  }

  /* a 'pending' whose receipt never came: after 24h the tx is either mined
     (handled above) or gone from every mempool — the signed bytes were never
     re-shared. The day stayed burned regardless; the lifetime slot returns. */
  await env.DB.prepare(
    `UPDATE advances SET status = 'failed'
      WHERE status = 'pending' AND created_at < datetime('now', '-24 hours')`,
  ).run();

  /* orphans: pre-sign writes the hash before any broadcast, so a 'sending'
     row with no tx genuinely means the send never left the building */
  await env.DB.prepare(
    `UPDATE advances SET status = 'failed'
      WHERE status = 'sending' AND tx_hash IS NULL
        AND created_at < datetime('now', '-1 hour')`,
  ).run();
}
