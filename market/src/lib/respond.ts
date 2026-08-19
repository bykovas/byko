/* JSON responses with open CORS. The only authed route is /api/kick, behind a
   Bearer ADMIN_TOKEN — never a cookie — so a wildcard origin gives a caller
   nothing without a token of its own. The public /api/wash is read-only. */

const JSON_HEADERS = { "Content-Type": "application/json; charset=UTF-8" };

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body) + "\n", {
    status,
    headers: { ...JSON_HEADERS, "Access-Control-Allow-Origin": "*", ...extra },
  });
}

export function error(message: string, status: number): Response {
  return json({ error: message }, status);
}

export function methodNotAllowed(): Response {
  return error("method not allowed", 405);
}
