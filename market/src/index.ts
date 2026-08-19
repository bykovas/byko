/* byko-market worker.
 *
 * /api/wash  — public, read-only, the whole disclosed readout.
 * /api/kick  — admin (Bearer ADMIN_TOKEN): seed rows and arm the schedulers.
 * /api/halt  — admin: stop one arm (or all) now.
 * scheduled  — settle pending trades, run the collector, re-arm lost alarms.
 *
 * The trading itself lives in the ArmLock Durable Object's alarm; this file
 * never moves money. Nothing sends until MARKET_OPEN = "1" AND an arm has been
 * kicked AND the rules hash matches — see wrangler.toml. */
import * as Sentry from "@sentry/cloudflare";
import type { Env } from "./types";
import { RULES } from "./lib/rules";
import { json, error, methodNotAllowed } from "./lib/respond";
import { washApi } from "./lib/wash-api";
import { confirmTrades } from "./lib/confirm";
import { collect } from "./lib/collector";
import { event } from "./lib/db";
import { ArmLock as ArmLockDO } from "./do/arm-lock";

const sentryOptions = (env: Env) => ({
  dsn: env.SENTRY_DSN ?? "",
  environment: env.MARKET_OPEN === "1" ? "prod-open" : "prod",
  tracesSampleRate: 1.0,
  sendDefaultPii: false,
});

export const ArmLock = Sentry.instrumentDurableObjectWithSentry(sentryOptions, ArmLockDO);

function authed(request: Request, env: Env): boolean {
  const header = request.headers.get("Authorization") ?? "";
  return Boolean(env.ADMIN_TOKEN) && header === `Bearer ${env.ADMIN_TOKEN}`;
}

async function seedRows(env: Env): Promise<void> {
  for (const r of RULES.arms) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO wallets (address, arm, label, token, pool, enabled)
       VALUES (?1, ?2, ?3, ?4, ?5, 1)`,
    ).bind(r.wallet, r.id, r.label, r.token, r.pool).run();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO wallet_state (address, halted) VALUES (?1, 0)`,
    ).bind(r.wallet).run();
  }
}

async function arm(env: Env, id: string): Promise<void> {
  const stub = env.ARM.get(env.ARM.idFromName(id));
  await stub.fetch(new Request("https://arm/op", {
    method: "POST", body: JSON.stringify({ op: "arm", arm: id }),
  }));
}

