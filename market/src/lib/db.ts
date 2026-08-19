import type { Env } from "../types";

/* Small shared writes. Kept in one place so "absence must be visible" is a
   single call everyone uses, not a habit each file has to remember. */

export async function event(env: Env, arm: string | null, kind: string, detail: string): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO events (at, arm, kind, detail) VALUES (datetime('now'), ?1, ?2, ?3)`,
    ).bind(arm, kind, detail).run();
  } catch (err) {
    console.error("event write failed", kind, err);
  }
}

export async function halt(env: Env, address: string, arm: string, reason: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE wallet_state SET halted = 1, halt_reason = ?2, next_fire_at = NULL,
        updated_at = datetime('now') WHERE address = ?1`,
  ).bind(address, reason).run();
  await event(env, arm, "halt", reason);
}
