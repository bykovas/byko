/* Shared between worker and client. */

/* --- Cloudflare bindings (the slices we actually use) --- */

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: unknown;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(column?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
  exec(query: string): Promise<unknown>;
}

export interface KVNamespace {
  get(key: string, type?: "text"): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface DurableObjectNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(request: Request): Promise<Response> };
}

export interface Queue {
  send(message: unknown): Promise<void>;
}

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB: D1Database;
  KV: KVNamespace;
  FID_LOCK: DurableObjectNamespace;
  JOBS: Queue;
  RPC_URL: string;
  CLAIMS_URL: string;
  /* The money path (phase 4) — dormant until ADVANCES_OPEN = "1". */
  ADVANCES_OPEN: string;
  CHAIN_ID: string;
  TOKEN_ADDRESS: string;
  OPS_ADDRESS: string;
  ADVANCE_AMOUNT: string;        /* whole tokens per claim */
  MAX_CLAIMS_LIFETIME: string;
  MAX_ADVANCES_PER_DAY: string;  /* global faucet cap */
  MIN_OPS_BALANCE: string;       /* whole tokens — faucet floor */
  /* Secrets (wrangler secret put), all optional at runtime — routes degrade
     gracefully when a secret is absent so a fresh deploy never 500s. */
  NEYNAR_API_KEY?: string;
  WEBHOOK_SHARED_SECRET?: string;
  ADMIN_TOKEN?: string;
  OPS_PRIVATE_KEY?: string;      /* the ops wallet key — the only key anywhere */
}

/* --- Domain --- */

/* One fact from https://byko.bykovas.lt/data/claims.json — the shape
   emitted by scripts/emit-claims.mjs in the site repo. */
export interface Claim {
  id: string;
  entry: string;                       /* diary slug the claim comes from */
  text: string;                        /* ≤140 chars */
  type: "A" | "B" | "C";
  frozen_at?: { block: number };       /* required for type B */
  sources: [ClaimSource, ClaimSource]; /* exactly two */
  opens_at: string;                    /* YYYY-MM-DD */
}

export interface ClaimSource {
  label: string;
  url: string;
}

export type Verdict = "yes" | "no" | "cant";

/* Response of GET /api/metrics — the Record numbers the app reports back.
   Never chain-read: the client renders these in ink, never blue. */
export interface Metrics {
  today: {
    date: string;
    facts: number;                     /* how many claims open today */
    answers: number;                   /* answers cast today */
    readers: number;                   /* distinct wallets that answered today */
    breakdown: { yes: number; no: number; cant: number };
  };
  allTime: { answers: number };
  leaderboard: LeaderRow[];
  facts: FactStat[];                   /* today's open claims, with their yes-readers */
}

export interface LeaderRow {
  rank: number;
  fid: number;
  handle: string;
  answers: number;
}

export interface FactStat {
  claim_id: string;
  answers: number;
  yes: number;
  no: number;
  cant: number;
  readers: string[];                   /* up to 3 handles that answered yes */
  sealed: boolean;                     /* three matching yes */
}
