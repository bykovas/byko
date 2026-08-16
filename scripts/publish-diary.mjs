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
 * Per entry: long-form body → Facebook Page post (link preview to /d/{slug}),
 * the **X:** field → X post with the same link. Published links carry one
 * commit-specific `?v={unix-timestamp}` cache buster so X fetches a fresh URL;
 * the page's canonical and og:url deliberately remain the clean /d/{slug}.
 * An entry without
 * an **X:** field goes to Facebook only — the two texts are authored
 * independently and one is NEVER derived from the other.
 *
 * Before anything is posted, every cache-busted /d/{slug}?v=... share URL is
 * polled until that exact URL returns a direct 200 with the expected clean
 * canonical/slug marker and its Twitter image also returns a direct 200 PNG.
 * This both proves the Cloudflare deploy landed and warms the fresh social
 * page/image cache keys. A timeout fails the run before any post goes out.
 *
 * Progress (which posts already went out) is written to PROGRESS_FILE and
 * persisted via actions/cache — a re-run skips what already succeeded and
 * never writes back into the repository, so no push loop can form.
 *
 * Env: BEFORE_SHA, AFTER_SHA, PROGRESS_FILE, SITE_URL,
 *      FB_BYKO_PAGE_ACCESS_TOKEN (the page id is resolved from the token),
 *      XCOM_BYKO_API_KEY, XCOM_BYKO_API_SECRET,
 *      XCOM_BYKO_ACCESS_TOKEN, XCOM_BYKO_ACCESS_SECRET (OAuth 1.0a),
 *      DRY_RUN=1 to parse and log without polling or posting.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import crypto from "node:crypto";

const FILE = "website/content/diary.md";
const SITE = (process.env.SITE_URL || "https://byko.bykovas.lt").replace(/\/+$/, "");
const PAUSE_S = 45;            /* between outbound posts */
const POLL_INTERVAL_S = 10;
const POLL_TIMEOUT_S = 180;
const SCRAPE_TIMEOUT_S = 120;  /* how long Facebook gets to crawl a usable card */
const X_TEXT_MAX = 250;        /* leaves room for the t.co-wrapped link */

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

const before = process.env.BEFORE_SHA || "";
const after = process.env.AFTER_SHA || "";
const progressFile = process.env.PROGRESS_FILE || ".publish-progress";
const dryRun = process.env.DRY_RUN === "1";
let SHARE_CACHE_BUSTER;

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
    /* Image lines are page structure, not prose: the screenshots belong to
       the entry, and "![alt](/assets/…)" must never surface as post text. */
    .map(block => block.split("\n").filter(row => !/^!\[[^\]]*\]\([^)\s]+\)$/.test(row.trim())).join("\n"))
    .filter(block => block.trim())
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
if (!/^[0-9a-f]{40}$/.test(after) || /^0{40}$/.test(after)) {
  fail(`cannot determine the published commit (AFTER_SHA="${after}"). Refusing to construct share URLs.`);
}
/* Use the commit's Unix timestamp: every new commit gets a fresh X cache key,
   while retries of that same publish keep the Facebook and X URLs identical. */
SHARE_CACHE_BUSTER = git("show", "-s", "--format=%ct", after).trim();
if (!/^\d{10,}$/.test(SHARE_CACHE_BUSTER)) {
  fail(`cannot determine a Unix timestamp for ${after}`);
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

function canonicalEntryUrl(entry) {
  return `${SITE}/d/${typeof entry === "string" ? entry : entry.slug}`;
}

function entryUrl(entry) {
  return `${canonicalEntryUrl(entry)}?v=${SHARE_CACHE_BUSTER}`;
}

function pngDimensions(bytes) {
  if (bytes.byteLength < 24) return null;
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i]) return null;
  }
  if (String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]) !== "IHDR") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

async function deployedEntryProblem(entry) {
  const url = entryUrl(entry);
  const response = await fetch(url, {
    redirect: "manual",
    headers: { "Cache-Control": "no-cache", "User-Agent": "Twitterbot/1.0" },
  });
  if (response.status !== 200) return `${url} → ${response.status}`;
  const html = await response.text();
  if (!html.includes(`data-diary-slug="${entry.slug}"`)) return `${url} → wrong or missing slug marker`;
  /* The check above asks the edge to revalidate, so it sees the deploy the
     moment it lands. A crawler asks for nothing of the sort and can still be
     handed a cached or not-yet-propagated 404 — which is exactly what ends up
     in the preview card. Verify the page the way a crawler will get it. */
  const asCrawler = await fetch(url, {
    redirect: "manual",
    headers: { "User-Agent": "facebookexternalhit/1.1" },
  });
  if (asCrawler.status !== 200) return `${url} → ${asCrawler.status} for a plain crawler request`;
  if (!(await asCrawler.text()).includes(`data-diary-slug="${entry.slug}"`)) {
    return `${url} → wrong page for a plain crawler request`;
  }
  const canonicalUrl = canonicalEntryUrl(entry);
  if (!html.includes(`<link rel="canonical" href="${canonicalUrl}">`)) return `${url} → wrong or missing canonical`;
  if (!html.includes('<meta name="twitter:card" content="summary_large_image">')) {
    return `${url} → summary_large_image metadata missing`;
  }
  const imageMatch = /<meta name="twitter:image" content="([^"]+)">/.exec(html);
  if (!imageMatch) return `${url} → twitter:image missing`;
  const imageUrl = imageMatch[1].replace(/&amp;/g, "&");
  let parsedImageUrl;
  try { parsedImageUrl = new URL(imageUrl); }
  catch { return `${url} → invalid twitter:image URL`; }
  const expectedImagePath = new RegExp(`^/assets/og/diary/${entry.slug}-[0-9a-f]{12}\\.png$`);
  if (parsedImageUrl.origin !== SITE || parsedImageUrl.search || parsedImageUrl.hash ||
      !expectedImagePath.test(parsedImageUrl.pathname)) {
    return `${url} → twitter:image must be a same-origin versioned static diary PNG`;
  }
  const imageResponse = await fetch(imageUrl, {
    redirect: "manual",
    headers: { "Cache-Control": "no-cache", "User-Agent": "Twitterbot/1.0" },
  });
  const imageType = (imageResponse.headers.get("content-type") || "").split(";", 1)[0];
  if (imageResponse.status !== 200 || imageType !== "image/png") {
    return `${imageUrl} → ${imageResponse.status} ${imageType || "without content-type"}`;
  }
  const dimensions = pngDimensions(new Uint8Array(await imageResponse.arrayBuffer()));
  if (!dimensions || dimensions.width !== 1200 || dimensions.height !== 630) {
    return `${imageUrl} → expected PNG 1200×630, got ${dimensions ? `${dimensions.width}×${dimensions.height}` : "invalid PNG"}`;
  }
  return null;
}

