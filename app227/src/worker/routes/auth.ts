import type { Env } from "../../shared/types";
import { notImplemented } from "./_stub";

/* /api/auth — stub. */
export async function auth(_request: Request, _env: Env): Promise<Response> {
  return notImplemented("auth");
}
