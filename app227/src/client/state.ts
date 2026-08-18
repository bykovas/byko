import {
  FIXTURE_CHAIN,
  FIXTURE_CHECK,
  FIXTURE_GAME,
  fetchClaimEnrichment,
  fetchHolderEnrichment,
  type ChainFigures,
  type CheckData,
  type GameFigures,
} from "./data";
import { apiAnswer, apiAuth, fetchMetrics, type MeState } from "./api";
import type { Metrics, Verdict } from "../shared/types";

export interface AppState {
  claimed: boolean;
  readonly noAdvance: boolean;
  chain: ChainFigures;
  game: GameFigures;
  check: CheckData;
  /* today's facts, served one at a time — second opens after the first */
  checks: CheckData[];
  checkIndex: number;
  /* the Record: real numbers from /api/metrics; starts empty-honest */
  record: Metrics | null;
  me: MeState | null;
  /* local fallback when unauthed (site preview): answers cast this session */
  answeredLocal: number;
  localAnswers: { claim_id: string; verdict: Verdict }[];
  dayClosedFlag: boolean;
  /* the real transfer of this visit, when the treasury sent one */
  advanceTx: string | null;
  advanceTxUrl: string | null;
}

type StateListener = (kind: "chain" | "check" | "record") => void;

const listeners = new Set<StateListener>();
let enrichmentStarted = false;

const fixtureCheck = (): CheckData => ({
  ...FIXTURE_CHECK,
  sources: [{ ...FIXTURE_CHECK.sources[0] }, { ...FIXTURE_CHECK.sources[1] }],
});

const state: AppState = {
  claimed: false,
  noAdvance: new URLSearchParams(location.search).get("noadvance") === "1",
  chain: { ...FIXTURE_CHAIN },
  game: { ...FIXTURE_GAME },
  check: fixtureCheck(),
  checks: [fixtureCheck()],
  checkIndex: 0,
  record: null,
  me: null,
  answeredLocal: 0,
  localAnswers: [],
  dayClosedFlag: false,
  advanceTx: null,
  advanceTxUrl: null,
};

export function getState(): Readonly<AppState> {
  return state;
}

export function markClaimed(txHash: string | null = null, txUrl: string | null = null): void {
  state.claimed = true;
  state.advanceTx = txHash;
  state.advanceTxUrl = txUrl;
}

/* Advance to the second fact of the day. Returns false when there is none. */
export function advanceCheck(): boolean {
  if (state.checkIndex >= state.checks.length - 1) return false;
  state.checkIndex += 1;
  state.check = state.checks[state.checkIndex];
  return true;
}

/* The day is closed when every fact of today is answered — from the worker
   when authed, from the session counter on the unauthed preview. */
export function dayClosed(): boolean {
  if (state.dayClosedFlag) return true;
  const cap = Math.min(2, state.checks.length);
  const answered = state.me ? state.me.answeredToday : state.answeredLocal;
  return answered >= cap;
}

/* Cast the verdict: POST when authed (fire-and-report), local count either
   way so the prototype flow works everywhere. Refreshes the Record after. */
/* What this wallet said about a fact today — from the worker when authed,
   from the session otherwise. Null when it has not answered it. */
export function myVerdict(claimId: string): Verdict | null {
  const mine = state.me?.todayAnswers ?? state.localAnswers;
  return mine.find((a) => a.claim_id === claimId)?.verdict ?? null;
}

export function castAnswer(verdict: Verdict, argument: string | null): void {
  const claimId = state.check.id;
  state.answeredLocal += 1;
  state.localAnswers.push({ claim_id: claimId, verdict });
  void apiAnswer(claimId, verdict, argument).then((result) => {
    if (result.ok) {
      if (typeof result.answeredToday === "number" && state.me) state.me.answeredToday = result.answeredToday;
      if (result.dayClosed) state.dayClosedFlag = true;
    } else if (result.reason === "limit") {
      state.dayClosedFlag = true;
    }
    void refreshRecord();
  });
}

export async function refreshRecord(): Promise<void> {
  const metrics = await fetchMetrics();
  if (!metrics) return;
  state.record = metrics;
  notify("record");
}

/* Returning users skip the onboarding: the flag is set once the pitch has
   been seen to the end (the go screen). */
const VISITED_KEY = "byko227-visited";

export function markVisited(): void {
  try { localStorage.setItem(VISITED_KEY, "1"); } catch { /* private mode */ }
}

export function hasVisited(): boolean {
  try { return localStorage.getItem(VISITED_KEY) === "1"; } catch { return false; }
}

export function subscribe(listener: StateListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(kind: "chain" | "check" | "record"): void {
  for (const listener of listeners) listener(kind);
}

export function startEnrichment(): void {
  if (enrichmentStarted) return;
  enrichmentStarted = true;

  void fetchHolderEnrichment().then((figures) => {
    if (!figures) return;
    state.chain.holders = figures.holders;
    state.chain.pool = figures.pool;
    notify("chain");
  });

  void fetchClaimEnrichment().then((checks) => {
    if (!checks || checks.length === 0) return;
    state.checks = checks;
    state.checkIndex = Math.min(state.checkIndex, checks.length - 1);
    state.check = checks[state.checkIndex];
    resumeFromMe();
    notify("check");
  });

  void refreshRecord();

  /* Identify inside the container; the site preview stays anonymous. */
  void apiAuth().then((me) => {
    if (!me) return;
    state.me = me;
    if (me.remainingToday === 0) state.dayClosedFlag = true;
    resumeFromMe();
    notify("record");
  });
}

/* Resume mid-day: skip the facts this fid already answered (the worker sends
   their ids), close the day when every fact of today is done. Runs whenever
   either half (the feed or the identity) arrives — order is not guaranteed. */
function resumeFromMe(): void {
  if (!state.me) return;
  const answered = new Set(state.me.answeredClaimIds);
  if (state.checks.every((c) => answered.has(c.id))) {
    state.dayClosedFlag = true;
    return;
  }
  const next = state.checks.findIndex((c) => !answered.has(c.id));
  if (next > state.checkIndex) {
    state.checkIndex = next;
    state.check = state.checks[next];
  }
}
