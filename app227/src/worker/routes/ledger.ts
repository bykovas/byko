import type { Env } from "../../shared/types";
import { error, json, methodNotAllowed } from "../lib/respond";
import { handle } from "../lib/neynar";

/* GET /api/ledger — who got what, and who answered.
 *
 * Public by design: every advance is an on-chain transfer from a wallet the
 * project declared as its payout address, and every handle is a Farcaster
 * identity. Nothing here is a secret — this is the operational view of the
 * Record the cron will one day commit to the repo. */
export async function ledger(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed();

  try {
    const advances = await env.DB.prepare(
      `SELECT a.id, a.fid, p.username AS username, a.address, a.amount, a.tx_hash,
              a.status, a.advance_date, a.created_at, a.confirmed_at
         FROM advances a LEFT JOIN profiles p ON p.fid = a.fid
        ORDER BY a.id DESC LIMIT 200`,
    ).all<{
      id: number; fid: number; username: string | null; address: string;
      amount: number; tx_hash: string | null; status: string;
      advance_date: string; created_at: string; confirmed_at: string | null;
    }>();

    const totals = await env.DB.prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status IN ('confirmed','pending','sending') THEN amount END), 0) AS sent,
         COALESCE(SUM(CASE WHEN status = 'confirmed' THEN amount END), 0) AS confirmed,
         COUNT(DISTINCT CASE WHEN status != 'failed' THEN fid END) AS wallets,
         COUNT(*) AS rows
       FROM advances`,
    ).first<{ sent: number; confirmed: number; wallets: number; rows: number }>();

    const answers = await env.DB.prepare(
      `SELECT a.id, a.fid, p.username AS username, a.claim_id, a.verdict,
              a.argument, a.answer_date, a.created_at
         FROM answers a LEFT JOIN profiles p ON p.fid = a.fid
        ORDER BY a.id DESC LIMIT 200`,
    ).all<{
      id: number; fid: number; username: string | null; claim_id: string;
      verdict: string; argument: string | null; answer_date: string; created_at: string;
    }>();

    return json({
      generated: new Date().toISOString(),
      faucet: {
        open: env.ADVANCES_OPEN === "1",
        amount: Number(env.ADVANCE_AMOUNT),
        per_wallet_lifetime: Number(env.MAX_CLAIMS_LIFETIME),
        per_day_global: Number(env.MAX_ADVANCES_PER_DAY),
        ops_address: env.OPS_ADDRESS,
      },
      totals: {
        sent: totals?.sent ?? 0,
        confirmed: totals?.confirmed ?? 0,
        wallets: totals?.wallets ?? 0,
        attempts: totals?.rows ?? 0,
        answers: answers.results.length,
      },
      advances: advances.results.map((row) => ({
        ...row,
        handle: handle(row.username, row.fid),
      })),
      answers: answers.results.map((row) => ({
        ...row,
        handle: handle(row.username, row.fid),
        /* the argument is the reader's public reasoning, kept verbatim */
        argument: row.argument,
      })),
    }, 200, { "Cache-Control": "public, max-age=10" });
  } catch (err) {
    console.error("ledger", err);
    return error("ledger unavailable", 503);
  }
}
