#!/usr/bin/env node
/* Computes the referendum tally snapshot from BYKO Transfer logs on Base
   and writes website/data/tally.json + website/data/tally.csv, so anyone
   can recount by re-running this script.

   Counting rule (also implemented in functions/api/tally.js and published
   on the site — keep the three in sync):

   A vote ("for") = an address that
     - currently holds >= MIN_VOTE BYKO
     - acquired BYKO through a pool swap: some transaction in which the
       pool paid BYKO out (pool's net BYKO change in that tx is negative)
       and the address ended the same tx with a positive net BYKO change —
       i.e. it paid for its position, whether it bought directly or through
       a router/aggregator
     - is an EOA, not a contract (eth_getCode == "0x"; EIP-7702 delegated
       EOAs, code 0xef0100..., count as EOAs)
     - is not excluded: pool, burn/zero address, founder wallets, contracts

   Withdrawn = an address that matched the rule at some point in history
   (after a pool acquisition its running balance reached MIN_VOTE) but now
   holds < MIN_VOTE.

   Not counted, reported separately: dust (EOA below MIN_VOTE that never
   qualified), contracts, and addresses that only ever received BYKO as a
   direct transfer from founder wallets (gifts — they did not buy).

   Usage: node scripts/compute-tally.mjs [--rpc https://...] */

import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const BYKO = "0x078bB16e24c8931fc007928c370422e5e38F4372";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const DEPLOY_BLOCK = 49430937;
const CHUNK_SIZE = 10000;
const MIN_VOTE = 100; // BYKO — config, published on the page

const POOL = "0x02dd4285ad38ea93d021ca854016a839b0b2a6ca";
const ZERO = "0x0000000000000000000000000000000000000000";
const DEAD = "0x000000000000000000000000000000000000dead";

/* Founder wallets come from website/data/founder-wallets.json — the single
   source this script, functions/api/tally.js and the home page all read, so
   a new wallet is added in exactly one place. */
const WALLET_CONFIG = JSON.parse(readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "website", "data", "founder-wallets.json"), "utf8"));
const FOUNDER_WALLET_META = WALLET_CONFIG.wallets.map(w => ({
  address: String(w.address).toLowerCase(), role: w.role, class: w["class"],
}));
const FOUNDER_WALLETS = FOUNDER_WALLET_META.map(w => w.address);
// The disclosure line sums the same set: every founder-owned wallet is
// both excluded from the tally and counted in the holdings disclosure.
const DISCLOSURE_WALLETS = FOUNDER_WALLETS;

/* Known routers/aggregators, excluded explicitly on top of the EOA check. */
const KNOWN_ROUTERS = [
  "0x111111125421ca6dc452d289314280a0f8842a65", // 1inch v6
  "0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae", // LI.FI diamond
  "0x6cb442acf35158d5eda88fe602221b67b400be3e", // Aerodrome router
  "0x6ff5693b99212da76ad316178a184ab56d299b43"  // Uniswap universal router (Base)
];

const UA = "byko-tally/1.0 (+https://byko.bykovas.lt)";
const rpcArg = process.argv.indexOf("--rpc");
const RPC_URLS = rpcArg > -1
  ? [process.argv[rpcArg + 1]]
  : ["https://mainnet.base.org", "https://base.drpc.org"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* One pass over the node list and then give up was enough while this script
   made a few dozen calls. It now makes about a thousand — one eth_getCode per
   address the airdrop created — and both public endpoints answer 429 partway
   through. A rate limit is a "come back later", not an answer, so wait and ask
   again rather than failing the whole run. */
async function rpc(method, params, attempt = 0) {
  let lastError;
  for (const url of RPC_URLS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": UA },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
      });
      if (!response.ok) throw new Error("http " + response.status);
      const payload = await response.json();
      if (payload.error || payload.result === undefined) throw new Error(JSON.stringify(payload.error));
      return payload.result;
    } catch (error) { lastError = error; }
  }
  if (attempt < 5) {
    await sleep(400 * Math.pow(3, attempt));
    return rpc(method, params, attempt + 1);
  }
  throw lastError;
}

/* Batched, chunked at three: DRPC's free plan refuses larger batches and says
   so inside an HTTP 200, one error object per element. Every element is
   checked, so a refusal can never be read as an empty answer. */
