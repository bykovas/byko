/* Cloudflare bindings (the slices we use) and the worker Env. */

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

export interface DurableObjectId {
  toString(): string;
}
export interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}
export interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

/* The DO storage + alarm surface we actually call. */
export interface DurableObjectStorage {
  getAlarm(): Promise<number | null>;
  setAlarm(scheduledTime: number): Promise<void>;
  deleteAlarm(): Promise<void>;
}
export interface DurableObjectState {
  storage: DurableObjectStorage;
  blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T>;
}

export interface Env {
  DB: D1Database;
  ARM: DurableObjectNamespace;

  /* plain config (wrangler.toml [vars]) */
  MARKET_OPEN: string;               /* "1" allows sending; anything else halts */
  CHAIN_ID: string;
  RPC_URL: string;

  /* secrets (wrangler secret put) — all optional at runtime so a fresh deploy
     never 500s; a missing key reads as a halted arm, never a crash */
  ARM_PRIVATE_KEY_BYKO?: string;
  ARM_PRIVATE_KEY_LUKO?: string;
  DRPC_URL?: string;
  ADMIN_TOKEN?: string;
  SENTRY_DSN?: string;
}
