import type { Env, Verdict } from "../../shared/types";
import { authenticate } from "../lib/auth";
import { loadClaims, openClaims, todaysFacts } from "../lib/claims";
import { answeredClaimIds, MAX_ANSWERS_PER_DAY, recordAnswer } from "../lib/store";
import { error, json, methodNotAllowed, preflight } from "../lib/respond";

const VERDICTS: Verdict[] = ["yes", "no", "cant"];
const MAX_ARGUMENT_CHARS = 1_000;
const MAX_CLAIM_ID_CHARS = 200;

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
  if (!claimId || claimId.length > MAX_CLAIM_ID_CHARS) return error("claim_id required", 400);
  if (!VERDICTS.includes(verdict)) return error("verdict must be yes, no or cant", 400);
  if (verdict === "no" && argument.length === 0) return error("a 'no' needs an argument", 400);
  if (argument.length > MAX_ARGUMENT_CHARS) return error("argument too long", 400);

  let claims;
  try {
    claims = await loadClaims(env);
  } catch {
    return error("claims feed unavailable", 503);
  }
  const claim = openClaims(claims).find((c) => c.id === claimId);
  if (!claim) return error("claim is not open", 404);

  const result = await recordAnswer(env, identity.fid, claim, verdict, verdict === "no" ? argument : null);
  if (!result.ok) {
    if (result.reason === "duplicate") return error("already answered this claim", 409);
    return error("daily answer limit reached", 429);
  }

  /* the day is closed when the cap is hit OR every fact of today is answered
     (backlog answers count toward the cap but not toward "done for today") */
  const answered = new Set(await answeredClaimIds(env, identity.fid));
  const allToday = todaysFacts(claims).every((c) => answered.has(c.id));
  return json({
    ok: true,
    answeredToday: result.answeredToday,
    dayClosed: result.answeredToday >= MAX_ANSWERS_PER_DAY || allToday,
  });
}
