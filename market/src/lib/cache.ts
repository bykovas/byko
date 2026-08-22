/* Last-good cache in D1.
 *
 * The rule the whole project runs on applies here too: a refusal is not data.
 * A collector that fails leaves the previous row untouched and records the
 * failure, so a reader gets the last figure that was actually measured, with
 * the time it was measured — never a zero, never a blank, and never a fresh
 * timestamp on a stale number.
 *
 * Table (applied by hand, see src/db/schema.sql):
 *   cache(key PRIMARY KEY, json, fetched_at, ok, note)
 */
import type { Env } from "../types";

export interface Cached<T> { value: T; at: string; ok: boolean; note: string | null }

export async function readCache<T>(env: Env, key: string): Promise<Cached<T> | null> {
  const row = await env.DB.prepare(
    `SELECT json, fetched_at, ok, note FROM cache WHERE key = ?1`,
  ).bind(key).first<{ json: string; fetched_at: string; ok: number; note: string | null }>();
  if (!row) return null;
  try {
    return { value: JSON.parse(row.json) as T, at: row.fetched_at, ok: row.ok === 1, note: row.note };
  } catch { return null; }
}

export async function writeCache(env: Env, key: string, value: unknown, note?: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO cache (key, json, fetched_at, ok, note)
     VALUES (?1, ?2, datetime('now'), 1, ?3)
     ON CONFLICT(key) DO UPDATE SET json = excluded.json, fetched_at = excluded.fetched_at,
       ok = 1, note = excluded.note`,
  ).bind(key, JSON.stringify(value), note ?? null).run();
}

/* Age in milliseconds, or Infinity when nothing has ever been stored. */
export function ageOf(entry: Cached<unknown> | null): number {
  if (!entry) return Infinity;
  const t = Date.parse(entry.at.replace(" ", "T") + "Z");
  return Number.isFinite(t) ? Date.now() - t : Infinity;
}
