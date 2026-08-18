#!/usr/bin/env node
/* Pick the wallets that will be given 227 BYKO without asking.
 *
 *   node scripts/airdrop/cohort.mjs --size 227 --hours 24
 *
 * Definition of the cohort: an EOA that sent USDC to a known DEX venue on
 * Base inside the window — someone who bought something today, and has never
 * heard of this token.
 *
 * Every filter is a plain chain read (logs, code, nonce, balance): no
 * indexer, no label service, nothing that could quietly change its mind
 * later. cohort-method.md records each filter with its before → after count,
 * so the selection can be re-derived by anyone from the same blocks.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import {
  DEX_SINKS, USDC, TRANSFER_TOPIC, hexToBig, nowIso, projectAddresses,
  rpc, rpcBatch, rpcStats, toCsv, topicToAddress, toUnits,
} from "./lib.mjs";

const OUT_DIR = "website/data/experiments/airdrop";

const args = process.argv.slice(2);
const size = Number(valueOf("--size") ?? 227);
const hours = Number(valueOf("--hours") ?? 24);
/* a wallet with a handful of transactions is a wallet, not a burner */
const MIN_NONCE = Number(valueOf("--min-nonce") ?? 5);
const CHUNK = Number(valueOf("--chunk") ?? 800);
const BLOCKS_PER_HOUR = 1800; /* Base: ~2s blocks */

function valueOf(flag) {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1];
}

const padTopic = (address) => "0x" + address.slice(2).toLowerCase().padStart(64, "0");

