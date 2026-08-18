/* byko-app227 worker.
 *
 * /api/* is dispatched here by exact pathname (run_worker_first in
 * wrangler.toml); every other request is served from the built client
 * (dist/client) via the ASSETS binding. Each route checks its own method
 * and answers OPTIONS for the authed POSTs.
 *
 * Live: auth, answer, metrics, me, profile — the identity + verdicts + Record
 * pipeline that makes the stats and leaderboard real. Deferred: advance
 * (phase 4, money on Sepolia first), webhook (phase 3, notifications). */
import * as Sentry from "@sentry/cloudflare";
import type { Env } from "../shared/types";
import { confirmAdvances } from "./lib/confirm";
import { error } from "./lib/respond";
import { auth } from "./routes/auth";
import { answer } from "./routes/answer";
import { metrics } from "./routes/metrics";
import { me } from "./routes/me";
import { profile } from "./routes/profile";
import { advance } from "./routes/advance";
import { ledger } from "./routes/ledger";
import { webhook } from "./routes/webhook";

import { FidLock as TreasuryDO } from "./do/fid-lock";

const sentryOptions = (env: Env) => ({
  dsn: env.SENTRY_DSN,
  environment: env.ADVANCES_OPEN === "1" ? "prod-faucet-open" : "prod",
  /* the money path is small and rare: sample everything, miss nothing */
  tracesSampleRate: 1.0,
  sendDefaultPii: false,
});

/* the treasury reports its own failures too — money errors are the ones
   that must never be lost */
export const FidLock = Sentry.instrumentDurableObjectWithSentry(sentryOptions, TreasuryDO);

type Handler = (request: Request, env: Env) => Promise<Response>;

const routes: Record<string, Handler> = {
  "/api/auth": auth,
  "/api/answer": answer,
  "/api/metrics": metrics,
  "/api/me": me,
  "/api/profile": profile,
  "/api/advance": advance,
  "/api/ledger": ledger,
  "/api/webhook": webhook,
};

export default Sentry.withSentry(sentryOptions, {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const handler = routes[url.pathname];
    if (handler) {
      /* every route failure yields the same JSON+CORS shape, never a raw 500.
         The catch is why the report is explicit: withSentry only sees what
         escapes the handler, and nothing here is allowed to escape. */
      try {
        return await handler(request, env);
      } catch (err) {
        Sentry.setContext("route", { path: url.pathname, method: request.method });
        Sentry.captureException(err);
        console.error(url.pathname, err);
        return error("internal error", 500);
      }
    }
    /* an unknown /api/* path is a 404, not the SPA's index.html */
    if (url.pathname.startsWith("/api/")) return error("not found", 404);
    return env.ASSETS.fetch(request);
  },

  /* wired in wrangler.toml; the queue stays empty until dispute payouts */
  async queue(_batch: unknown, _env: Env): Promise<void> {},
  async scheduled(_controller: unknown, env: Env): Promise<void> {
    /* the flag gates SENDING, never bookkeeping: an emergency close must not
       stop in-flight rows from being confirmed or expired */
    await confirmAdvances(env);
  },
});
