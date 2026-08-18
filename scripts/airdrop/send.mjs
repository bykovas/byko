#!/usr/bin/env node
/* Send 227 BYKO to every wallet in the cohort. Nobody asked for it.
 *
 *   node scripts/airdrop/send.mjs                 # dry run, prints the plan
 *   node scripts/airdrop/send.mjs --execute       # actually sends
 *   node scripts/airdrop/send.mjs --execute --resume
 *   node scripts/airdrop/send.mjs --label wave2   # a later wave, own files
 *
 * Discipline borrowed from the treasury that pays the app's claims, because
 * the failure that matters is the same one: never let the ledger say "not
 * sent" about money that left.
 *
 *   - each transfer is PRE-SIGNED, its hash written to the journal BEFORE the
 *     broadcast, so an interrupted run can always be resolved by receipt;
 *   - the journal is one JSON line per address, appended as we go — the run
 *     resumes exactly where it stopped and never pays an address twice;
 *   - the balance is checked once up front: if the wallet cannot cover the
 *     whole cohort, nothing is sent at all. A half-finished airdrop is a
 *     worse artifact than none.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  createPublicClient, createWalletClient, encodeFunctionData, fallback,
  getAddress, http, keccak256, parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { BYKO, nowIso, readJson, toCsv } from "./lib.mjs";

const OUT_DIR = "website/data/experiments/airdrop";
const AMOUNT = "227";
const CHAIN_ID = 8453;

const args = process.argv.slice(2);
const execute = args.includes("--execute");
const resume = args.includes("--resume");
const limit = Number(valueOf("--limit") ?? 0);
/* Each wave keeps its own cohort, journal and report. Sharing a journal
   across waves would let wave 2 append to wave 1's record and overwrite the
   report that documents it — the one file that must stay true forever. */
const label = valueOf("--label") ?? null;
const suffix = label ? `-${label}` : "";
const COHORT = `${OUT_DIR}/cohort${suffix}.json`;
const JOURNAL = `${OUT_DIR}/airdrop-journal${suffix}.jsonl`;

function valueOf(flag) {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1];
}

const ERC20 = [
  { type: "function", name: "transfer", stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
];

const RPCS = [
  process.env.DRPC_URL,
  "https://mainnet.base.org",
  "https://base-rpc.publicnode.com",
  "https://base.drpc.org",
].filter(Boolean);

const chain = {
  id: CHAIN_ID,
  name: "base",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPCS[0]] } },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* what the journal already knows: address -> record */
function readJournal() {
  if (!existsSync(JOURNAL)) return new Map();
  const done = new Map();
  for (const line of readFileSync(JOURNAL, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      done.set(row.address.toLowerCase(), row);
    } catch { /* a torn last line is not a reason to stop */ }
  }
  return done;
}

function note(record) {
  appendFileSync(JOURNAL, JSON.stringify(record) + "\n");
}

