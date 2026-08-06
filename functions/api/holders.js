var BYKO = "0x078bB16e24c8931fc007928c370422e5e38F4372";
/* Public keyless RPCs that serve eth_getLogs over 10,000-block ranges.
   All of them rate-limit Cloudflare's shared egress IPs sooner or later,
   so a keyed endpoint set as the RPC_URL env var in the Pages project is
   tried first; the public list is the fallback. */
var RPC_URLS = [
  "https://mainnet.base.org",
  "https://base.drpc.org"
];
var activeRpcUrls = RPC_URLS;
var TOTAL_SUPPLY = 790227;
/* BYKO creation tx: 0xeac11a3210328c21d1c96bb1c7dafbfdcb2f4a51b510049fa3cdf232b64b9378 */
var DEPLOY_BLOCK = 49430937;
var TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
var ZERO_ADDRESS = "0000000000000000000000000000000000000000";
var WEI = 1000000000000000000n;
var TOTAL_SUPPLY_WEI = BigInt(TOTAL_SUPPLY) * WEI;
/* mainnet.base.org caps eth_getLogs at a 10,000-block range */
var CHUNK_SIZE = 10000;
var TIER_NAMES = ["whale", "shark", "dolphin", "fish", "crab", "shrimp"];
/* Balances checkpoint so a request only scans blocks since the previous run.
   Durable in KV (the CARDS namespace binding is reused; BYKO_KV wins when
   bound); falls back to the per-colo cache (best effort) without either.
   A full rescan from DEPLOY_BLOCK stays within the subrequest limit only
   for a bounded backlog, so the checkpoint keeps this endpoint alive. */
var CHECKPOINT_KEY = "holders-checkpoint-v1";
var CHECKPOINT_CACHE_URL = "https://byko-checkpoint.invalid/" + CHECKPOINT_KEY;

function json(body, status, headers) {
  var outputHeaders = new Headers(headers || {});
  outputHeaders.set("Content-Type", "application/json; charset=UTF-8");
  return new Response(JSON.stringify(body), { status: status, headers: outputHeaders });
}

function hex(number) {
  return "0x" + number.toString(16);
}

async function rpc(method, params) {
  var i;
  var response;
  var payload;
  for (i = 0; i < activeRpcUrls.length; i++) {
    try {
      response = await fetch(activeRpcUrls[i], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: method, params: params })
      });
      if (!response.ok) continue;
      payload = await response.json();
      if (!payload || payload.error || payload.result === undefined || payload.result === null) continue;
      return payload.result;
    } catch (error) { /* try next endpoint */ }
  }
  throw new Error("rpc");
}

function addBalance(balances, address, amount) {
  var current = balances.get(address) || 0n;
  balances.set(address, current + amount);
}

function foldLogs(balances, logs) {
  var i;
  var log;
  var from;
  var to;
  var amount;
  for (i = 0; i < logs.length; i++) {
    log = logs[i];
    if (!log.topics || log.topics.length < 3 || !log.data) throw new Error("rpc");
    from = log.topics[1].slice(-40).toLowerCase();
    to = log.topics[2].slice(-40).toLowerCase();
    amount = BigInt(log.data);
    if (from !== ZERO_ADDRESS) addBalance(balances, from, -amount);
    if (to !== ZERO_ADDRESS) addBalance(balances, to, amount);
  }
}

function serializeCheckpoint(block, balances) {
  var entries = [];
  for (var entry of balances.entries()) {
    if (entry[1] > 0n) entries.push([entry[0], entry[1].toString(16)]);
  }
  return JSON.stringify({ block: block, balances: entries });
}

function parseCheckpoint(text) {
  var data;
  var balances = new Map();
  var i;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return null;
  }
  if (!data || typeof data.block !== "number" || data.block < DEPLOY_BLOCK || !Array.isArray(data.balances)) return null;
  try {
    for (i = 0; i < data.balances.length; i++) {
      balances.set(data.balances[i][0], BigInt("0x" + data.balances[i][1]));
    }
  } catch (error) {
    return null;
  }
  return { block: data.block, balances: balances };
}

function checkpointKv(env) {
  if (!env) return null;
  return env.BYKO_KV || env.CARDS || null;
}

async function readCheckpoint(env) {
  var cached;
  var kv = checkpointKv(env);
  var text = null;
  if (kv) {
    text = await kv.get(CHECKPOINT_KEY);
  } else {
    cached = await caches.default.match(CHECKPOINT_CACHE_URL);
    if (cached) text = await cached.text();
  }
  return text ? parseCheckpoint(text) : null;
}

async function writeCheckpoint(env, block, balances) {
  var text = serializeCheckpoint(block, balances);
  var kv = checkpointKv(env);
  var response;
  if (kv) {
    await kv.put(CHECKPOINT_KEY, text);
    return;
  }
  response = new Response(text, { headers: { "Cache-Control": "public, max-age=2592000" } });
  await caches.default.put(CHECKPOINT_CACHE_URL, response);
}

