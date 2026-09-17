import type { Env } from "../types";

/* Raw JSON-RPC with the node list walked in order, keyed node first. A node
   that answers with an error object is a refusal, not a reply, and the next
   node is asked. Shared by the confirmer and the stabilizer. */

function nodes(env: Env, method: string): string[] {
  /* DRPC's free key refuses eth_getLogs outright and mainnet.base.org answers
     Cloudflare's shared egress with 429 often enough to blind a look, so logs
     go to the nodes that serve them first (probed 17 Sep 2026). */
  const logs = method === "eth_getLogs"
    ? ["https://gateway.tenderly.co/public/base", "https://developer-access-mainnet.base.org",
       "https://base-rpc.publicnode.com", "https://base.gateway.tenderly.co"]
    : [];
  return [...logs, env.DRPC_URL, env.RPC_URL, "https://base-rpc.publicnode.com", "https://base.drpc.org"]
    .filter((u): u is string => Boolean(u))
    .filter((u, i, all) => all.indexOf(u) === i);
}

export async function rpc(env: Env, method: string, params: unknown[]): Promise<unknown> {
  let last: unknown = null;
  for (const url of nodes(env, method)) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) throw new Error(`rpc ${res.status}`);
      const body = (await res.json()) as { result?: unknown; error?: { message?: string } };
      if (body.error) throw new Error(body.error.message ?? "rpc error");
      return body.result;
    } catch (err) { last = err; }
  }
  throw last instanceof Error ? last : new Error("rpc unavailable");
}

export const big = (h: string) => (h && h !== "0x" ? BigInt(h) : 0n);
export const hexBlock = (n: number | bigint) => "0x" + n.toString(16);
