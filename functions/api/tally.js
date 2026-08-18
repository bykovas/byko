/* GET /api/tally — the referendum tally, computed server-side from BYKO
   Transfer logs and cached for an hour. Never computed client-side.

   Counting rule (also implemented in scripts/compute-tally.mjs, which
   writes the committed raw-data snapshot, and published on the site —
   keep the three in sync):

   A vote ("for") = an address that
     - currently holds >= MIN_VOTE BYKO
     - acquired BYKO through a pool swap: some transaction in which the
       pool paid BYKO out (pool's net BYKO change in that tx is negative)
       and the address ended the same tx with a positive net change —
       i.e. it paid for its position, directly or through a router
     - is an EOA, not a contract (eth_getCode == "0x"; EIP-7702 delegated
       EOAs, code 0xef0100..., count as EOAs)
     - is not excluded: pool, burn/zero address, founder wallets,
       contracts, known routers

   Withdrawn = matched the rule at some point in history but now holds
   < MIN_VOTE. Dust, contracts and founder-gift-only addresses are
   reported separately, not hidden. */

var BYKO = "0x078bB16e24c8931fc007928c370422e5e38F4372";
var RPC_URLS = [
  "https://mainnet.base.org",
  "https://base.drpc.org"
];
var activeRpcUrls = RPC_URLS;
var TOTAL_SUPPLY = 790227;
var DEPLOY_BLOCK = 49430937;
var TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
var ZERO = "0x0000000000000000000000000000000000000000";
var DEAD = "0x000000000000000000000000000000000000dead";
var POOL = "0x02dd4285ad38ea93d021ca854016a839b0b2a6ca";
var WEI = 1000000000000000000n;
var CHUNK_SIZE = 10000;
/* Pages Functions allow ~50 subrequests per request. A fresh checkpoint
   (e.g. after a version bump) sits hundreds of chunks behind the chain,
   so one request can never rescan it all: scan at most this many chunks,
   checkpoint the progress and let the next request continue. */
var MAX_SCAN_CHUNKS = 30;
var MIN_VOTE = 100; /* BYKO — config, published on the page */
var MIN_VOTE_WEI = BigInt(MIN_VOTE) * WEI;
var RULE_TEXT = MIN_VOTE + "+ BYKO, acquired via pool swap, EOA only; excluded: pool, burn address, founder wallets, contracts, routers";

/* Founder wallets live in website/data/founder-wallets.json — one source for
   this endpoint, scripts/compute-tally.mjs and the home page. The list below
   is only the shape of a failure: if the config cannot be read, the tally
   would silently count the author's own wallets as votes, so the request
   fails instead. */
var walletConfigPromise = null;
var FOUNDER_WALLET_META = [];
var FOUNDER_WALLETS = [];
var DISCLOSURE_WALLETS = [];

async function loadFounderWallets(origin) {
  if (!walletConfigPromise) {
    walletConfigPromise = fetch(origin + "/data/founder-wallets.json").then(async function (response) {
      if (!response.ok) throw new Error("founder wallet config → " + response.status);
      var data = await response.json();
      if (!data || !Array.isArray(data.wallets) || data.wallets.length === 0) {
        throw new Error("founder wallet config is empty");
      }
      return data.wallets.map(function (wallet) {
        return {
          address: String(wallet.address).toLowerCase(),
          role: wallet.role || "",
          klass: wallet["class"] || ""
        };
      });
    }).catch(function (error) {
      walletConfigPromise = null;
      throw error;
    });
  }
  FOUNDER_WALLET_META = await walletConfigPromise;
  FOUNDER_WALLETS = FOUNDER_WALLET_META.map(function (wallet) { return wallet.address; });
  DISCLOSURE_WALLETS = FOUNDER_WALLETS;
  return FOUNDER_WALLET_META;
}
var KNOWN_ROUTERS = [
  "0x111111125421ca6dc452d289314280a0f8842a65", /* 1inch v6 */
  "0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae", /* LI.FI diamond */
  "0x6cb442acf35158d5eda88fe602221b67b400be3e", /* Aerodrome router */
  "0x6ff5693b99212da76ad316178a184ab56d299b43"  /* Uniswap universal router */
];

