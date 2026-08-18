import type { Env } from "../../shared/types";
import { authenticate } from "../lib/auth";
import { error, json, methodNotAllowed, preflight } from "../lib/respond";

/* POST /api/advance — 227 BYKO to the wallet's verified address, through the
 * treasury DO which serialises limits, nonce and the send. Rules: one per
 * wallet per day, five lifetime, global daily cap, stock floor. The money
 * goes TO the reader; nothing is ever signed by them.
 *
 * While ADVANCES_OPEN != "1" the treasury answers not-open and the client
 * keeps its prototype behaviour — deploying this dormant is deliberate:
 * Base Sepolia first, mainnet only after a clean dry run. */
export async function advance(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") return preflight();
  if (request.method !== "POST") return methodNotAllowed();

  const identity = await authenticate(request);
  if (!identity) return error("unauthorized", 401);

  /* fast path: no point waking the treasury while the faucet is closed */
  if (env.ADVANCES_OPEN !== "1") {
    return json({ advanced: false, reason: "not-open" });
  }

  /* the money target is the verified address recorded at auth — frozen per
     advance in the row the treasury writes (address_at_claim semantics) */
  const row = await env.DB.prepare(
    `SELECT eth_address FROM profiles WHERE fid = ?1`,
  ).bind(identity.fid).first<string>("eth_address");
  if (!row || !/^0x[0-9a-fA-F]{40}$/.test(row)) return json({ advanced: false, reason: "no-address" });

  const treasury = env.FID_LOCK.get(env.FID_LOCK.idFromName("treasury"));
  const response = await treasury.fetch(new Request("https://treasury/advance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fid: identity.fid, address: row }),
  }));
  return json(await response.json(), response.ok ? 200 : 500);
}