async function pollSiteForEntries(entries) {
  const deadline = Date.now() + POLL_TIMEOUT_S * 1000;
  for (;;) {
    try {
      const problems = (await Promise.all(entries.map(async entry => {
        try { return await deployedEntryProblem(entry); }
        catch (error) { return `${entryUrl(entry)} → ${error.message}`; }
      }))).filter(Boolean);
      if (problems.length === 0) return;
      console.log(`waiting for deploy: ${problems.join("; ")}`);
    } catch (error) {
      console.log(`waiting for deploy: ${error.message}`);
    }
    if (Date.now() > deadline) {
      fail(`deploy did not surface the new entries within ${POLL_TIMEOUT_S}s — nothing was published`);
    }
    await sleep(POLL_INTERVAL_S);
  }
}

let fbPageId = null;
async function resolveFbPageId() {
  if (fbPageId) return fbPageId;
  const response = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${encodeURIComponent(process.env.FB_BYKO_PAGE_ACCESS_TOKEN)}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.id) {
    throw new Error(`facebook token check failed (${response.status}): ${JSON.stringify(payload.error && payload.error.message || payload)} — the page token may have expired`);
  }
  fbPageId = payload.id;
  console.log(`facebook page id resolved: ${fbPageId}`);
  return fbPageId;
}

/* Facebook builds the card from its own crawl, not from anything we send, and
   it keeps whatever it got the first time. One unlucky crawl during the deploy
   window is enough to publish a post whose card reads "BYKO — 404" forever, so
   the scrape is forced and its result inspected before the post exists. */
async function primeFacebookPreview(entry) {
  const url = entryUrl(entry);
  const deadline = Date.now() + SCRAPE_TIMEOUT_S * 1000;
  for (;;) {
    const response = await fetch("https://graph.facebook.com/v19.0/?" + new URLSearchParams({
      id: url, scrape: "true", access_token: process.env.FB_BYKO_PAGE_ACCESS_TOKEN,
    }), { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    const title = payload.title || (payload.og_object && payload.og_object.title) || "";
    if (response.ok && title && !/\b404\b/.test(title)) {
      if (title.trim() !== entry.title.trim()) {
        console.log(`facebook scraped a different title than expected: ${JSON.stringify(title)}`);
      }
      console.log(`facebook preview primed: ${JSON.stringify(title)}`);
      return;
    }
    const problem = response.ok
      ? `scraped title ${JSON.stringify(title) || "(empty)"}`
      : `graph ${response.status}: ${JSON.stringify(payload.error && payload.error.message || payload)}`;
    if (Date.now() > deadline) {
      throw new Error(`facebook never scraped ${url} into a usable card (${problem}) — refusing to post a broken preview`);
    }
    console.log(`waiting for facebook to scrape the entry: ${problem}`);
    await sleep(POLL_INTERVAL_S);
  }
}

async function postFacebook(entry) {
  await primeFacebookPreview(entry);
  const link = entryUrl(entry);
  const message = `${entry.title}\n${entry.date.getUTCDate()} ${MONTHS[entry.date.getUTCMonth()]} ${entry.date.getUTCFullYear()}\n\n${plainText(entry.body)}`;
  const pageId = await resolveFbPageId();
  const response = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      message, link,
      access_token: process.env.FB_BYKO_PAGE_ACCESS_TOKEN,
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
    oauth_consumer_key: process.env.XCOM_BYKO_API_KEY,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: process.env.XCOM_BYKO_ACCESS_TOKEN,
    oauth_version: "1.0",
  };
  const paramString = Object.keys(params).sort().map(k => `${enc(k)}=${enc(params[k])}`).join("&");
  const base = ["POST", enc(url), enc(paramString)].join("&");
  const key = `${enc(process.env.XCOM_BYKO_API_SECRET)}&${enc(process.env.XCOM_BYKO_ACCESS_SECRET)}`;
  params.oauth_signature = crypto.createHmac("sha1", key).update(base).digest("base64");
  return "OAuth " + Object.keys(params).sort().map(k => `${enc(k)}="${enc(params[k])}"`).join(", ");
}

async function postX(entry) {
  const url = "https://api.x.com/2/tweets";
  const text = `${entry.x}\n${entryUrl(entry)}`;
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
  console.log(`share URL cache buster: v=${SHARE_CACHE_BUSTER}`);
  for (const entry of newEntries) console.log(`share URL: ${entryUrl(entry)}`);
  for (const item of queue) console.log("  " + item.label + (done.has(item.key) ? " (already done, would skip)" : ""));
  process.exit(0);
}

await pollSiteForEntries(newEntries);

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
