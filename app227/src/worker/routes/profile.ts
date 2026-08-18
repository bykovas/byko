import type { Env } from "../../shared/types";
import { authenticate } from "../lib/auth";
import { error, json, methodNotAllowed, preflight } from "../lib/respond";
import { handle } from "../lib/neynar";

/* GET /api/profile — the stored profile for the authed fid (fast, no Neynar
   call; POST /api/auth is what refreshes it from Farcaster). */
export async function profile(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") return preflight();
  if (request.method !== "GET") return methodNotAllowed();

  const identity = await authenticate(request);
  if (!identity) return error("unauthorized", 401);

  const row = await env.DB.prepare(
    `SELECT fid, username, eth_address, address_source FROM profiles WHERE fid = ?1`,
  ).bind(identity.fid).first<{ fid: number; username: string | null; eth_address: string | null; address_source: string | null }>();

  if (!row) return json({ fid: identity.fid, handle: handle(null, identity.fid), address: null, known: false });
  return json({
    fid: row.fid,
    handle: handle(row.username, row.fid),
    address: row.eth_address,
    address_source: row.address_source,
    known: true,
  });
}
