/* Every route answers this until it gains its logic. The name in the body
   is the contract: a 501 must say which route it is. */
export function notImplemented(route: string): Response {
  return new Response(JSON.stringify({ error: "not implemented", route }) + "\n", {
    status: 501,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
