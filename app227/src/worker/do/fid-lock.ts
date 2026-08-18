import type { Env } from "../../shared/types";

/* One instance per fid. Everything that must not run twice for the same
   user — advancing a check, recording a result, triggering a send — will be
   serialised through here. Empty until wired. */
export class FidLock {
  constructor(_state: unknown, _env: Env) {}

  async fetch(_request: Request): Promise<Response> {
    return new Response("FidLock: not implemented\n", { status: 501 });
  }
}