async function rpcBatch(calls) {
  const out = [];
  for (let i = 0; i < calls.length; i += 3) {
    const chunk = calls.slice(i, i + 3);
    let got = null;
    for (let attempt = 0; attempt < 6 && !got; attempt += 1) {
      for (const url of RPC_URLS) {
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "User-Agent": UA },
            body: JSON.stringify(chunk.map((c, j) => ({
              jsonrpc: "2.0", id: j, method: c.method, params: c.params })))
          });
          if (!response.ok) throw new Error("http " + response.status);
          const body = await response.json();
          if (!Array.isArray(body) || body.length !== chunk.length) throw new Error("batch");
          if (body.some((x) => x.error || x.result === undefined)) throw new Error("batch element refused");
          body.sort((a, b) => a.id - b.id);
          got = body.map((x) => x.result);
          break;
        } catch { /* next node */ }
      }
      if (!got) await sleep(400 * Math.pow(3, attempt));
    }
    if (!got) throw new Error("rpc batch failed");
    out.push(...got);
  }
  return out;
}

const WEI = 10n ** 18n;
const TOTAL_SUPPLY = 790227;

const latest = parseInt(await rpc("eth_blockNumber", []), 16);
process.stderr.write("latest block " + latest + "\n");

/* 1. All Transfer logs since deployment. */
const logs = [];
for (let from = DEPLOY_BLOCK; from <= latest; from += CHUNK_SIZE) {
  const to = Math.min(from + CHUNK_SIZE - 1, latest);
  logs.push(...await rpc("eth_getLogs", [{
    address: BYKO,
    fromBlock: "0x" + from.toString(16),
    toBlock: "0x" + to.toString(16),
    topics: [TRANSFER_TOPIC]
  }]));
  process.stderr.write("\rscanned to " + to + ", " + logs.length + " logs ");
}
process.stderr.write("\n");

/* 2. Group by transaction, then fold tx by tx in chain order. */
const txOrder = [];
const byTx = new Map();
for (const log of logs) {
  const tx = log.transactionHash;
  if (!byTx.has(tx)) { byTx.set(tx, []); txOrder.push(tx); }
  byTx.get(tx).push({
    block: parseInt(log.blockNumber, 16),
    from: "0x" + log.topics[1].slice(-40).toLowerCase(),
    to: "0x" + log.topics[2].slice(-40).toLowerCase(),
    amount: BigInt(log.data)
  });
}

const founderSet = new Set(FOUNDER_WALLETS.map(a => a.toLowerCase()));
const balances = new Map();       // address -> running balance (wei)
const acquiredViaPool = new Set(); // paid for a position in some swap tx
const everQualified = new Set();   // met the full holding rule at some point
const receivedGift = new Set();    // got a direct transfer from a founder wallet
const seen = new Set();
const MIN_VOTE_WEI = BigInt(MIN_VOTE) * WEI;

for (const tx of txOrder) {
  const transfers = byTx.get(tx);
  const net = new Map();
  for (const t of transfers) {
    if (t.from !== ZERO) net.set(t.from, (net.get(t.from) || 0n) - t.amount);
    if (t.to !== ZERO) net.set(t.to, (net.get(t.to) || 0n) + t.amount);
    if (t.from !== ZERO) seen.add(t.from);
    if (t.to !== ZERO) seen.add(t.to);
    if (founderSet.has(t.from) && t.to !== POOL) receivedGift.add(t.to);
  }
  const poolSoldByko = (net.get(POOL) || 0n) < 0n;
  for (const [address, change] of net) {
    balances.set(address, (balances.get(address) || 0n) + change);
    if (poolSoldByko && change > 0n && address !== POOL) acquiredViaPool.add(address);
  }
  for (const [address] of net) {
    if (acquiredViaPool.has(address) && (balances.get(address) || 0n) >= MIN_VOTE_WEI) {
      everQualified.add(address);
    }
  }
}

/* 3. EOA check for every address that matters for a bucket. */
const codeCache = new Map();

/* Ask for every code up front, three per request, instead of one blocking
   call per address inside the classify loop. A thousand sequential requests is
   what earned the 429 in the first place. */
async function prefetchCodes(addresses) {
  const wanted = addresses.filter((a) => !codeCache.has(a));
  if (wanted.length === 0) return;
  process.stderr.write("eth_getCode for " + wanted.length + " addresses\n");
  const results = await rpcBatch(wanted.map((a) => ({ method: "eth_getCode", params: [a, "latest"] })));
  wanted.forEach((a, i) => {
    const code = results[i];
    codeCache.set(a, code === "0x" || code.startsWith("0xef0100"));
  });
}

