import type { Env } from "../../shared/types";
import { authenticate } from "../lib/auth";
import { computeMe } from "../lib/store";
import { error, json, methodNotAllowed, preflight } from "../lib/respond";

/* GET /api/me — the per-user half of the board: how many answers today, how
   many remain, all-time count and rank. Auth'd; refreshed after each answer. */
export async function me(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") return preflight();
  if (request.method !== "GET") return methodNotAllowed();

  const identity = await authenticate(request);
  if (!identity) return error("unauthorized", 401);

  return json(await computeMe(env, identity.fid));
}
