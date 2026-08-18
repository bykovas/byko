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
import type { Env } from "../shared/types";
import { error } from "./lib/respond";
import { auth } from "./routes/auth";
import { answer } from "./routes/answer";
import { metrics } from "./routes/metrics";
import { me } from "./routes/me";
import { profile } from "./routes/profile";
import { advance } from "./routes/advance";
import { webhook } from "./routes/webhook";

export { FidLock } from "./do/fid-lock";

type Handler = (request: Request, env: Env) => Promise<Response>;

const routes: Record<string, Handler> = {
  "/api/auth": auth,
  "/api/answer": answer,
  "/api/metrics": metrics,
  "/api/me": me,
  "/api/profile": profile,
  "/api/advance": advance,
  "/api/webhook": webhook,
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const handler = routes[url.pathname];
    if (handler) {
      /* every route failure yields the same JSON+CORS shape, never a raw 500 */
      try {
        return await handler(request, env);
      } catch (err) {
        console.error(url.pathname, err);
        return error("internal error", 500);
      }
    }
    /* an unknown /api/* path is a 404, not the SPA's index.html */
    if (url.pathname.startsWith("/api/")) return error("not found", 404);
    return env.ASSETS.fetch(request);
  },

  /* wired in wrangler.toml; empty until the jobs exist (dispute payouts) */
  async queue(_batch: unknown, _env: Env): Promise<void> {},
  async scheduled(_controller: unknown, _env: Env): Promise<void> {},
};