async function main() {
  const cohort = readJson(COHORT);
  if (!cohort?.rows?.length) throw new Error(`no ${COHORT} — run cohort.mjs first`);

  const key = process.env.AIRDROP_PRIVATE_KEY?.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(key ?? "")) throw new Error("AIRDROP_PRIVATE_KEY missing or malformed");
  const account = privateKeyToAccount(key);

  const transport = fallback(RPCS.map((url) => http(url, { retryCount: 2, timeout: 15_000 })), { rank: false });
  const reader = createPublicClient({ chain, transport });
  const wallet = createWalletClient({ account, chain, transport });

  const token = getAddress(BYKO.toLowerCase());
  const amount = parseUnits(AMOUNT, 18);

  const journal = resume || !execute ? readJournal() : readJournal();
  const targets = cohort.rows
    .map((row) => ({ ...row, address: getAddress(row.address.toLowerCase()) }))
    .filter((row) => {
      const seen = journal.get(row.address.toLowerCase());
      /* a row that already has a hash is settled — never send twice */
      return !seen || !seen.tx_hash;
    })
    .slice(0, limit > 0 ? limit : undefined);

  const [stock, gas] = await Promise.all([
    reader.readContract({ address: token, abi: ERC20, functionName: "balanceOf", args: [account.address] }),
    reader.getBalance({ address: account.address }),
  ]);
  const needed = amount * BigInt(targets.length);

  console.log(`sender     ${account.address}`);
  console.log(`chain      Base (${CHAIN_ID})`);
  console.log(`wave       ${label ?? "1 (unlabelled)"} · cohort ${COHORT}`);
  console.log(`cohort     ${cohort.rows.length} wallets · already sent ${journal.size} · to send ${targets.length}`);
  console.log(`amount     ${AMOUNT} BYKO each · ${Number(needed) / 1e18} BYKO total`);
  console.log(`stock      ${Number(stock) / 1e18} BYKO`);
  console.log(`gas        ${Number(gas) / 1e18} ETH`);
  console.log(`mode       ${execute ? "EXECUTE — real transfers" : "dry run"}`);

  if (stock < needed) {
    console.error(`\nSTOP: short by ${Number(needed - stock) / 1e18} BYKO. Nothing sent.`);
    console.error("A half-finished airdrop is a worse artifact than none.");
    process.exit(1);
  }
  if (gas === 0n) {
    console.error("\nSTOP: the sender holds no ETH. Nothing sent.");
    process.exit(1);
  }

  if (!execute) {
    console.log("\nfirst 5 of the plan:");
    targets.slice(0, 5).forEach((row, i) =>
      console.log(`  ${String(i + 1).padStart(3)}  ${row.address}  ${AMOUNT} BYKO`));
    console.log(`\nnothing was sent. add --execute to make it real.`);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  let nonce = await reader.getTransactionCount({ address: account.address, blockTag: "pending" });
  let sent = 0;
  let failed = 0;

  for (const [index, row] of targets.entries()) {
    const line = `${String(index + 1).padStart(3)}/${targets.length} ${row.address}`;
    try {
      const request = await wallet.prepareTransactionRequest({
        account, chain, to: token, nonce,
        data: encodeFunctionData({ abi: ERC20, functionName: "transfer", args: [row.address, amount] }),
      });
      const serialized = await wallet.signTransaction(request);
      const hash = keccak256(serialized);

      /* the record precedes the money, always */
      note({ address: row.address, amount: Number(AMOUNT), tx_hash: hash, nonce, sent_at: nowIso() });

      await wallet.sendRawTransaction({ serializedTransaction: serialized });
      nonce += 1;
      sent += 1;
      console.log(`${line}  ${hash}`);
    } catch (error) {
      failed += 1;
      const message = String(error.shortMessage ?? error.message ?? error).split("\n")[0];
      console.log(`${line}  FAILED: ${message}`);
      note({ address: row.address, amount: Number(AMOUNT), tx_hash: null, error: message, sent_at: nowIso() });
      /* a stale nonce is the usual cause — resync and carry on */
      nonce = await reader.getTransactionCount({ address: account.address, blockTag: "pending" });
      await sleep(1_000);
    }
    await sleep(120); /* be a polite citizen of the node */
  }

  /* the public record of the run */
  const all = [...readJournal().values()];
  writeFileSync(`${OUT_DIR}/airdrop-sent${suffix}.json`, JSON.stringify({
    generated: nowIso(), sender: account.address, amount: Number(AMOUNT),
    cohort_size: cohort.rows.length, rows: all,
  }, null, 2) + "\n");
  writeFileSync(
    `${OUT_DIR}/airdrop-sent${suffix}.csv`,
    toCsv(all, ["address", "amount", "tx_hash", "nonce", "sent_at", "error"]),
  );

  console.log(`\nsent ${sent} · failed ${failed} · journal ${JOURNAL}`);
  if (failed > 0) console.log("re-run with --execute --resume to retry the failures");
}

main().catch((error) => {
  console.error("send failed:", error.message);
  process.exit(1);
});
