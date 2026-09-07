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
  guards: { max_gross_usdc: number };
}

export interface Rules {
  declared_at: string;
  chain_id: number;
  venue: { router: string; factory: string; quote: string; stable: boolean };
  strategy: {
    interval_curve?: "uniform" | "log-uniform";
    /* TWELFTH AMENDMENT: cadence is a mode held for a drawn number of fires,
       so waits cluster into bursts and silences instead of arriving i.i.d. */
    modes: Array<{
      id: string;
      weight: number;
      interval_minutes: [number, number];
      fires: [number, number];
    }>;
    /* THIRTEENTH AMENDMENT: a skip reschedules from its own short range rather
       than the current mode's wait (a skip inside quiet used to stack another
       quiet-length sleep), and no drawn wait may exceed max_gap_minutes. */
    skip_wait_minutes: [number, number];
    max_gap_minutes: number;
    trade_usdc: [number, number];
    size_curve?: "uniform" | "log-uniform";
    /* Per-run cash targets replace the fixed band. A buy run aims down into
       run_floor_usdc, a sell run up into run_ceiling_usdc; the outer values of
       these ranges are the self-funding envelope the band used to hold. */
    run_floor_usdc: [number, number];
    run_ceiling_usdc: [number, number];
    max_trade_pct_pool: number;
    contrarian_pct: number;
    skip_pct: number;
    double_pct: number;
    double_seconds: [number, number];
    early_reversal_pct: number;
    spike_pct: number;
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
