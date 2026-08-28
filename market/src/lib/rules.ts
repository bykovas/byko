import rulesJson from "../../rules.json";

/* The pre-registered parameters, bundled into the worker at build time.
 *
 * The worker never trades unless the canonical hash of this bundled object
 * equals the sha256 stored in the D1 `rules` row — which the owner inserts by
 * hand from the committed file (scripts/hash-rules.mjs prints the value).
 * Editing rules.json therefore changes the running hash, and the arm halts
 * with a `rules-mismatch` event until the row is deliberately updated. There
 * is no path to quietly retune a parameter mid-run. */

export interface ArmRules {
  id: string;
  wallet: string;
  label: string;
  token: string;
  pool: string;
  stop: { max_days: number | null; on_signal_cleared: boolean };
  guards: { max_gross_usdc: number; max_price_deviation_pct: number };
}

export interface Rules {
  declared_at: string;
  chain_id: number;
  venue: { router: string; factory: string; quote: string; stable: boolean };
  strategy: {
    interval_minutes: [number, number];
    interval_curve?: "uniform" | "log-uniform";
    trade_usdc: [number, number];
    band_usdc: [number, number];
    run_reverse_pct: [number, number];
    max_trade_pct_pool: number;
    contrarian_pct: number;
    slippage_bps: number;
  };
  arms: ArmRules[];
}

export const RULES = rulesJson as unknown as Rules;

export function armRules(id: string): ArmRules | undefined {
  return RULES.arms.find((a) => a.id === id);
}

/* Deterministic serialization: object keys sorted recursively, arrays in
 * order, no whitespace. scripts/hash-rules.mjs implements the identical
 * algorithm so the two hashes always agree. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k])).join(",") + "}";
}

export async function rulesHash(): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalize(RULES));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
