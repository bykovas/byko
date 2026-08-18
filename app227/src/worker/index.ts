/* byko-app227 worker — routing skeleton.
 *
 * Every /api/* route answers 501 with its own name until implemented;
 * everything else falls through to static assets (dist/client, built by
 * vite; run_worker_first in wrangler.toml keeps /api/* on the worker). */
import type { Env } from "../shared/types";
import { auth } from "./routes/auth";
import { profile } from "./routes/profile";
import { advance } from "./routes/advance";
import { checks } from "./routes/checks";
import { metrics } from "./routes/metrics";
import { webhook } from "./routes/webhook";

export { FidLock } from "./do/fid-lock";

type Handler = (request: Request, env: Env) => Promise<Response>;

const routes: Record<string, Handler> = {
  "/api/auth": auth,
  "/api/profile": profile,
  "/api/advance": advance,
  "/api/checks": checks,
  "/api/metrics": metrics,
  "/api/webhook": webhook,
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const handler = routes[url.pathname];
    if (handler) return handler(request, env);
    return env.ASSETS.fetch(request);
  },

  /* wired in wrangler.toml; empty until the jobs exist */
  async queue(_batch: unknown, _env: Env): Promise<void> {},
  async scheduled(_controller: unknown, _env: Env): Promise<void> {},
};
