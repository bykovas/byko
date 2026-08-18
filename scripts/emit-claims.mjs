#!/usr/bin/env node
/* website/content/claims.md → website/data/claims.json
 *
 * Same contract as render-diary.mjs: the markdown is the single hand-written
 * source, the JSON is generated, both are committed together. Run manually
 * from the repository root, alongside the diary render:
 *
 *   node scripts/emit-claims.mjs
 *
 * All validation lives in validateClaims() below. scripts/test-claims.mjs
 * re-runs it (in CI too) and additionally checks that the committed JSON is
 * exactly what this file would produce. Published ids are immutable: this
 * script refuses to drop or rename an id that already exists in claims.json.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const SOURCE = "website/content/claims.md";
export const OUTPUT = "website/data/claims.json";
const DIARY_MANIFEST = "website/data/diary-og.json";

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SOURCE_RE = /^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TEXT_MAX = 140;

/* The claims.md format, parsed the way render-diary.mjs parses diary.md:
   "## {id} — {type}" headers, body, then a "---" field block. Repeated
   **Source:** lines accumulate; every other key is single. */
export function parseClaims(markdown) {
  const text = markdown.replace(/<!--[\s\S]*?-->/g, "");
  const claims = [];
  for (const part of text.split(/^## /m).slice(1)) {
    const lines = part.split("\n");
    const header = lines.shift().trim();
    const sep = header.lastIndexOf(" — ");
    if (sep === -1) throw new Error(`claim header needs "{id} — {type}": "## ${header}"`);
    const id = header.slice(0, sep).trim();
    const type = header.slice(sep + 3).trim();

    let cut = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim() === "---") { cut = i; break; }
    }
    if (cut === -1) throw new Error(`claim "${id}" is missing the --- field block`);

    const sources = [];
    const fields = {};
    for (const row of lines.slice(cut + 1)) {
      const match = /^\*\*([A-Za-z-]+):\*\*\s*(.+)$/.exec(row.trim());
      if (!match) continue;
      const key = match[1].toLowerCase();
      if (key === "source") sources.push(match[2].trim());
      else fields[key] = match[2].trim();
    }

    const claim = {
      id,
      type,
      text: lines.slice(0, cut).join("\n").trim().replace(/\s+/g, " "),
      entry: fields.entry || "",
      sources,
      opens_at: fields["opens-at"] || "",
    };
    if (fields["frozen-at-block"] !== undefined) {
      claim.frozen_at = { block: Number(fields["frozen-at-block"]) };
    }
    claims.push(claim);
  }
  return claims;
}

/* Throws on the first violation; returns the normalized claims in output
   shape. `slugs` — published diary slugs; `previous` — claims already in
   the committed JSON (their ids may never disappear). */
export function validateClaims(claims, { slugs, previous = [] } = {}) {
  const seen = new Set();
  const normalized = [];
  for (const claim of claims) {
    const where = `claim "${claim.id}"`;
    if (!ID_RE.test(claim.id)) throw new Error(`${where}: id must be lowercase [a-z0-9-]`);
    if (seen.has(claim.id)) throw new Error(`duplicate claim id "${claim.id}"`);
    seen.add(claim.id);

    if (claim.type === "D") {
      throw new Error(`${where}: type D (correspondence, letters, institutional refusals) is banned from claims.md — ` +
        "private mail is not a machine-checkable source; the diary quotes it, claims do not");
    }
    if (!["A", "B", "C"].includes(claim.type)) {
      throw new Error(`${where}: type must be A, B or C — got "${claim.type}"`);
    }
    if (!claim.text) throw new Error(`${where}: empty text`);
    if (claim.text.length > TEXT_MAX) {
      throw new Error(`${where}: text is ${claim.text.length} chars (max ${TEXT_MAX})`);
    }
    if (!claim.entry) throw new Error(`${where}: missing **Entry:** line`);
    if (slugs && !slugs.has(claim.entry)) {
      throw new Error(`${where}: entry "${claim.entry}" is not a published diary slug`);
    }
    if (claim.type === "B" &&
        (!claim.frozen_at || !Number.isInteger(claim.frozen_at.block) || claim.frozen_at.block <= 0)) {
      throw new Error(`${where}: type B needs **Frozen-at-block:** with a positive block number`);
    }
    if (claim.sources.length !== 2) {
      throw new Error(`${where}: exactly two **Source:** lines required, found ${claim.sources.length}`);
    }
    const sources = claim.sources.map(raw => {
      const match = SOURCE_RE.exec(raw);
      if (!match) {
        throw new Error(`${where}: source must be "[label](https://…)" with an absolute https URL — got "${raw}"`);
      }
      return { label: match[1], url: match[2] };
    });
    if (!DATE_RE.test(claim.opens_at)) throw new Error(`${where}: **Opens-at:** must be YYYY-MM-DD`);

    const out = { id: claim.id, entry: claim.entry, text: claim.text, type: claim.type };
    if (claim.frozen_at) out.frozen_at = claim.frozen_at;
    out.sources = sources;
    out.opens_at = claim.opens_at;
    normalized.push(out);
  }

  for (const old of previous) {
    if (!seen.has(old.id)) {
      throw new Error(`published claim id "${old.id}" is missing — ids are immutable; ` +
        "a claim may be superseded by a new one but never renamed or dropped");
    }
  }
  return normalized;
}

export function emit() {
  const slugs = new Set(
    JSON.parse(readFileSync(DIARY_MANIFEST, "utf8")).entries.map(entry => entry.slug));
  const previous = existsSync(OUTPUT)
    ? JSON.parse(readFileSync(OUTPUT, "utf8")).claims
    : [];
  const claims = validateClaims(parseClaims(readFileSync(SOURCE, "utf8")), { slugs, previous });
  writeFileSync(OUTPUT, JSON.stringify({ version: 1, claims }, null, 2) + "\n");
  return claims;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const claims = emit();
  console.log(`claims: ${claims.length} → ${OUTPUT}`);
}