async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/api/wash") {
    if (request.method !== "GET") return methodNotAllowed();
    return washApi(request, env);
  }

  if (url.pathname === "/api/kick") {
    if (request.method !== "POST") return methodNotAllowed();
    if (!authed(request, env)) return error("unauthorized", 401);
    await seedRows(env);
    /* clear a deliberate halt so a re-open resumes, then arm each enabled arm */
    for (const r of RULES.arms) {
      await env.DB.prepare(
        `UPDATE wallet_state SET halted = 0, halt_reason = NULL WHERE address = ?1`,
      ).bind(r.wallet).run();
      await arm(env, r.id);
    }
    await event(env, null, "resume", `kicked ${RULES.arms.map((a) => a.id).join(", ")}`);
    return json({ kicked: RULES.arms.map((a) => a.id), market_open: env.MARKET_OPEN === "1" });
  }

  if (url.pathname === "/api/halt") {
    if (request.method !== "POST") return methodNotAllowed();
    if (!authed(request, env)) return error("unauthorized", 401);
    const body = (await request.json().catch(() => ({}))) as { arm?: string };
    const targets = body.arm ? RULES.arms.filter((a) => a.id === body.arm) : RULES.arms;
    for (const r of targets) {
      const stub = env.ARM.get(env.ARM.idFromName(r.id));
      await stub.fetch(new Request("https://arm/op", { method: "POST", body: JSON.stringify({ op: "halt" }) }));
    }
    return json({ halted: targets.map((a) => a.id) });
  }

  /* Force a collector pass now, without waiting for the hourly window — used
     after a deploy changes what is collected. */
  if (url.pathname === "/api/collect") {
    if (request.method !== "POST") return methodNotAllowed();
    if (!authed(request, env)) return error("unauthorized", 401);
    try { await collect(env); } catch (err) {
      await event(env, null, "error", `collect: ${String((err as Error)?.message ?? err).slice(0, 200)}`);
      return error("collector failed", 500);
    }
    return json({ collected: true });
  }

  /* The human half of the stop condition. Base App has no API, so the owner's
     screenshot verdict is entered here and lands in the same flag_checks table
     as every machine probe — otherwise the observation the experiment declared
     as its human endpoint would be unrecordable.
       POST /api/observe {"arm":"byko","value":"scam"|"clean","note":"..."} */
  if (url.pathname === "/api/observe") {
    if (request.method !== "POST") return methodNotAllowed();
    if (!authed(request, env)) return error("unauthorized", 401);
    const b = (await request.json().catch(() => ({}))) as
      { arm?: string; source?: string; value?: string; note?: string; method?: string;
        ok?: boolean; holders?: number; buys_24h?: number; sells_24h?: number; vol_24h?: number };
    const armId = b.arm ?? "";
    if (!RULES.arms.some((a) => a.id === armId)) return error("unknown arm", 400);
    if (!b.value) return error("value required", 400);
    const source = b.source ?? "base-app";
    /* 'manual' is a human with a screenshot; 'api-local' is the same public
       endpoint asked from a network that is not Cloudflare's shared egress,
       which is the only way three of these hosts answer us at all. The method
       is recorded so a reader can tell which is which. */
    const method = b.method === "api-local" ? "api-local" : "manual";
    const ok = b.ok === false ? 0 : 1;
    const baseline = await env.DB.prepare(
      `SELECT value FROM flag_checks WHERE arm = ?1 AND source = ?2 AND ok = 1 ORDER BY id ASC LIMIT 1`,
    ).bind(armId, source).first<string>("value");
    const changed = baseline != null && baseline !== b.value ? 1 : 0;
    await env.DB.prepare(
      `INSERT INTO flag_checks (checked_at, arm, source, method, ok, value, raw, changed, note)
       VALUES (datetime('now'), ?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7)`,
    ).bind(armId, source, method, ok, b.value, ok ? changed : 0, b.note ?? null).run();
    /* Two figures reach the market row only through here, because the Worker
       cannot reach the sources that report them: the holder count (GoPlus) and
       the 24h buy/sell counts (GeckoTerminal — CMC's DEX side covers the rest
       of the row but not these). They belong to the market row, not to the
       verdict grid. Each column is written only when the probe actually has a
       number for it: a probe that failed must not blank a column that was
       measured an hour ago. Column names come from this fixed list, never
       from the request. */
    const patch: Array<[string, number | string]> = [];
    const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
    if (num(b.holders)) patch.push(["holders", b.holders as number]);
    if (num(b.buys_24h)) patch.push(["buys_24h", b.buys_24h as number]);
    if (num(b.sells_24h)) patch.push(["sells_24h", b.sells_24h as number]);
    if (b.vol_24h != null && Number.isFinite(Number(b.vol_24h))) patch.push(["vol_24h", String(b.vol_24h)]);
    /* Stamp when the probe actually measured, not when the row it lands on was
       created. The probe writes onto the newest sample row, so borrowing that
       row's sampled_at would have dated a reading taken at :17 as though it
       came from the collector pass at :50 — off by up to the whole collector
       interval, on a figure the page prints as "measured at". */
    if (num(b.holders)) patch.push(["holders_at", "now"]);
    if (num(b.buys_24h)) patch.push(["trades_at", "now"]);
    for (const [column, value] of patch) {
      const set = value === "now" ? `${column} = datetime('now')` : `${column} = ?2`;
      const stmt = env.DB.prepare(
        `UPDATE market_samples SET ${set}
          WHERE id = (SELECT id FROM market_samples WHERE arm = ?1 ORDER BY id DESC LIMIT 1)`,
      );
      await (value === "now" ? stmt.bind(armId) : stmt.bind(armId, value)).run();
    }
    return json({ recorded: { arm: armId, source, method, ok: ok === 1, value: b.value, changed: changed === 1 } });
  }

  if (url.pathname.startsWith("/api/")) return error("not found", 404);
  return json({ service: "byko-market", see: "/api/wash" });
}

/* re-arm any enabled, non-halted arm whose alarm looks lost */
async function heartbeat(env: Env): Promise<void> {
  if (env.MARKET_OPEN !== "1") return;
  for (const r of RULES.arms) {
    const s = await env.DB.prepare(
      `SELECT s.halted, s.next_fire_at FROM wallet_state s WHERE s.address = ?1`,
    ).bind(r.wallet).first<{ halted: number; next_fire_at: string | null }>();
    if (!s || s.halted === 1) continue;
    const due = s.next_fire_at ? Date.parse(s.next_fire_at) : 0;
    if (!due || due < Date.now() - 15 * 60_000) {
      await event(env, r.id, "resume", "heartbeat re-armed a lost alarm");
      await arm(env, r.id);
    }
  }
}

export default Sentry.withSentry(sentryOptions, {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handle(request, env);
    } catch (err) {
      Sentry.captureException(err);
      console.error("market", err);
      return error("internal error", 500);
    }
  },
  async scheduled(_c: unknown, env: Env): Promise<void> {
    /* bookkeeping runs regardless of the kill switch; only sending is gated */
    await confirmTrades(env);
    /* The cron ticks every 10 minutes so trades settle promptly, but the
       classifiers are polled HOURLY as declared — asking GoPlus six times an
       hour earns a 4029 rate limit, which is how a throttle would end up
       recorded as if it were the classifier's opinion. */
    const last = await env.DB.prepare(
      `SELECT MAX(checked_at) AS t FROM flag_checks WHERE method = 'api'`,
    ).first<string>("t");
    const dueForCollect = !last || Date.now() - Date.parse(last.replace(" ", "T") + "Z") > 55 * 60_000;
    if (dueForCollect) {
      try { await collect(env); } catch (err) { await event(env, null, "error", `collector: ${String((err as Error)?.message ?? err).slice(0, 200)}`); }
    }
    await heartbeat(env);
  },
});