/* Derived-state checkpoint so a request only scans blocks since the last
   run (same approach as holders.js). KV if bound, per-colo cache as a
   best-effort fallback. */
/* v2: founder wallet list extended (buyers + neighbouring-project wallets).
   The gift set is stamped during the scan, so widening the list needs a
   full rescan — hence the version bump, which abandons the v1 checkpoint. */
var CHECKPOINT_KEY = "tally-checkpoint-v3";
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

function keyedRpcUrls(env) {
  var urls = [];
  if (env && env.RPC_URL) urls.push(env.RPC_URL);
  if (env && env.DRPC_API_KEY) {
    urls.push(env.DRPC_API_KEY.indexOf("http") === 0
      ? env.DRPC_API_KEY
      : "https://lb.drpc.live/base/" + env.DRPC_API_KEY);
  }
  return urls;
}

var ETHERSCAN_API = "https://api.etherscan.io/v2/api?chainid=8453";

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
    if (!payload || !Array.isArray(payload.result)) throw new Error("etherscan getLogs");
    all = all.concat(payload.result);
    if (payload.result.length < 1000) return all;
    page += 1;
    if (page > 30) throw new Error("rpc"); /* runaway guard */
  }
}

function newState() {
  return {
    block: DEPLOY_BLOCK - 1,
    balances: new Map(),      /* address -> wei */
    viaPool: new Set(),       /* paid for a position in some swap tx */
    everQualified: new Set(), /* met the full holding rule at some point */
    gift: new Set(),          /* got a direct transfer from a founder wallet */
    eoa: new Map()            /* address -> boolean (getCode cache) */
  };
}

function serializeState(state) {
  var balances = [];
  for (var entry of state.balances.entries()) {
    if (entry[1] !== 0n) balances.push([entry[0], entry[1].toString(16)]);
  }
  return JSON.stringify({
    block: state.block,
    balances: balances,
    viaPool: [...state.viaPool],
    everQualified: [...state.everQualified],
    gift: [...state.gift],
    eoa: [...state.eoa.entries()]
  });
}

function parseState(text) {
  var data;
  var state = newState();
  var i;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return null;
  }
  if (!data || typeof data.block !== "number" || data.block < DEPLOY_BLOCK - 1) return null;
  if (!Array.isArray(data.balances) || !Array.isArray(data.viaPool) ||
      !Array.isArray(data.everQualified) || !Array.isArray(data.gift) || !Array.isArray(data.eoa)) return null;
  try {
    state.block = data.block;
    for (i = 0; i < data.balances.length; i++) state.balances.set(data.balances[i][0], BigInt("0x" + data.balances[i][1]));
    for (i = 0; i < data.viaPool.length; i++) state.viaPool.add(data.viaPool[i]);
    for (i = 0; i < data.everQualified.length; i++) state.everQualified.add(data.everQualified[i]);
    for (i = 0; i < data.gift.length; i++) state.gift.add(data.gift[i]);
    for (i = 0; i < data.eoa.length; i++) state.eoa.set(data.eoa[i][0], data.eoa[i][1]);
  } catch (error) {
    return null;
  }
  return state;
}

function checkpointKv(env) {
  if (!env) return null;
  return env.BYKO_KV || env.CARDS || null;
}

async function readCheckpoint(env) {
  var kv = checkpointKv(env);
  var text = null;
  var cached;
  if (kv) {
    text = await kv.get(CHECKPOINT_KEY);
  } else {
    cached = await caches.default.match(CHECKPOINT_CACHE_URL);
    if (cached) text = await cached.text();
  }
  return text ? parseState(text) : null;
}

