import type { Env } from "../../shared/types";
import { notImplemented } from "./_stub";

/* /api/metrics — stub. */
export async function metrics(_request: Request, _env: Env): Promise<Response> {
  return notImplemented("metrics");
}
