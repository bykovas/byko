import type { Claim, Env, LeaderRow, Metrics, Verdict } from "../../shared/types";
import { sha256Hex, today } from "./day";
import { handle } from "./neynar";
import { todaysFacts } from "./claims";

/* All the D1 reads and writes, in one place. The limits live here:
   - one answer per (fid, claim)  → the UNIQUE key on answers
   - two answers per fid per day   → counted on answer_date before insert
   Double-tap on the same claim is idempotent (UNIQUE); the only unguarded
   race is two DIFFERENT claims answered in the same instant crossing the
   2/day line, which costs one extra answer and no money — acceptable until
   the FidLock DO serializes the money path in phase 4. */

export const MAX_ANSWERS_PER_DAY = 2;

export interface Profile {
  fid: number;
  username: string | null;
  eth_address: string | null;
}

export async function upsertProfile(
  env: Env,
  fid: number,
  username: string | null,
  address: string | null,
  addressSource: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO profiles (fid, username, eth_address, address_source, updated_at)
     VALUES (?1, ?2, ?3, ?4, datetime('now'))
     ON CONFLICT(fid) DO UPDATE SET
       username    = COALESCE(excluded.username, profiles.username),
       eth_address = COALESCE(excluded.eth_address, profiles.eth_address),
       address_source = excluded.address_source,
       updated_at  = datetime('now')`,
  ).bind(fid, username, address, addressSource).run();
}

export async function getUsername(env: Env, fid: number): Promise<string | null> {
  return env.DB.prepare(`SELECT username FROM profiles WHERE fid = ?1`).bind(fid).first<string>("username");
}

export async function answeredToday(env: Env, fid: number): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM answers WHERE fid = ?1 AND answer_date = ?2`,
  ).bind(fid, today()).first<number>("n");
  return row ?? 0;
}

export async function hasAnswered(env: Env, fid: number, claimId: string): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT 1 AS x FROM answers WHERE fid = ?1 AND claim_id = ?2`,
  ).bind(fid, claimId).first<number>("x");
  return row !== null;
}

export type RecordAnswerResult =
  | { ok: true; answeredToday: number }
  | { ok: false; reason: "duplicate" | "limit" };

export async function recordAnswer(
  env: Env,
  fid: number,
  claim: Claim,
  verdict: Verdict,
  argument: string | null,
): Promise<RecordAnswerResult> {
  if (await hasAnswered(env, fid, claim.id)) return { ok: false, reason: "duplicate" };

  const count = await answeredToday(env, fid);
  if (count >= MAX_ANSWERS_PER_DAY) return { ok: false, reason: "limit" };

  const day = today();
  const contentHash = await sha256Hex(
    JSON.stringify({ fid, claim_id: claim.id, verdict, argument, answer_date: day }),
  );

  try {
    await env.DB.prepare(
      `INSERT INTO answers (fid, claim_id, verdict, argument, answer_date, content_hash)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    ).bind(fid, claim.id, verdict, argument, day, contentHash).run();
  } catch {
    /* the UNIQUE key fired between the check and the insert — treat as duplicate */
    return { ok: false, reason: "duplicate" };
  }
  return { ok: true, answeredToday: count + 1 };
}

/* Aggregate the whole board from D1. Pure reads, no auth. */
export async function computeMetrics(env: Env, claims: Claim[]): Promise<Metrics> {
  const day = today();
  const facts = todaysFacts(claims);
  const factIds = facts.map((c) => c.id);

  const todayRows = await env.DB.prepare(
    `SELECT verdict, COUNT(*) AS n FROM answers WHERE answer_date = ?1 GROUP BY verdict`,
  ).bind(day).all<{ verdict: Verdict; n: number }>();
  const breakdown = { yes: 0, no: 0, cant: 0 };
  let answersToday = 0;
  for (const row of todayRows.results) {
    if (row.verdict in breakdown) breakdown[row.verdict] = row.n;
    answersToday += row.n;
  }

  const readersToday = await env.DB.prepare(
    `SELECT COUNT(DISTINCT fid) AS n FROM answers WHERE answer_date = ?1`,
  ).bind(day).first<number>("n");

  const allTime = await env.DB.prepare(`SELECT COUNT(*) AS n FROM answers`).first<number>("n");

  const board = await env.DB.prepare(
    `SELECT a.fid AS fid, p.username AS username, COUNT(*) AS answers
       FROM answers a LEFT JOIN profiles p ON p.fid = a.fid
       GROUP BY a.fid ORDER BY answers DESC, a.fid ASC LIMIT 10`,
  ).all<{ fid: number; username: string | null; answers: number }>();
  const leaderboard: LeaderRow[] = board.results.map((row, i) => ({
    rank: i + 1,
    fid: row.fid,
    handle: handle(row.username, row.fid),
    answers: row.answers,
  }));

  /* Per-fact yes-readers for the current facts (the 06a reader slots). */
  const factStats = [];
  for (const claim of facts) {
    const rows = await env.DB.prepare(
      `SELECT a.verdict AS verdict, p.username AS username, a.fid AS fid
         FROM answers a LEFT JOIN profiles p ON p.fid = a.fid
        WHERE a.claim_id = ?1 ORDER BY a.id ASC`,
    ).bind(claim.id).all<{ verdict: Verdict; username: string | null; fid: number }>();
    const yesReaders = rows.results.filter((r) => r.verdict === "yes");
    factStats.push({
      claim_id: claim.id,
      answers: rows.results.length,
      yes: yesReaders.length,
      readers: yesReaders.slice(0, 3).map((r) => handle(r.username, r.fid)),
      sealed: yesReaders.length >= 3,
    });
  }

  return {
    today: { date: day, facts: factIds.length, answers: answersToday, readers: readersToday ?? 0, breakdown },
    allTime: { answers: allTime ?? 0 },
    leaderboard,
    facts: factStats,
  };
}

/* Where a fid stands today and all-time — the per-user half the UI needs. */
export interface MeState {
  fid: number;
  handle: string;
  answeredToday: number;
  remainingToday: number;
  answersAllTime: number;
  rank: number | null;
}

export async function computeMe(env: Env, fid: number): Promise<MeState> {
  const username = await getUsername(env, fid);
  const answered = await answeredToday(env, fid);
  const allTime = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM answers WHERE fid = ?1`,
  ).bind(fid).first<number>("n") ?? 0;

  let rank: number | null = null;
  if (allTime > 0) {
    /* rank = 1 + wallets strictly ahead of me by answer count */
    const ahead = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM (
         SELECT fid, COUNT(*) AS c FROM answers GROUP BY fid HAVING c > ?1
       )`,
    ).bind(allTime).first<number>("n") ?? 0;
    rank = ahead + 1;
  }

  return {
    fid,
    handle: handle(username, fid),
    answeredToday: answered,
    remainingToday: Math.max(0, MAX_ANSWERS_PER_DAY - answered),
    answersAllTime: allTime,
    rank,
  };
}
