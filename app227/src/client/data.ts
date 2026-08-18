import type { Claim } from "../shared/types";

export interface ChainFigures {
  tx: number;
  trades: number;
  pool: number;
  holders: number;
  supply: number;
}

export interface GameFigures {
  readers: number;
  working: number;
  paid: number;
  sent: number;
  nextCheck: string;
  checkNumber: number;
}

export interface CheckSource {
  label: string;
  detail: string;
  url: string;
  live: boolean;
}

export interface CheckData {
  id: string;                          /* claim id from the feed */
  number: number;                      /* 1-based position — "check #NNN" */
  entry: string;
  text: string;
  sources: [CheckSource, CheckSource];
  question: string;
}

export interface HolderEnrichment {
  holders: number;
  pool: number;
}

export const FIXTURE_CHAIN: Readonly<ChainFigures> = {
  tx: 285,
  trades: 34,
  pool: 727_269,
  holders: 6,
  supply: 790_227,
};

export const FIXTURE_GAME: Readonly<GameFigures> = {
  readers: 37,
  working: 12,
  paid: 85,
  sent: 19_295,
  nextCheck: "07:41",
  checkNumber: 38,
};

export const FIXTURE_CHECK: Readonly<CheckData> = {
  id: "fixture-e19",
  number: 38,
  entry: "e19",
  text: "33 of the 34 buys from the pool came from the author's own wallets.",
  sources: [
    {
      label: "byko-flow.csv",
      detail: "100 Transfer events, repo",
      url: "https://github.com/bykovas/byko/blob/main/website/data/byko-flow.csv",
      live: false,
    },
    {
      label: "BaseScan",
      detail: "0x078b…4372 · transfers",
      url: "https://basescan.org/token/0x078bB16e24c8931fc007928c370422e5e38F4372",
      live: true,
    },
  ],
  question: "Does the public record support this claim?",
};

const REQUEST_TIMEOUT_MS = 2_500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function fetchJson(url: URL): Promise<unknown> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchHolderEnrichment(): Promise<HolderEnrichment | null> {
  const payload = await fetchJson(new URL("../api/holders", location.href));
  if (!isRecord(payload) || typeof payload.holders !== "number") return null;

  const excluded = payload.excluded;
  if (!isRecord(excluded) || !isRecord(excluded.pool) || typeof excluded.pool.balance !== "number") {
    return null;
  }

  if (!Number.isFinite(payload.holders) || !Number.isFinite(excluded.pool.balance)) return null;
  return {
    holders: Math.max(0, Math.round(payload.holders)),
    pool: Math.max(0, Math.round(excluded.pool.balance)),
  };
}

function claimSource(claim: Claim, index: 0 | 1): CheckSource {
  const source = claim.sources[index];
  return {
    label: source.label,
    detail: source.url,
    url: source.url,
    live: index === 1,
  };
}

function isClaim(value: unknown): value is Claim {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.entry !== "string") return false;
  if (typeof value.text !== "string" || !Array.isArray(value.sources) || value.sources.length !== 2) return false;
  return value.sources.every((source) =>
    isRecord(source) && typeof source.label === "string" && typeof source.url === "string"
  );
}

/* The facts of the day: every claim whose opens_at is the latest date that
   has already arrived (local time). Two per day by design — the state layer
   serves them one at a time, second after the first. */
export async function fetchClaimEnrichment(): Promise<CheckData[] | null> {
  const payload = await fetchJson(new URL("../data/claims.json", location.href));
  if (!isRecord(payload) || !Array.isArray(payload.claims) || payload.claims.length === 0) return null;
  const feed: unknown[] = payload.claims;

  const today = new Date().toLocaleDateString("en-CA");
  const opened = feed.filter(
    (claim): claim is Claim & { opens_at: string } =>
      isClaim(claim) && typeof (claim as { opens_at?: unknown }).opens_at === "string" &&
      (claim as { opens_at: string }).opens_at <= today,
  );
  if (opened.length === 0) return null;

  const latest = opened.reduce((max, claim) => (claim.opens_at > max ? claim.opens_at : max), "");
  return opened
    .filter((claim) => claim.opens_at === latest)
    .map((claim) => ({
      id: claim.id,
      /* "check #NNN" — position in the FULL feed, not among today's */
      number: feed.findIndex((c) => isClaim(c) && c.id === claim.id) + 1,
      entry: claim.entry,
      text: claim.text,
      sources: [claimSource(claim, 0), claimSource(claim, 1)],
      question: FIXTURE_CHECK.question,
    }));
}
