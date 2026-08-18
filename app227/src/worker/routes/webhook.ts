import type { Env } from "../../shared/types";
import { notImplemented } from "./_stub";

/* /api/webhook — stub. */
export async function webhook(_request: Request, _env: Env): Promise<Response> {
  return notImplemented("webhook");
}
