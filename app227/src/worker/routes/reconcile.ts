import type { Env } from "../../shared/types";
import { confirmAdvances } from "../lib/confirm";
import { error, json, methodNotAllowed } from "../lib/respond";

/* POST /api/reconcile — run the cron's reconciliation by hand.
 *
 * The scheduled trigger is the normal path; this is the lever to pull when it
 * is late, wedged, or being debugged. Bookkeeping only: it confirms receipts
 * and expires stale rows, it can never send money. Guarded by ADMIN_TOKEN;
 * without that secret set, the lever does not exist. */
export async function reconcile(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed();
  if (!env.ADMIN_TOKEN) return error("not found", 404);

  const header = request.headers.get("Authorization") ?? "";
  if (header !== `Bearer ${env.ADMIN_TOKEN}`) return error("unauthorized", 401);

  try {
    await confirmAdvances(env);
    const rows = await env.DB.prepare(
      `SELECT status, COUNT(*) AS n FROM advances GROUP BY status`,
    ).all<{ status: string; n: number }>();
    return json({ ok: true, advances: rows.results });
  } catch (err) {
    return error(`reconcile failed: ${(err as Error).message}`, 500);
  }
}
