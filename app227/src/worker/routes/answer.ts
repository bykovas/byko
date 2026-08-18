import type { Env, Verdict } from "../../shared/types";
import { authenticate } from "../lib/auth";
import { loadClaims, openClaims, todaysFacts } from "../lib/claims";
import { recordAnswer } from "../lib/store";
import { error, json, methodNotAllowed, preflight } from "../lib/respond";

const VERDICTS: Verdict[] = ["yes", "no", "cant"];

/* POST /api/answer — cast a verdict on an open fact.
   Body: { claim_id, verdict: "yes"|"no"|"cant", argument?: string }
   Enforces: fact is open, verdict valid, "no" carries an argument, one answer
   per (fid, claim), at most two answers per day. */
export async function answer(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") return preflight();
  if (request.method !== "POST") return methodNotAllowed();

  const identity = await authenticate(request);
  if (!identity) return error("unauthorized", 401);

  let body: { claim_id?: unknown; verdict?: unknown; argument?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return error("bad json", 400);
  }

  const claimId = typeof body.claim_id === "string" ? body.claim_id : "";
  const verdict = body.verdict as Verdict;
  const argument = typeof body.argument === "string" ? body.argument.trim() : "";
  if (!claimId) return error("claim_id required", 400);
  if (!VERDICTS.includes(verdict)) return error("verdict must be yes, no or cant", 400);
  if (verdict === "no" && argument.length === 0) return error("a 'no' needs an argument", 400);

  const claims = await loadClaims(env);
  const claim = openClaims(claims).find((c) => c.id === claimId);
  if (!claim) return error("claim is not open", 404);

  const result = await recordAnswer(env, identity.fid, claim, verdict, verdict === "no" ? argument : null);
  if (!result.ok) {
    if (result.reason === "duplicate") return error("already answered this claim", 409);
    return error("daily answer limit reached", 429);
  }

  const factsToday = todaysFacts(claims).length;
  return json({
    ok: true,
    answeredToday: result.answeredToday,
    dayClosed: result.answeredToday >= Math.min(2, factsToday),
  });
}