async function isEoa(address) {
  if (!codeCache.has(address)) {
    const code = await rpc("eth_getCode", [address, "latest"]);
    codeCache.set(address, code === "0x" || code.startsWith("0xef0100"));
  }
  return codeCache.get(address);
}

/* 4. Classify. */
const toByko = wei => Number(wei / 10n ** 12n) / 1e6;
const rows = [];
const tally = { for: 0, withdrawn: 0 };
const notCounted = { dust: 0, contracts: 0, giftOnly: 0 };

await prefetchCodes([...seen].filter((a) =>
  a !== POOL && a !== DEAD && !founderSet.has(a) && !KNOWN_ROUTERS.includes(a)));

for (const address of [...seen].sort()) {
  const balance = balances.get(address) || 0n;
  let status;
  let note = "";
  if (address === POOL) { status = "excluded"; note = "pool"; }
  else if (address === DEAD) { status = "excluded"; note = "burn address"; }
  else if (founderSet.has(address)) { status = "excluded"; note = "founder wallet"; }
  else if (KNOWN_ROUTERS.includes(address)) { status = "excluded"; note = "router"; }
  else if (!(await isEoa(address))) {
    status = balance > 0n ? "not-counted" : "excluded";
    note = "contract";
    if (balance > 0n) notCounted.contracts += 1;
  } else if (everQualified.has(address)) {
    status = balance >= MIN_VOTE_WEI ? "for" : "withdrawn";
    tally[status] += 1;
  } else if (balance > 0n) {
    status = "not-counted";
    if (!acquiredViaPool.has(address) && receivedGift.has(address)) {
      note = "gift from founder, never bought";
      notCounted.giftOnly += 1;
    } else {
      note = "below " + MIN_VOTE + " BYKO";
      notCounted.dust += 1;
    }
  } else {
    status = "none";
    note = "no current balance, never qualified";
  }
  rows.push({
    address,
    status,
    balance: toByko(balance),
    acquiredViaPool: acquiredViaPool.has(address),
    everQualified: everQualified.has(address),
    eoa: codeCache.has(address) ? codeCache.get(address) : null,
    note
  });
}

/* 5. Founder balances for the disclosure line. */
const founder = { wallets: DISCLOSURE_WALLETS, holdings: [], balance: 0, pct: 0 };
for (const wallet of DISCLOSURE_WALLETS) {
  const walletBalance = toByko(balances.get(wallet.toLowerCase()) || 0n);
  founder.balance += walletBalance;
  /* the split, so the disclosure table on the page and the total above it
     can never come from two different reads of the chain */
  const meta = FOUNDER_WALLET_META.find(w => w.address === wallet.toLowerCase());
  founder.holdings.push({
    address: wallet, balance: walletBalance,
    role: meta ? meta.role : "", class: meta ? meta["class"] : "",
  });
}
founder.balance = Math.round(founder.balance * 100) / 100;
founder.pct = Math.round(founder.balance / TOTAL_SUPPLY * 1000) / 10;

const updated = new Date().toISOString();
const snapshot = {
  updated,
  block: latest,
  rule: {
    minVote: MIN_VOTE,
    text: MIN_VOTE + "+ BYKO, acquired via pool swap, EOA only; excluded: pool, burn address, founder wallets, contracts, routers"
  },
  tally,
  notCounted,
  founder,
  voters: rows.filter(r => r.status === "for" || r.status === "withdrawn")
    .map(r => ({ address: r.address, status: r.status, balance: r.balance }))
};

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "website/data"), { recursive: true });
writeFileSync(join(root, "website/data/tally.json"), JSON.stringify(snapshot, null, 2) + "\n");

const csv = ["address,status,balance_byko,acquired_via_pool,ever_qualified,is_eoa,note"];
for (const r of rows) {
  csv.push([r.address, r.status, r.balance, r.acquiredViaPool, r.everQualified, r.eoa, JSON.stringify(r.note)].join(","));
}
csv.push("# computed " + updated + " at block " + latest + " · rule: " + snapshot.rule.text);
writeFileSync(join(root, "website/data/tally.csv"), csv.join("\n") + "\n");

console.log(JSON.stringify(snapshot, null, 2));
