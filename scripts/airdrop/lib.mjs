/* Shared plumbing for the airdrop experiment tools.
 *
 * Same discipline as the rest of scripts/: plain node ESM, no dependencies
 * beyond what a command actually needs, run by hand from the repository
 * root, output committed. Reads go through the keyed node first — a public
 * endpoint rate-limits long before a cohort scan finishes.
 */

import { readFileSync, existsSync } from "node:fs";

export const BYKO = "0x078bb16e24C8931Fc007928c370422e5e38F4372";
export const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const POOL = "0x02dd4285ad38ea93d021ca854016a839b0b2a6ca";
export const DEAD = "0x000000000000000000000000000000000000dEaD";
export const CHAIN_ID = 8453;

export const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/* Where a "bought something with USDC" transfer lands. Base's main venues;
   the label travels with the cohort row so the method is auditable. */
export const DEX_SINKS = {
  "0x6cb442acf35158d5eda88fe602221b67b400be3e": "Aerodrome router",
  "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43": "Aerodrome router v2",
  "0x2626664c2603336e57b271c5c0b26f421741e481": "Uniswap v3 router",
  "0x6ff5693b99212da76ad316178a184ab56d299b43": "Uniswap universal router",
  "0x198ef79f1f515f02dfe9e3115ed9fc07183f02fc": "Uniswap universal router 2",
  "0x1111111254eeb25477b68fb85ed929f73a960582": "1inch v5",
  "0x111111125421ca6dc452d289314280a0f8842a65": "1inch v6",
  "0xdef1c0ded9bec7f1a1670819833240f027b25eff": "0x exchange proxy",
  "0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae": "LI.FI diamond",
  "0x3a23f943181408eac424116af7b7790c94cb97a5": "Socket gateway",
  "0x02dd4285ad38ea93d021ca854016a839b0b2a6ca": "BYKO/USDC pool",
};

const RPCS = [
  process.env.DRPC_URL,
  "https://mainnet.base.org",
  "https://base-rpc.publicnode.com",
  "https://base.drpc.org",
  "https://1rpc.io/base",
].filter(Boolean);

let rpcCalls = 0;

export function rpcStats() {
  return { calls: rpcCalls, nodes: RPCS.length };
}

/* One JSON-RPC call, walking the node list until one answers. */
export async function rpc(method, params = []) {
  rpcCalls += 1;
  let last = null;
  for (const url of RPCS) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error(`http ${response.status}`);
        const body = await response.json();
        if (body.error) throw new Error(body.error.message ?? "rpc error");
        return body.result;
      } catch (error) {
        last = error;
        await sleep(150 * (attempt + 1));
      }
    }
  }
  throw new Error(`rpc ${method} failed: ${last?.message ?? "unknown"}`);
}

/* Batched JSON-RPC — one HTTP round trip for many calls. Nodes under load
   answer a batch with a bare error object instead of an array, so every node
   gets two tries with a pause before the batch is called lost. */
export async function rpcBatch(calls) {
  if (calls.length === 0) return [];
  rpcCalls += calls.length;
  const payload = calls.map((call, index) => ({
    jsonrpc: "2.0", id: index, method: call.method, params: call.params ?? [],
  }));
  let last = null;
  for (const url of RPCS) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) throw new Error(`http ${response.status}`);
        const body = await response.json();
        if (!Array.isArray(body)) {
          throw new Error(`batch: ${body?.error?.message ?? "not an array"}`);
        }
        const out = new Array(calls.length).fill(undefined);
        for (const item of body) if (!item.error) out[item.id] = item.result;
        /* A node that refuses one element of a batch still answers HTTP 200,
           with a per-element error, and that slot comes back empty. Returning
           the array as-is made the caller read a missing answer as the number
           zero: three airdrop wallets holding 227 BYKO each were published as
           "emptied", because balanceOf never answered for them. Ask again for
           exactly the empty slots, one call at a time, and let rpc() throw if
           they still will not answer — a snapshot that invents a zero is worse
           than a snapshot that did not happen. */
        const missing = [];
        out.forEach((value, index) => { if (value === undefined) missing.push(index); });
        for (const index of missing) {
          out[index] = await rpc(calls[index].method, calls[index].params ?? []);
        }
        return out;
      } catch (error) {
        last = error;
        await sleep(400 * (attempt + 1));
      }
    }
  }
  throw new Error(`rpc batch failed: ${last?.message ?? "unknown"}`);
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const hexToBig = (hex) => {
  /* Backstop for the same mistake one layer down: no answer is not a zero. */
  if (hex === null || hex === undefined) throw new Error("hexToBig: nothing to convert");
  return hex && hex !== "0x" ? BigInt(hex) : 0n;
};
export const toUnits = (raw, decimals) => Number(hexToBig(raw)) / 10 ** decimals;
export const topicToAddress = (topic) => "0x" + topic.slice(-40).toLowerCase();

export function callData(selector, ...addresses) {
  return selector + addresses.map((a) => a.slice(2).toLowerCase().padStart(64, "0")).join("");
}

export const SELECTORS = {
  balanceOf: "0x70a08231",
  totalSupply: "0x18160ddd",
};

/* The project's own wallets — one source, the same file the tally and the
   home-page register read. Never a second list. */
export function projectAddresses(root = ".") {
  const path = `${root}/website/data/founder-wallets.json`;
  const wallets = JSON.parse(readFileSync(path, "utf8"));
  const list = Array.isArray(wallets) ? wallets : wallets.wallets ?? [];
  const set = new Set(list.map((w) => (typeof w === "string" ? w : w.address).toLowerCase()));
  set.add(POOL.toLowerCase());
  set.add(DEAD.toLowerCase());
  set.add("0x0000000000000000000000000000000000000000");
  return set;
}

export function readJson(path, fallback = null) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback;
}

export function nowIso() {
  return new Date().toISOString();
}

/* A field with its provenance: every number in a snapshot says where it came
   from and when, so three snapshots can be diffed without guessing. */
export function field(value, source, note) {
  return note === undefined ? { value, source } : { value, source, note };
}

export function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows, columns) {
  const head = columns.join(",");
  const body = rows.map((row) => columns.map((c) => csvEscape(row[c])).join(",")).join("\n");
  return `${head}\n${body}\n`;
}
