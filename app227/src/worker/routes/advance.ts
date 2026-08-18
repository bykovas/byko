import type { Env } from "../../shared/types";
import { authenticate } from "../lib/auth";
import { error, json, methodNotAllowed, preflight } from "../lib/respond";

/* POST /api/advance — DEFERRED to phase 4.
 *
 * The 227 BYKO transfer is the only place real money leaves the ops wallet,
 * and the rule is: Base Sepolia first, never test payouts on mainnet — every
 * mistake would land in the public Record forever. So this route does NOT
 * send anything yet. It authenticates and reports that advances are not open,
 * so the client can show the "No advance this time." screen truthfully rather
 * than faking a transfer. Decided economics for when it lands: 227 per claim,
 * one claim/day, five per wallet lifetime. */
export async function advance(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") return preflight();
  if (request.method !== "POST") return methodNotAllowed();

  const identity = await authenticate(request);
  if (!identity) return error("unauthorized", 401);

  return json({ advanced: false, reason: "advances not open yet", phase: 4 }, 200);
}
