#!/usr/bin/env node
/* Snapshot of everything a machine can read about BYKO, at one moment.
 *
 *   node scripts/airdrop/snapshot.mjs --label before
 *
 * Run before the airdrop, +24h and +7d after it. Every field carries its
 * source and the time it was read; the shape is stable so the three files
 * diff cleanly. What a source refuses to answer is recorded as n/a — the
 * silence of a scanner is itself a measurement, and inventing a number here
 * would poison the only thing this experiment produces.
 *
 * Two cohorts share every snapshot:
 *   asked     — wallets that came to app227 and claimed 227 (the ledger)
 *   unasked   — wallets in cohort.csv that were given 227 without asking
 * The experiment is the comparison, not either column alone.
 */

import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import {
  BYKO, POOL, USDC, CHAIN_ID, SELECTORS, callData, field, hexToBig, nowIso,
  readJson, rpc, rpcBatch, rpcStats, toCsv, toUnits,
} from "./lib.mjs";

const OUT_DIR = "website/data/experiments/airdrop";
const LEDGER_URL = "https://byko-app227.bykovas.lt/api/ledger";
const HOLDERS_URL = "https://byko.bykovas.lt/api/holders";

const args = process.argv.slice(2);
const label = valueOf("--label") ?? "before";

function valueOf(flag) {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1];
}

/* An external read that is allowed to fail: the snapshot records the failure
   rather than the tool dying on someone else's outage. */
async function tryFetch(url, options = {}) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000), ...options });
    if (!response.ok) return { ok: false, error: `http ${response.status}` };
    return { ok: true, data: await response.json() };
  } catch (error) {
    return { ok: false, error: String(error.message ?? error) };
  }
}

async function chainState() {
  const blockHex = await rpc("eth_blockNumber");
  const block = Number(hexToBig(blockHex));
  const [supplyRaw, poolByko, poolUsdc] = await rpcBatch([
    { method: "eth_call", params: [{ to: BYKO, data: SELECTORS.totalSupply }, "latest"] },
    { method: "eth_call", params: [{ to: BYKO, data: callData(SELECTORS.balanceOf, POOL) }, "latest"] },
    { method: "eth_call", params: [{ to: USDC, data: callData(SELECTORS.balanceOf, POOL) }, "latest"] },
  ]);
  const byko = toUnits(poolByko, 18);
  const usdc = toUnits(poolUsdc, 6);
  return {
    block: field(block, "eth_blockNumber"),
    supply: field(toUnits(supplyRaw, 18), "totalSupply"),
    pool_byko: field(byko, "balanceOf(pool)"),
    pool_usdc: field(usdc, "balanceOf(pool)"),
    /* the pool is the only price this project recognises */
    price_usd: field(byko > 0 ? usdc / byko : null, "pool reserves"),
  };
}

async function holders() {
  const result = await tryFetch(`${HOLDERS_URL}?t=${Date.now()}`);
  if (!result.ok) return { count: field(null, "byko.bykovas.lt/api/holders", result.error) };
  return {
    count: field(result.data.holders ?? null, "byko.bykovas.lt/api/holders"),
    block: field(result.data.block ?? null, "byko.bykovas.lt/api/holders"),
    tiers: field(result.data.tiers ?? null, "byko.bykovas.lt/api/holders"),
  };
}

/* Every scanner that answers a machine. What each one says about a token
   nobody has heard of is the point of the whole exercise. */
