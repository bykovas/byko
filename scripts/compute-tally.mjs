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

import { writeFileSync, mkdirSync } from "fs";
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

/* Founder wallets — keep in sync with functions/api/tally.js and the
   footnote list in website/index.html. */
const FOUNDER_WALLETS = [
  "0x624056460437cb4c63f7a3cf0c5a554df3375222", // deployer, omenas.base.eth
  "0x42873c60bc22424dbb4518df7be8b7f9ef4ac1d6", // ops / donation wallet (spec §6)
  "0xe8fc8769934f9461f7adf6f440ff3883e28021eb"  // founder trading wallet (funded from deployer)
];
// Disclosure set — the full founder wallet list from the project diary.
// Used ONLY for the holdings disclosure; the exclusion set above (what
// the tally filters) is deliberately narrower and unchanged.
const DISCLOSURE_WALLETS = FOUNDER_WALLETS.concat([
  "0xe1e16dd66b66bc471b8cafac4c71e2abe0060a16", // buyer
  "0x1533897a4b46cd1b7e34b90dfd614daacc69cb4c"  // buyer, retired
]);

/* Known routers/aggregators, excluded explicitly on top of the EOA check. */
const KNOWN_ROUTERS = [
  "0x111111125421ca6dc452d289314280a0f8842a65", // 1inch v6
  "0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae", // LI.FI diamond
  "0x6cb442acf35158d5eda88fe602221b67b400be3e", // Aerodrome router
  "0x6ff5693b99212da76ad316178a184ab56d299b43"  // Uniswap universal router (Base)
];

const rpcArg = process.argv.indexOf("--rpc");
const RPC_URLS = rpcArg > -1
  ? [process.argv[rpcArg + 1]]
  : ["https://mainnet.base.org", "https://base.drpc.org"];

async function rpc(method, params) {
  let lastError;
  for (const url of RPC_URLS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
      });
      if (!response.ok) throw new Error("http " + response.status);
      const payload = await response.json();
      if (payload.error || payload.result === undefined) throw new Error(JSON.stringify(payload.error));
      return payload.result;
    } catch (error) { lastError = error; }
  }
  throw lastError;
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
const founder = { wallets: DISCLOSURE_WALLETS, balance: 0, pct: 0 };
for (const wallet of DISCLOSURE_WALLETS) {
  founder.balance += toByko(balances.get(wallet.toLowerCase()) || 0n);
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
