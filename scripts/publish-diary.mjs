#!/usr/bin/env node
/* Publish new diary entries to Facebook (long text) and X (short text).
 *
 * Runs from .github/workflows/publish-diary.yml on pushes that touch
 * website/content/diary.md. The push itself is the event: new entries are
 * taken from `git diff BEFORE..AFTER` of that one file — no separate journal
 * of what was published, no full-file re-parse.
 *
 * An entry is NEW when the added lines of the diff contain a complete entry
 * (a "## {Title} — {DD Month YYYY}" header AND its own "---" field block)
 * whose header line did not exist in the BEFORE version of the file. Edits
 * to old entries therefore never publish: their fragments do not parse as
 * complete entries, and their headers already existed.
 *
 * Per entry: long-form body → Facebook Page post (link preview to the diary
 * anchor), the **X:** field → X post with the same link. An entry without
 * an **X:** field goes to Facebook only — the two texts are authored
 * independently and one is NEVER derived from the other.
 *
 * Before anything is posted, the deployed site is polled until every new
 * entry's anchor is actually present in the served diary page (Cloudflare
 * Pages deploys in parallel with this workflow); timeout fails the run
 * before any post goes out.
 *
 * Progress (which posts already went out) is written to PROGRESS_FILE and
 * persisted via actions/cache — a re-run skips what already succeeded and
 * never writes back into the repository, so no push loop can form.
 *
 * Env: BEFORE_SHA, AFTER_SHA, PROGRESS_FILE, SITE_URL,
 *      FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN,
 *      X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET,
 *      DRY_RUN=1 to parse and log without polling or posting.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import crypto from "node:crypto";

const FILE = "website/content/diary.md";
const SITE = process.env.SITE_URL || "https://byko.bykovas.lt";
const PAUSE_S = 45;            /* between outbound posts */
const POLL_INTERVAL_S = 10;
const POLL_TIMEOUT_S = 180;
const X_TEXT_MAX = 250;        /* leaves room for the t.co-wrapped link */

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

const before = process.env.BEFORE_SHA || "";
const after = process.env.AFTER_SHA || "";
const progressFile = process.env.PROGRESS_FILE || ".publish-progress";
const dryRun = process.env.DRY_RUN === "1";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function fail(message) {
  console.error("FAIL: " + message);
  process.exit(1);
}

/* ---------- parsing (keep slugify in sync with scripts/render-diary.mjs) */

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function parseDate(text) {
  const match = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const month = MONTHS.findIndex(m => m.toLowerCase() === match[2].toLowerCase());
  if (month === -1) return null;
  return new Date(Date.UTC(Number(match[3]), month, Number(match[1])));
}

/* Complete entries found in a chunk of markdown (whole file or added lines). */
function parseEntries(text) {
  const entries = [];
  for (const part of text.replace(/<!--[\s\S]*?-->/g, "").split(/^## /m).slice(1)) {
    const lines = part.split("\n");
    const header = lines.shift().trim();
    const sep = header.lastIndexOf(" — ");
    if (sep === -1) continue;
    const title = header.slice(0, sep).trim();
    const date = parseDate(header.slice(sep + 3));
    if (!title || !date) continue;
    let cut = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim() === "---") { cut = i; break; }
    }
    if (cut === -1) continue; /* incomplete — not a publishable entry */
    const fields = {};
    for (const row of lines.slice(cut + 1)) {
      const match = /^\*\*([A-Za-z]+):\*\*\s*(.+)$/.exec(row.trim());
      if (match) fields[match[1].toLowerCase()] = match[2].trim();
    }
    entries.push({
      headerLine: "## " + header,
      title, date,
      slug: slugify(title),
      body: lines.slice(0, cut).join("\n").trim(),
      x: fields.x || null,
    });
  }
  return entries;
}

/* Markdown body → plain text for the Facebook post. */
function plainText(markdown) {
  return markdown
    .split(/\n{2,}/)
    .map(block => block
      .split("\n").map(row => row.trim().replace(/^- /, "– ")).join("\n")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, "$1 ($2)"))
    .join("\n\n").trim();
}

/* ---------- what is new in this push ---------- */

if (!/^[0-9a-f]{40}$/.test(before) || /^0{40}$/.test(before)) {
  fail(`cannot determine the previous state (BEFORE_SHA="${before}", e.g. force-push). Refusing to guess what is new.`);
}

const diff = git("diff", before, after, "--", FILE);
const addedText = diff.split("\n")
  .filter(line => line.startsWith("+") && !line.startsWith("+++"))
  .map(line => line.slice(1))
  .join("\n");

let beforeHeaders = new Set();
try {
  beforeHeaders = new Set(
    git("show", `${before}:${FILE}`).split("\n").filter(l => l.startsWith("## ")).map(l => l.trim()));
} catch { /* file did not exist before — every entry is new */ }

const newEntries = parseEntries(addedText)
  .filter(entry => !beforeHeaders.has(entry.headerLine))
  .sort((a, b) => a.date - b.date); /* oldest first — natural feed order */

if (newEntries.length === 0) {
  console.log("no new complete entries in this push — nothing to publish");
  process.exit(0);
}
console.log(`new entries (${newEntries.length}): ` + newEntries.map(e => e.slug).join(", "));