async function scanners() {
  const out = {};

  const goplus = await tryFetch(
    `https://api.gopluslabs.io/api/v1/token_security/${CHAIN_ID}?contract_addresses=${BYKO}`,
  );
  if (goplus.ok) {
    const raw = goplus.data?.result?.[BYKO.toLowerCase()] ?? null;
    out.goplus = raw
      ? {
          source: "api.gopluslabs.io",
          holder_count: raw.holder_count ?? null,
          is_honeypot: raw.is_honeypot ?? null,
          is_open_source: raw.is_open_source ?? null,
          is_mintable: raw.is_mintable ?? null,
          is_proxy: raw.is_proxy ?? null,
          creator_percent: raw.creator_percent ?? null,
          owner_percent: raw.owner_percent ?? null,
          lp_holder_count: raw.lp_holder_count ?? null,
          trust_list: raw.trust_list ?? null,
          raw,
        }
      : { source: "api.gopluslabs.io", error: "token not in response" };
  } else out.goplus = { source: "api.gopluslabs.io", error: goplus.error };

  const gecko = await tryFetch(
    `https://api.geckoterminal.com/api/v2/networks/base/tokens/${BYKO}`,
  );
  out.geckoterminal = gecko.ok
    ? {
        source: "api.geckoterminal.com",
        price_usd: gecko.data?.data?.attributes?.price_usd ?? null,
        fdv_usd: gecko.data?.data?.attributes?.fdv_usd ?? null,
        total_reserve_usd: gecko.data?.data?.attributes?.total_reserve_in_usd ?? null,
        volume_24h: gecko.data?.data?.attributes?.volume_usd?.h24 ?? null,
        market_cap_usd: gecko.data?.data?.attributes?.market_cap_usd ?? null,
      }
    : { source: "api.geckoterminal.com", error: gecko.error };

  /* The pool endpoint answers what the token endpoint cannot: how many people
     actually traded, split into buyers and sellers. Volume alone cannot tell
     "nobody traded" from "one whale traded"; buyers/sellers can. It is also
     the only source that will show the airdrop's recipients selling, if they
     ever do — the behaviour their own wallets hide from them.

     locked_liquidity_percentage is recorded even though it reads null: the
     LP tokens of this pool are 100% at the burn address, so the true answer
     is 100. The null is the gap between what is true on chain and what the
     scanner knows, which is the whole subject of the experiment. */
  const pool = await tryFetch(
    `https://api.geckoterminal.com/api/v2/networks/base/pools/${POOL}`,
  );
  const pa = pool.data?.data?.attributes;
  out.geckoterminal_pool = pool.ok
    ? {
        source: "api.geckoterminal.com/pools",
        pool_created_at: pa?.pool_created_at ?? null,
        reserve_in_usd: pa?.reserve_in_usd ?? null,
        fdv_usd: pa?.fdv_usd ?? null,
        price_change_24h: pa?.price_change_percentage?.h24 ?? null,
        volume_24h: pa?.volume_usd?.h24 ?? null,
        trades_24h: pa?.transactions?.h24 ?? null,
        trades_1h: pa?.transactions?.h1 ?? null,
        locked_liquidity_percentage: pa?.locked_liquidity_percentage ?? null,
        note: "LP is 100% at 0x…dEaD on chain; this field reads null",
      }
    : { source: "api.geckoterminal.com/pools", error: pool.error };

  const dex = await tryFetch(`https://api.dexscreener.com/latest/dex/tokens/${BYKO}`);
  out.dexscreener = dex.ok
    ? {
        source: "api.dexscreener.com",
        /* null pairs means the aggregator does not list the token at all —
           a real state, not an error */
        pairs: Array.isArray(dex.data?.pairs) ? dex.data.pairs.length : 0,
        listed: Array.isArray(dex.data?.pairs) && dex.data.pairs.length > 0,
      }
    : { source: "api.dexscreener.com", error: dex.error };

  const blockscout = await tryFetch(
    `https://base.blockscout.com/api/v2/tokens/${BYKO}/counters`,
  );
  out.blockscout = blockscout.ok
    ? {
        source: "base.blockscout.com",
        token_holders_count: blockscout.data?.token_holders_count ?? null,
        transfers_count: blockscout.data?.transfers_count ?? null,
        note: "does not index this token's holders — reports 0",
      }
    : { source: "base.blockscout.com", error: blockscout.error };

  /* Wallets and app stores expose no machine-readable verdict. Recorded as
     manual so a later reader knows it was never scraped or guessed. */
  out.manual = {
    note: "no public API — checked by eye, screenshots go to the diary",
    targets: ["Base App", "Coinbase Wallet", "MetaMask", "Rabby", "Phantom"],
  };
  return out;
}

/* Cohort readings: balances now, so the next snapshot can say what moved. */
async function cohortState(addresses) {
  if (addresses.length === 0) return [];
  const rows = [];
  const size = 25;
  for (let i = 0; i < addresses.length; i += size) {
    const slice = addresses.slice(i, i + size);
    const [balances, natives] = await Promise.all([
      rpcBatch(slice.map((address) => ({
        method: "eth_call",
        params: [{ to: BYKO, data: callData(SELECTORS.balanceOf, address) }, "latest"],
      }))),
      rpcBatch(slice.map((address) => ({ method: "eth_getBalance", params: [address, "latest"] }))),
    ]);
    slice.forEach((address, index) => {
      rows.push({
        address,
        byko: toUnits(balances[index], 18),
        eth: toUnits(natives[index], 18),
      });
    });
  }
  return rows;
}

function classify(byko, granted) {
  if (granted === 0) return "not-granted";
  if (byko === 0) return "emptied";
  if (byko >= granted) return "held";
  return "partial";
}

