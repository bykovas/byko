#!/usr/bin/env node
/* Claims validation, run in CI next to the diary tests.
 *
 * Three layers:
 *   1. the live claims.md passes every rule;
 *   2. the committed claims.json is exactly what emit-claims.mjs would
 *      produce — hand-edited JSON or a forgotten emit both fail;
 *   3. fixtures: every rule fails loudly on a synthetic bad claim,
 *      so a silent validator regression cannot slip through.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseClaims, validateClaims, SOURCE, OUTPUT } from "./emit-claims.mjs";

const slugs = new Set(
  JSON.parse(readFileSync("website/data/diary-og.json", "utf8")).entries.map(entry => entry.slug));
const committed = JSON.parse(readFileSync(OUTPUT, "utf8"));

/* 1 — the live file */
const claims = validateClaims(parseClaims(readFileSync(SOURCE, "utf8")),
  { slugs, previous: committed.claims });

/* 2 — md and json agree */
assert.deepEqual(committed, { version: 1, claims },
  "website/data/claims.json is stale — run: node scripts/emit-claims.mjs");

/* 3 — failure fixtures */
const VALID = `## ok-claim — B

Short text.

---
**Entry:** real-entry
**Frozen-at-block:** 50000000
**Source:** [one](https://example.com/1)
**Source:** [two](https://example.com/2)
**Opens-at:** 2026-08-20
`;
const run = markdown => () =>
  validateClaims(parseClaims(markdown), { slugs: new Set(["real-entry"]) });

run(VALID)(); /* the fixture itself must pass */

const cases = [
  [VALID.replace(" — B", " — D"), /type D .* is banned/, "type D rejected"],
  [VALID.replace(" — B", " — E"), /type must be A, B or C/, "unknown type rejected"],
  [VALID.replace("**Frozen-at-block:** 50000000\n", ""), /type B needs \*\*Frozen-at-block:\*\*/, "B without block"],
  [VALID.replace("**Source:** [two](https://example.com/2)\n", ""), /exactly two \*\*Source:\*\*/, "one source"],
  [VALID + "**Source:** [three](https://example.com/3)\n", /exactly two \*\*Source:\*\*/, "three sources"],
  [VALID.replace("https://example.com/1", "http://example.com/1"), /absolute https URL/, "http source"],
  [VALID.replace("Short text.", "x".repeat(141)), /max 140/, "text over 140"],
  [VALID.replace(/real-entry/g, "no-such-entry"), /not a published diary slug/, "unknown entry"],
  [VALID + "\n" + VALID, /duplicate claim id/, "duplicate id"],
  [VALID.replace("ok-claim — B", "Bad_ID — B"), /lowercase \[a-z0-9-\]/, "bad id charset"],
  [VALID.replace("**Opens-at:** 2026-08-20", "**Opens-at:** soon"), /must be YYYY-MM-DD/, "bad opens_at"],
];
for (const [markdown, pattern, label] of cases) {
  assert.throws(run(markdown), pattern, `fixture failed to fail: ${label}`);
}

/* immutability of published ids */
assert.throws(
  () => validateClaims(parseClaims(VALID),
    { slugs: new Set(["real-entry"]), previous: [{ id: "vanished-claim" }] }),
  /ids are immutable/,
  "dropping a published id must fail");

console.log(`claims: ${claims.length} live claim(s) valid, JSON in sync, ${cases.length + 1} failure fixtures ok`);
