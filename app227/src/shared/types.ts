/* Shared between worker and client.
 *
 * Binding types are deliberately loose in the skeleton: run `npm run types`
 * (wrangler types) when real work starts and replace Env with the generated
 * interface — the placeholders below only keep tsc honest until then. */

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB: unknown;        /* D1Database */
  KV: unknown;        /* KVNamespace */
  FID_LOCK: unknown;  /* DurableObjectNamespace */
  JOBS: unknown;      /* Queue */
  RPC_URL: string;
  CLAIMS_URL: string;
}

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
