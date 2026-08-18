/* JSON responses with the CORS the mini-app needs. Everything answers with
   Access-Control-Allow-Origin: * — safe here because auth is a Bearer token,
   never a cookie, and Allow-Credentials is never set: a cross-origin caller
   gains nothing without a valid token of its own. */

const JSON_HEADERS = { "Content-Type": "application/json; charset=UTF-8" };

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body) + "\n", {
    status,
    headers: { ...JSON_HEADERS, "Access-Control-Allow-Origin": "*", ...extra },
  });
}

export function error(message: string, status: number, extra: Record<string, string> = {}): Response {
  return json({ error: message }, status, extra);
}

/* Preflight for the authorized POSTs. */
export function preflight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export function methodNotAllowed(): Response {
  return error("method not allowed", 405);
}