/* BaseScan's tier scale: whale >=10% of supply, then decades down. */
function tierFor(balance) {
  if (balance >= TOTAL_SUPPLY_WEI / 10n) return "whale";
  if (balance >= TOTAL_SUPPLY_WEI / 100n) return "shark";
  if (balance >= TOTAL_SUPPLY_WEI / 1000n) return "dolphin";
  if (balance >= TOTAL_SUPPLY_WEI / 10000n) return "fish";
  if (balance >= TOTAL_SUPPLY_WEI / 100000n) return "crab";
  return "shrimp";
}

function summarize(balances) {
  var tiers = {};
  var entry;
  var i;
  var holders = 0;
  var name;
  for (i = 0; i < TIER_NAMES.length; i++) tiers[TIER_NAMES[i]] = { count: 0, balance: 0n };
  for (entry of balances.entries()) {
    if (entry[0] === ZERO_ADDRESS || entry[1] <= 0n) continue;
    holders += 1;
    name = tierFor(entry[1]);
    tiers[name].count += 1;
    tiers[name].balance += entry[1];
  }
  for (i = 0; i < TIER_NAMES.length; i++) {
    name = TIER_NAMES[i];
    tiers[name] = {
      count: tiers[name].count,
      supply: Number((tiers[name].balance * 1000n) / TOTAL_SUPPLY_WEI) / 10
    };
  }
  return { holders: holders, tiers: tiers };
}

/* Etherscan API V2 (one etherscan.io key serves Base via chainid) — made for
   keyed server-side calls, so it works from Cloudflare where public JSON-RPC
   endpoints block the shared egress IPs. Used whenever ETHERSCAN_API_KEY is
   set; the raw RPC path below stays as the keyless fallback. */
var ETHERSCAN_API = "https://api.etherscan.io/v2/api?chainid=8453";

async function etherscanProxy(action, extra, key) {
  var response = await fetch(ETHERSCAN_API + "&module=proxy&action=" + action + (extra || "") + "&apikey=" + key);
  var payload;
  if (!response.ok) throw new Error("rpc");
  payload = await response.json();
  if (!payload || payload.error || payload.status === "0" || payload.result === undefined || payload.result === null) {
    throw new Error("etherscan proxy " + action + ": " + (payload && (payload.result || payload.message) || "bad response"));
  }
  return payload.result;
}

/* All Transfer logs in [fromBlock, toBlock], paginated 1000 per call. */
async function etherscanLogs(fromBlock, toBlock, key) {
  var all = [];
  var page = 1;
  var response;
  var payload;
  for (;;) {
    response = await fetch(ETHERSCAN_API + "&module=logs&action=getLogs" +
      "&address=" + BYKO + "&topic0=" + TRANSFER_TOPIC +
      "&fromBlock=" + fromBlock + "&toBlock=" + toBlock +
      "&page=" + page + "&offset=1000&apikey=" + key);
    if (!response.ok) throw new Error("rpc");
    payload = await response.json();
    if (!payload || !Array.isArray(payload.result)) {
      throw new Error("etherscan getLogs: " + (payload && (typeof payload.result === "string" ? payload.result : payload.message) || "bad response"));
    }
    all = all.concat(payload.result);
    if (payload.result.length < 1000) return all;
    page += 1;
    if (page > 30) throw new Error("rpc"); /* runaway guard */
  }
}

async function collectHolders(env) {
  var key = env && env.ETHERSCAN_API_KEY;
  var latest;
  var checkpoint = await readCheckpoint(env);
  var balances = checkpoint ? checkpoint.balances : new Map();
  var from = checkpoint ? checkpoint.block + 1 : DEPLOY_BLOCK;
  var to;
  var logs;
  var scanned;
  latest = parseInt(key ? await etherscanProxy("eth_blockNumber", "", key) : await rpc("eth_blockNumber", []), 16);
  scanned = from <= latest;
  if (key) {
    if (scanned) foldLogs(balances, await etherscanLogs(from, latest, key));
  } else {
    while (from <= latest) {
      to = Math.min(from + CHUNK_SIZE - 1, latest);
      logs = await rpc("eth_getLogs", [{
        address: BYKO,
        fromBlock: hex(from),
        toBlock: hex(to),
        topics: [TRANSFER_TOPIC]
      }]);
      foldLogs(balances, logs);
      from = to + 1;
    }
  }
  if (scanned) await writeCheckpoint(env, latest, balances);
  return { block: latest, balances: balances };
}

export async function onRequestGet(context) {
  var cache = caches.default;
  activeRpcUrls = (context.env && context.env.RPC_URL ? [context.env.RPC_URL] : []).concat(RPC_URLS);
  var cached = await cache.match(context.request);
  var data;
  var summary;
  var response;
  if (cached) return cached;
  try {
    data = await collectHolders(context.env);
    summary = summarize(data.balances);
    response = json({
      block: data.block,
      updated: new Date().toISOString(),
      holders: summary.holders,
      tiers: summary.tiers
    }, 200, { "Cache-Control": "public, s-maxage=600" });
    context.waitUntil(cache.put(context.request, response.clone()));
    return response;
  } catch (error) {
    if (new URL(context.request.url).searchParams.get("debug") === "1") {
      return json({
        error: "rpc",
        detail: String(error && error.message || error),
        keyed: !!(context.env && context.env.ETHERSCAN_API_KEY)
      }, 503);
    }
    return json({ error: "rpc" }, 503);
  }
}
