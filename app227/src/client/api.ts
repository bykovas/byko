import type { Metrics, Verdict } from "../shared/types";

/* The worker API. Absolute base so the same build works both on the app
   domain and on the site preview (byko.bykovas.lt/app227/) — the worker
   answers with open CORS. On the app domain the base collapses to "". */
const APP_HOST = "byko-app227.bykovas.lt";
const BASE = location.hostname === APP_HOST ? "" : `https://${APP_HOST}`;

const TIMEOUT_MS = 5_000;

async function request(path: string, init: RequestInit = {}): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${BASE}${path}`, { ...init, signal: controller.signal });
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

/* Quick Auth token — only obtainable inside the Farcaster container. Cached
   for the session; null everywhere else (site preview, plain browser). */
let tokenPromise: Promise<string | null> | null = null;

export function getToken(): Promise<string | null> {
  tokenPromise ??= (async () => {
    try {
      const { sdk } = await import("@farcaster/miniapp-sdk");
      if (!(await sdk.isInMiniApp())) return null;
      const { token } = await sdk.quickAuth.getToken();
      return token ?? null;
    } catch {
      return null;
    }
  })();
  return tokenPromise;
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export interface MeState {
  fid: number;
  handle: string;
  /* present in the /api/auth response — the verified wallet money goes to */
  address?: string | null;
  answeredToday: number;
  remainingToday: number;
  answeredClaimIds: string[];
  todayAnswers: { claim_id: string; verdict: Verdict }[];
  answersAllTime: number;
  rank: number | null;
}

/* POST /api/auth — identify, record the profile, learn where we stand. */
export async function apiAuth(): Promise<MeState | null> {
  const headers = await authHeaders();
  if (!headers) return null;
  const response = await request("/api/auth", { method: "POST", headers });
  if (!response || !response.ok) return null;
  return (await response.json()) as MeState;
}

export interface AnswerResult {
  ok: boolean;
  answeredToday?: number;
  dayClosed?: boolean;
  reason?: "duplicate" | "limit" | "offline";
}

/* POST /api/answer — cast the verdict. Unauthed contexts report offline and
   the caller falls back to the local prototype flow. */
export async function apiAnswer(claimId: string, verdict: Verdict, argument: string | null): Promise<AnswerResult> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, reason: "offline" };
  const response = await request("/api/answer", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ claim_id: claimId, verdict, argument: argument ?? undefined }),
  });
  if (!response) return { ok: false, reason: "offline" };
  if (response.status === 409) return { ok: false, reason: "duplicate" };
  if (response.status === 429) return { ok: false, reason: "limit" };
  if (!response.ok) return { ok: false, reason: "offline" };
  const body = (await response.json()) as { answeredToday: number; dayClosed: boolean };
  return { ok: true, answeredToday: body.answeredToday, dayClosed: body.dayClosed };
}

/* GET /api/metrics — the public Record. */
export async function fetchMetrics(): Promise<Metrics | null> {
  const response = await request("/api/metrics");
  if (!response || !response.ok) return null;
  return (await response.json()) as Metrics;
}
