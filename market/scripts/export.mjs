#!/usr/bin/env node
/* Daily export: pull the public readout and write the CSVs the repo keeps as
 * the record that outlives D1 — the same role airdrop-journal.jsonl plays.
 * Run by hand or a scheduled task, then commit the changed files.
 *
 *   node market/scripts/export.mjs
 *   WASH_URL=https://byko-market.bykovas.lt/api/wash node market/scripts/export.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";

const URL_ = process.env.WASH_URL || "https://byko-market.bykovas.lt/api/wash?limit=500";
const OUT = "website/data/experiments/wash";

function esc(v) {
  const t = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
function csv(rows, cols) {
  return cols.join(",") + "\n" + rows.map((r) => cols.map((c) => esc(r[c])).join(",")).join("\n") + "\n";
}

const res = await fetch(URL_, { headers: { accept: "application/json" } });
if (!res.ok) { console.error("fetch failed:", res.status); process.exit(1); }
const data = await res.json();

mkdirSync(OUT, { recursive: true });

writeFileSync(`${OUT}/trades.csv`, csv(data.trades ?? [], [
  "id", "arm", "side", "usdc_amount", "token_amount", "usdc_settled",
  "price_before", "price_after", "fdv_after", "status", "block_number",
  "tx_hash", "decided_at", "confirmed_at", "gas_wei",
]));

const checkRows = [];
for (const a of data.arms ?? []) {
  for (const c of a.checks ?? []) {
    checkRows.push({
      arm: a.id, source: c.source, asks: c.asks,
      now_value: c.now?.value ?? "", now_ok: c.now?.ok ? 1 : 0, now_at: c.now?.at ?? "",
      cells: (c.cells ?? []).map((x) => `${x.day}:${x.state}`).join(";"),
    });
  }
}
writeFileSync(`${OUT}/checks.csv`, csv(checkRows, ["arm", "source", "asks", "now_value", "now_ok", "now_at", "cells"]));

writeFileSync(`${OUT}/meta.json`, JSON.stringify({
  generated: data.generated, market_open: data.market_open, rules: data.rules,
  arms: (data.arms ?? []).map((a) => ({
    id: a.id, halted: a.halted, halt_reason: a.halt_reason, usdc_spent: a.usdc_spent,
    started_at: a.started_at, market: a.market,
  })),
}, null, 2) + "\n");

console.log(`wrote ${OUT}/trades.csv (${(data.trades ?? []).length} rows), checks.csv, meta.json`);