for (const entry of newEntries) {
  if (entry.x && entry.x.length > X_TEXT_MAX) {
    fail(`entry "${entry.title}": **X:** text is ${entry.x.length} chars (max ${X_TEXT_MAX}). Not truncating silently.`);
  }
}

/* ---------- progress (persisted via actions/cache, never the repo) ------ */

const done = new Set(
  existsSync(progressFile)
    ? readFileSync(progressFile, "utf8").split("\n").filter(Boolean)
    : []);
if (done.size) console.log("already published in a previous attempt: " + [...done].join(", "));

function markDone(key) {
  done.add(key);
  appendFileSync(progressFile, key + "\n");
}

/* ---------- helpers ---------- */

const sleep = s => new Promise(resolve => setTimeout(resolve, s * 1000));

async function pollSiteForAnchors(slugs) {
  const url = `${SITE}/diary.html`;
  const deadline = Date.now() + POLL_TIMEOUT_S * 1000;
  /* fetching 200 alone proves nothing — the page exists before the deploy
     lands; the anchors of the new entries are what proves the deploy. */
  for (;;) {
    try {
      const response = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
      if (response.ok) {
        const html = await response.text();
        const missing = slugs.filter(slug => !html.includes(`id="${slug}"`));
        if (missing.length === 0) return;
        console.log(`waiting for deploy: missing anchors ${missing.join(", ")}`);
      } else {
        console.log(`waiting for deploy: ${url} → ${response.status}`);
      }
    } catch (error) {
      console.log(`waiting for deploy: ${error.message}`);
    }
    if (Date.now() > deadline) {
      fail(`deploy did not surface the new entries within ${POLL_TIMEOUT_S}s — nothing was published`);
    }
    await sleep(POLL_INTERVAL_S);
  }
}

async function postFacebook(entry) {
  const link = `${SITE}/diary.html#${entry.slug}`;
  const message = `${entry.title}\n${entry.date.getUTCDate()} ${MONTHS[entry.date.getUTCMonth()]} ${entry.date.getUTCFullYear()}\n\n${plainText(entry.body)}`;
  const response = await fetch(`https://graph.facebook.com/v19.0/${process.env.FB_PAGE_ID}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      message, link,
      access_token: process.env.FB_PAGE_ACCESS_TOKEN,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.id) {
    throw new Error(`facebook ${response.status}: ${JSON.stringify(payload.error && payload.error.message || payload)}`);
  }
  console.log(`facebook ok: post ${payload.id}`);
}

/* OAuth 1.0a (HMAC-SHA1) for POST /2/tweets — for a JSON body only the
   oauth_* parameters enter the signature base string. */
function oauthHeader(url) {
  const enc = encodeURIComponent;
  const params = {
    oauth_consumer_key: process.env.X_API_KEY,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: process.env.X_ACCESS_TOKEN,
    oauth_version: "1.0",
  };
  const paramString = Object.keys(params).sort().map(k => `${enc(k)}=${enc(params[k])}`).join("&");
  const base = ["POST", enc(url), enc(paramString)].join("&");
  const key = `${enc(process.env.X_API_SECRET)}&${enc(process.env.X_ACCESS_SECRET)}`;
  params.oauth_signature = crypto.createHmac("sha1", key).update(base).digest("base64");
  return "OAuth " + Object.keys(params).sort().map(k => `${enc(k)}="${enc(params[k])}"`).join(", ");
}

async function postX(entry) {
  const url = "https://api.x.com/2/tweets";
  const text = `${entry.x}\n${SITE}/diary.html#${entry.slug}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: oauthHeader(url) },
    body: JSON.stringify({ text }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.data || !payload.data.id) {
    throw new Error(`x ${response.status}: ${JSON.stringify(payload.detail || payload.errors || payload)}`);
  }
  console.log(`x ok: tweet ${payload.data.id}`);
}

/* ---------- run ---------- */

const queue = [];
for (const entry of newEntries) {
  queue.push({ key: `${entry.slug} fb`, label: `facebook: ${entry.slug}`, run: () => postFacebook(entry) });
  if (entry.x) queue.push({ key: `${entry.slug} x`, label: `x: ${entry.slug}`, run: () => postX(entry) });
}

if (dryRun) {
  console.log("DRY_RUN — would publish, in order:");
  for (const item of queue) console.log("  " + item.label + (done.has(item.key) ? " (already done, would skip)" : ""));
  process.exit(0);
}

await pollSiteForAnchors(newEntries.map(e => e.slug));

const published = [];
let first = true;
for (const item of queue) {
  if (done.has(item.key)) {
    console.log(`skip (already published): ${item.label}`);
    continue;
  }
  if (!first) {
    console.log(`pausing ${PAUSE_S}s…`);
    await sleep(PAUSE_S);
  }
  first = false;
  try {
    await item.run();
    markDone(item.key);
    published.push(item.label);
  } catch (error) {
    const remaining = queue.slice(queue.indexOf(item) + 1).filter(q => !done.has(q.key)).map(q => q.label);
    console.error(`published this run: ${published.join(", ") || "(nothing)"}`);
    console.error(`failed on: ${item.label}`);
    console.error(`not published: ${remaining.join(", ") || "(nothing)"}`);
    fail(error.message);
  }
}
console.log(`done — published this run: ${published.join(", ") || "(nothing new)"}`);