async function main() {
  const started = nowIso();
  console.log(`snapshot "${label}" — reading…`);

  const chain = await chainState();
  const holderState = await holders();
  const scannerState = await scanners();

  /* asked: the app227 ledger — wallets that came and claimed */
  const ledger = await tryFetch(`${LEDGER_URL}?t=${Date.now()}`);
  const asked = ledger.ok
    ? (ledger.data.advances ?? [])
        .filter((row) => row.status !== "failed")
        .map((row) => ({ address: row.address.toLowerCase(), granted: row.amount, handle: row.handle }))
    : [];

  /* unasked: every wallet that actually received, across all four waves.
     This used to read the first wave's cohort.json and airdrop-sent.json
     alone, which measured 227 of 908 recipients — it would have published a
     24h and a 7d reading covering a quarter of the experiment as though it
     were the whole thing, and the shortfall would have been invisible in the
     output. The sent journals are the right source rather than the cohort
     lists: a wallet that was picked but never sent is not a recipient, and
     what each one was granted is recorded per row, so no baseline snapshot is
     needed to tell whether it still holds what it was given. */
  const sentBy = new Map();
  for (const file of readdirSync(OUT_DIR).filter((f) => /^airdrop-sent.*\.json$/.test(f)).sort()) {
    for (const row of readJson(`${OUT_DIR}/${file}`, null)?.rows ?? []) {
      if (row?.address) sentBy.set(row.address.toLowerCase(), row.amount);
    }
  }
  const unasked = [...sentBy].map(([address, granted]) => ({ address, granted }));

  const askedState = await cohortState(asked.map((a) => a.address));
  const unaskedState = await cohortState(unasked.map((a) => a.address));

  const withStatus = (list, meta) =>
    list.map((row) => {
      const info = meta.find((m) => m.address === row.address) ?? { granted: 0 };
      return { ...row, granted: info.granted, handle: info.handle ?? null, status: classify(row.byko, info.granted) };
    });

  const askedRows = withStatus(askedState, asked);
  const unaskedRows = withStatus(unaskedState, unasked);

  const summarise = (rows) => ({
    wallets: rows.length,
    granted_total: rows.reduce((sum, row) => sum + (row.granted ?? 0), 0),
    holding_total: rows.reduce((sum, row) => sum + row.byko, 0),
    held: rows.filter((row) => row.status === "held").length,
    partial: rows.filter((row) => row.status === "partial").length,
    emptied: rows.filter((row) => row.status === "emptied").length,
  });

  const snapshot = {
    label,
    taken_at: started,
    finished_at: nowIso(),
    chain,
    holders: holderState,
    scanners: scannerState,
    cohorts: {
      asked: { summary: summarise(askedRows), rows: askedRows },
      unasked: { summary: summarise(unaskedRows), rows: unaskedRows },
    },
    rpc: rpcStats(),
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(`${OUT_DIR}/snapshot-${label}.json`, JSON.stringify(snapshot, null, 2) + "\n");

  const flat = [...askedRows.map((r) => ({ cohort: "asked", ...r })),
                ...unaskedRows.map((r) => ({ cohort: "unasked", ...r }))];
  writeFileSync(
    `${OUT_DIR}/snapshot-${label}.csv`,
    toCsv(flat, ["cohort", "address", "handle", "granted", "byko", "eth", "status"]),
  );

  console.log(`\nblock ${chain.block.value} · price $${(chain.price_usd.value ?? 0).toFixed(9)}`);
  console.log(`holders (ours): ${holderState.count.value} · goplus: ${scannerState.goplus.holder_count ?? "n/a"}`);
  console.log(`dexscreener listed: ${scannerState.dexscreener.listed ?? "n/a"} · blockscout holders: ${scannerState.blockscout.token_holders_count ?? "n/a"}`);
  const t24 = scannerState.geckoterminal_pool?.trades_24h;
  console.log(`pool 24h: ${t24 ? `${t24.buys} buys / ${t24.sells} sells · ${t24.buyers} buyers / ${t24.sellers} sellers` : "n/a"} · reserve $${scannerState.geckoterminal_pool?.reserve_in_usd ?? "n/a"}`);
  console.log(`asked cohort: ${askedRows.length} wallets · unasked cohort: ${unaskedRows.length} wallets`);
  console.log(`rpc calls: ${snapshot.rpc.calls}`);
  console.log(`\nwritten: ${OUT_DIR}/snapshot-${label}.json (+ .csv)`);
}

main().catch((error) => {
  console.error("snapshot failed:", error.message);
  process.exit(1);
});
