/* The day is UTC, everywhere. The client picks facts by local date, but the
   Record — limits, stats, leaderboard — counts in one clock so two wallets in
   two timezones share one "today". */

export function today(): string {
  return new Date().toISOString().slice(0, 10); /* YYYY-MM-DD */
}

/* sha256 hex of a string — the tamper-evident stamp on each answer. */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
