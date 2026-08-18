import type { Env } from "../../shared/types";
import { loadClaims } from "../lib/claims";
import { computeMetrics } from "../lib/store";
import { error, json, methodNotAllowed } from "../lib/respond";

/* GET /api/metrics — public Record numbers: today's totals and verdict split,
   all-time answers, the leaderboard, and per-fact yes-readers. No auth. The
   client renders every figure here in ink — these are counted, not chain-read. */
export async function metrics(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed();
  try {
    const claims = await loadClaims(env);
    const body = await computeMetrics(env, claims);
    return json(body, 200, { "Cache-Control": "public, max-age=15" });
  } catch (err) {
    return error(`metrics unavailable: ${(err as Error).message}`, 503);
  }
}
