import type { Env } from "../../shared/types";
import { authenticate } from "../lib/auth";
import { fetchProfile } from "../lib/neynar";
import { computeMe, upsertProfile } from "../lib/store";
import { error, json, methodNotAllowed, preflight } from "../lib/respond";

/* POST /api/auth — the one call the client makes on launch. Verifies the
   Quick Auth token, records/refreshes the profile (username + verified
   address via Neynar, best-effort), and returns where the wallet stands. */
export async function auth(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") return preflight();
  if (request.method !== "POST") return methodNotAllowed();

  const identity = await authenticate(request);
  if (!identity) return error("unauthorized", 401);

  const profile = await fetchProfile(env, identity.fid);
  await upsertProfile(env, identity.fid, profile.username, profile.address, profile.address_source);

  const me = await computeMe(env, identity.fid);
  return json({ ...me, address: profile.address, address_source: profile.address_source });
}