async function writeCheckpoint(env, state) {
  var text = serializeState(state);
  var kv = checkpointKv(env);
  var response;
  if (kv) {
    await kv.put(CHECKPOINT_KEY, text);
    return;
  }
  response = new Response(text, { headers: { "Cache-Control": "public, max-age=2592000" } });
  await caches.default.put(CHECKPOINT_CACHE_URL, response);
}

/* Fold new logs into the state, transaction by transaction: the rule
   works on per-tx net changes so router hops (which net to zero) never
   count as acquisitions and routed buyers do. */
function foldLogs(state, logs) {
  var txOrder = [];
  var byTx = new Map();
  var i;
  var log;
  var tx;
  var transfers;
  var net;
  var t;
  var from;
  var to;
  var amount;
  var poolSold;
  var entry;
  var address;
  for (i = 0; i < logs.length; i++) {
    log = logs[i];
    if (!log.topics || log.topics.length < 3 || !log.data) throw new Error("rpc");
    tx = log.transactionHash;
    if (!byTx.has(tx)) { byTx.set(tx, []); txOrder.push(tx); }
    byTx.get(tx).push(log);
  }
  for (i = 0; i < txOrder.length; i++) {
    transfers = byTx.get(txOrder[i]);
    net = new Map();
    for (t = 0; t < transfers.length; t++) {
      from = "0x" + transfers[t].topics[1].slice(-40).toLowerCase();
      to = "0x" + transfers[t].topics[2].slice(-40).toLowerCase();
      amount = BigInt(transfers[t].data);
      if (from !== ZERO) net.set(from, (net.get(from) || 0n) - amount);
      if (to !== ZERO) net.set(to, (net.get(to) || 0n) + amount);
      if (FOUNDER_WALLETS.indexOf(from) > -1 && to !== POOL) state.gift.add(to);
    }
    poolSold = (net.get(POOL) || 0n) < 0n;
    for (entry of net.entries()) {
      state.balances.set(entry[0], (state.balances.get(entry[0]) || 0n) + entry[1]);
      if (poolSold && entry[1] > 0n && entry[0] !== POOL) state.viaPool.add(entry[0]);
    }
    for (entry of net.entries()) {
      address = entry[0];
      if (state.viaPool.has(address) && (state.balances.get(address) || 0n) >= MIN_VOTE_WEI) {
        state.everQualified.add(address);
      }
    }
  }
}

async function isEoa(state, address) {
  var code;
  if (!state.eoa.has(address)) {
    code = await rpc("eth_getCode", [address, "latest"]);
    state.eoa.set(address, code === "0x" || code.indexOf("0xef0100") === 0);
  }
  return state.eoa.get(address);
}

function toByko(wei) {
  return Number(wei / 1000000000000n) / 1e6;
}

