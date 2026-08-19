#!/usr/bin/env node
/* Canonical hash of rules.json — the exact value the worker computes at
 * runtime (market/src/lib/rules.ts uses the identical canonicalization). Run
 * this AFTER committing rules.json, then insert the printed row into D1 so the
 * worker's live hash matches. Editing rules.json changes this hash and the
 * running arm halts with a `rules-mismatch` event until the row is updated.
 *
 *   node market/scripts/hash-rules.mjs
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(value[k])).join(",") + "}";
}

const path = new URL("../rules.json", import.meta.url);
const raw = readFileSync(path, "utf8");
const obj = JSON.parse(raw);
const hash = createHash("sha256").update(canonicalize(obj)).digest("hex");

let commit = "UNCOMMITTED";
try { commit = execSync("git rev-parse HEAD", { cwd: new URL(".", import.meta.url) }).toString().trim(); } catch { /* not in git */ }

console.log("canonical sha256:", hash);
console.log("declared_at:     ", obj.declared_at);
console.log("git HEAD:        ", commit);
console.log("\n-- apply after the schema, with the commit that published rules.json:");
console.log(
  `INSERT OR REPLACE INTO rules (id, declared_at, git_commit, json, sha256)\n` +
  `VALUES (1, '${obj.declared_at}', '${commit}',\n` +
  `  readfile-or-paste-rules.json-here,\n` +
  `  '${hash}');`,
);
console.log("\n(the `json` column is the file verbatim; paste it or load with .import — the hash is over the canonical form, not the stored text, so whitespace in `json` does not matter.)");