async function main() {
  const startedAt = nowIso();
  const latest = Number(hexToBig(await rpc("eth_blockNumber")));
  const from = latest - hours * BLOCKS_PER_HOUR;
  const sinks = Object.keys(DEX_SINKS);
  const sinkTopics = sinks.map(padTopic);
  const project = projectAddresses(".");

  console.log(`window: blocks ${from}..${latest} (~${hours}h) · venues: ${sinks.length}`);

  /* Walk backwards from the tip: the freshest buyers first, and we stop as
     soon as there are enough candidates to survive the filters. */
  const seen = new Map(); /* address -> first (most recent) qualifying buy */
  let scannedTo = latest;
  let logCount = 0;

  for (let end = latest; end > from; end -= CHUNK) {
    const start = Math.max(from, end - CHUNK + 1);
    let logs;
    try {
      logs = await rpc("eth_getLogs", [{
        address: USDC,
        topics: [TRANSFER_TOPIC, null, sinkTopics],
        fromBlock: "0x" + start.toString(16),
        toBlock: "0x" + end.toString(16),
      }]);
    } catch (error) {
      console.log(`  blocks ${start}..${end}: ${error.message} — skipped`);
      continue;
    }
    logCount += logs.length;
    scannedTo = start;

    /* newest first inside the chunk too */
    for (const log of logs.reverse()) {
      const buyer = topicToAddress(log.topics[1]);
      if (seen.has(buyer)) continue;
      seen.set(buyer, {
        address: buyer,
        buy_tx: log.transactionHash,
        buy_block: Number(hexToBig(log.blockNumber)),
        usdc: toUnits(log.data, 6),
        venue: DEX_SINKS[topicToAddress(log.topics[2])] ?? "unknown",
      });
    }
    process.stdout.write(`\r  scanned ${latest - start} blocks · ${seen.size} unique buyers`);
    /* filters drop roughly half; gather a healthy surplus before stopping */
    if (seen.size >= size * 3) break;
  }
  console.log("");

  const funnel = [];
  let pool = [...seen.values()];
  funnel.push({ step: "unique buyers in window", after: pool.length });

  pool = pool.filter((row) => !project.has(row.address));
  funnel.push({ step: "not a project wallet", after: pool.length });

  /* People, not contracts. A plain EOA has no code; an EIP-7702 wallet has a
     delegation pointer (0xef0100…) and is still one person's wallet — half of
     Base's live buyers are these now, excluding them would select for the
     past. Everything else is a contract and gets dropped. */
  const kept = [];
  let delegated = 0;
  let contracts = 0;
  for (let i = 0; i < pool.length; i += 25) {
    const slice = pool.slice(i, i + 25);
    const codes = await rpcBatch(slice.map((row) => ({
      method: "eth_getCode", params: [row.address, "latest"],
    })));
    slice.forEach((row, index) => {
      const code = codes[index] ?? "0x";
      if (code === "0x") kept.push({ ...row, wallet: "plain" });
      else if (code.startsWith("0xef0100")) { delegated += 1; kept.push({ ...row, wallet: "delegated" }); }
      else contracts += 1;
    });
    process.stdout.write(`\r  code check ${Math.min(i + 25, pool.length)}/${pool.length}`);
  }
  console.log("");
  pool = kept;
  funnel.push({
    step: "a person's wallet (EOA or EIP-7702)",
    after: pool.length,
    note: `${delegated} of them delegated; ${contracts} contracts dropped`,
  });

  /* alive and not disposable: some history, some gas */
  const alive = [];
  for (let i = 0; i < pool.length; i += 25) {
    const slice = pool.slice(i, i + 25);
    const [nonces, balances] = await Promise.all([
      rpcBatch(slice.map((row) => ({ method: "eth_getTransactionCount", params: [row.address, "latest"] }))),
      rpcBatch(slice.map((row) => ({ method: "eth_getBalance", params: [row.address, "latest"] }))),
    ]);
    slice.forEach((row, index) => {
      const nonce = Number(hexToBig(nonces[index]));
      const eth = toUnits(balances[index], 18);
      if (nonce >= MIN_NONCE && eth > 0) alive.push({ ...row, nonce, eth });
    });
    process.stdout.write(`\r  liveness ${Math.min(i + 25, pool.length)}/${pool.length}`);
  }
  console.log("");
  pool = alive;
  funnel.push({ step: `nonce >= ${MIN_NONCE} and holds ETH`, after: pool.length });

  /* already holds BYKO? then it is not an unasked stranger */
  const strangers = [];
  for (let i = 0; i < pool.length; i += 25) {
    const slice = pool.slice(i, i + 25);
    const balances = await rpcBatch(slice.map((row) => ({
      method: "eth_call",
      params: [{ to: "0x078bb16e24C8931Fc007928c370422e5e38F4372",
        data: "0x70a08231" + row.address.slice(2).padStart(64, "0") }, "latest"],
    })));
    slice.forEach((row, index) => {
      if (toUnits(balances[index], 18) === 0) strangers.push(row);
    });
  }
  pool = strangers;
  funnel.push({ step: "holds no BYKO yet", after: pool.length });

  /* newest buy first, then cut to size */
  pool.sort((a, b) => b.buy_block - a.buy_block);
  const rows = pool.slice(0, size).map((row, index) => ({ rank: index + 1, ...row }));
  funnel.push({ step: `first ${size} by most recent buy`, after: rows.length });

  mkdirSync(OUT_DIR, { recursive: true });
  const cohort = {
    generated: startedAt,
    finished: nowIso(),
    window: { from_block: scannedTo, to_block: latest, hours },
    size: rows.length,
    requested: size,
    filters: funnel,
    venues: DEX_SINKS,
    rows,
    rpc: rpcStats(),
  };
  writeFileSync(`${OUT_DIR}/cohort.json`, JSON.stringify(cohort, null, 2) + "\n");
  writeFileSync(
    `${OUT_DIR}/cohort.csv`,
    toCsv(rows, ["rank", "address", "wallet", "buy_tx", "buy_block", "usdc", "venue", "nonce", "eth"]),
  );

  const method = [
    `# Cohort — how these ${rows.length} wallets were chosen`,
    "",
    `Taken ${startedAt}. Blocks ${scannedTo}..${latest} on Base (~${hours}h back from the tip),`,
    `${logCount} USDC transfers into ${sinks.length} known DEX venues were read straight from the chain.`,
    "",
    "Every filter is a chain read — no indexer, no label service, nothing that can change its answer later:",
    "",
    "| step | wallets left | note |",
    "| --- | ---: | --- |",
    ...funnel.map((f) => `| ${f.step} | ${f.after} | ${f.note ?? ""} |`),
    "",
    "A wallet qualifies if it spent USDC at a DEX in the window, is an ordinary EOA,",
    `has at least ${MIN_NONCE} transactions and some ETH, and holds no BYKO. The list is`,
    "sorted by the most recent qualifying purchase and cut to size.",
    "",
    "Nobody in this list asked for anything.",
    "",
  ].join("\n");
  writeFileSync(`${OUT_DIR}/cohort-method.md`, method);

  console.log(`\ncohort: ${rows.length} wallets`);
  funnel.forEach((f) => console.log(`  ${String(f.after).padStart(5)}  ${f.step}${f.note ? " — " + f.note : ""}`));
  console.log(`\nrpc calls: ${rpcStats().calls}`);
  console.log(`written: ${OUT_DIR}/cohort.json, cohort.csv, cohort-method.md`);
  console.log("\nfirst 10:");
  rows.slice(0, 10).forEach((row) =>
    console.log(`  ${String(row.rank).padStart(3)}  ${row.address}  $${row.usdc.toFixed(2).padStart(9)}  ${row.venue}`));
}

main().catch((error) => {
  console.error("cohort failed:", error.message);
  process.exit(1);
});