async function computeTally(env, origin) {
  await loadFounderWallets(origin);
  var key = env && env.ETHERSCAN_API_KEY;
  var state = (await readCheckpoint(env)) || newState();
  var from = state.block + 1;
  var latest;
  var to;
  var scanned;
  if (key) {
    try {
      latest = parseInt(await rpc("eth_blockNumber", []), 16);
    } catch (error) {
      latest = null;
    }
  }
  if (latest === null || latest === undefined) latest = parseInt(await rpc("eth_blockNumber", []), 16);
  scanned = from <= latest;
  if (key && scanned) {
    try {
      foldLogs(state, await etherscanLogs(from, latest, key));
      from = latest + 1;
    } catch (error) { /* fall through to the chunked RPC scan */ }
  }
  var target = Math.min(latest, from + CHUNK_SIZE * MAX_SCAN_CHUNKS - 1);
  while (from <= target) {
    to = Math.min(from + CHUNK_SIZE - 1, target);
    foldLogs(state, await rpc("eth_getLogs", [{
      address: BYKO,
      fromBlock: hex(from),
      toBlock: hex(to),
      topics: [TRANSFER_TOPIC]
    }]));
    from = to + 1;
  }
  state.block = from - 1;
  if (state.block < latest) {
    /* Not caught up yet — persist the progress and say so. No
       classification on a mid-history state: the numbers would be wrong
       and the EOA checks would blow the subrequest budget. */
    await writeCheckpoint(env, state);
    return {
      syncing: true,
      block: state.block,
      behind: latest - state.block,
      updated: new Date().toISOString()
    };
  }

  /* Classify. Only addresses that ever qualified or currently hold
     something need an EOA check. */
  var tally = { for: 0, withdrawn: 0 };
  var notCounted = { dust: 0, contracts: 0, giftOnly: 0 };
  var voters = [];
  var candidates = new Set();
  var entry;
  var address;
  var balance;
  for (address of state.everQualified) candidates.add(address);
  for (entry of state.balances.entries()) {
    if (entry[1] > 0n) candidates.add(entry[0]);
  }
  for (address of [...candidates].sort()) {
    balance = state.balances.get(address) || 0n;
    if (address === POOL || address === DEAD || address === ZERO) continue;
    if (FOUNDER_WALLETS.indexOf(address) > -1) continue;
    if (KNOWN_ROUTERS.indexOf(address) > -1) continue;
    if (!(await isEoa(state, address))) {
      if (balance > 0n) notCounted.contracts += 1;
      continue;
    }
    if (state.everQualified.has(address)) {
      if (balance >= MIN_VOTE_WEI) {
        tally.for += 1;
        voters.push({ address: address, status: "for", balance: toByko(balance) });
      } else {
        tally.withdrawn += 1;
        voters.push({ address: address, status: "withdrawn", balance: toByko(balance) });
      }
    } else if (balance > 0n) {
      if (!state.viaPool.has(address) && state.gift.has(address)) notCounted.giftOnly += 1;
      else notCounted.dust += 1;
    }
  }

  var founderBalance = 0;
  var founderHoldings = [];
  var walletBalance;
  var i;
  for (i = 0; i < DISCLOSURE_WALLETS.length; i++) {
    walletBalance = toByko(state.balances.get(DISCLOSURE_WALLETS[i]) || 0n);
    founderBalance += walletBalance;
    /* the split, so the page can show where the disclosed total sits without
       reading the chain a second time and drifting from this number */
    founderHoldings.push({
      address: DISCLOSURE_WALLETS[i],
      balance: walletBalance,
      role: FOUNDER_WALLET_META[i] ? FOUNDER_WALLET_META[i].role : "",
      "class": FOUNDER_WALLET_META[i] ? FOUNDER_WALLET_META[i].klass : ""
    });
  }

  if (scanned) await writeCheckpoint(env, state);

  return {
    updated: new Date().toISOString(),
    block: latest,
    rule: { minVote: MIN_VOTE, text: RULE_TEXT },
    tally: tally,
    notCounted: notCounted,
    founder: {
      wallets: DISCLOSURE_WALLETS,
      holdings: founderHoldings,
      balance: Math.round(founderBalance * 100) / 100,
      pct: Math.round(founderBalance / TOTAL_SUPPLY * 1000) / 10
    },
    voters: voters
  };
}

export async function onRequestGet(context) {
  var cache = caches.default;
  activeRpcUrls = keyedRpcUrls(context.env).concat(RPC_URLS);
  var cached = await cache.match(context.request);
  var response;
  if (cached) return cached;
  try {
    var payload = await computeTally(context.env, new URL(context.request.url).origin);
    if (payload.syncing) {
      /* mid-rescan progress report — never cache it */
      return json(payload, 200, { "Cache-Control": "no-store" });
    }
    response = json(payload, 200, { "Cache-Control": "public, s-maxage=3600" });
    context.waitUntil(cache.put(context.request, response.clone()));
    return response;
  } catch (error) {
    if (new URL(context.request.url).searchParams.get("debug") === "1") {
      return json({ error: "rpc", detail: String(error && error.message || error) }, 503);
    }
    return json({ error: "rpc" }, 503);
  }
}
