#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const SITE = "https://byko.bykovas.lt";
const manifest = JSON.parse(readFileSync("website/data/diary-og.json", "utf8"));
const sitemap = readFileSync("website/sitemap.xml", "utf8");
const diary = readFileSync("website/diary.html", "utf8");
const index = readFileSync("website/index.html", "utf8");
const publisher = readFileSync("scripts/publish-diary.mjs", "utf8");
const files = readdirSync("website/d").filter(name => name.endsWith(".html")).sort();

assert.equal(files.length, manifest.entries.length, "one generated page per manifest entry");
assert.doesNotMatch(index, /diary\.html#/, "home cards must use entry URLs");
assert.doesNotMatch(publisher, /diary(?:\.html)?#\$\{entry\.slug\}/, "publisher must not use diary anchors");
assert.match(publisher, /redirect:\s*"manual"/, "publisher must reject hidden redirects");
assert.match(publisher, /response\.status !== 200/, "publisher must require a direct 200");
assert.match(publisher, /SHARE_CACHE_BUSTER = git\("show", "-s", "--format=%ct", after\)\.trim\(\)/,
  "publisher must use a stable commit-time cache buster");
assert.match(publisher, /`\$\{canonicalEntryUrl\(entry\)\}\?v=\$\{SHARE_CACHE_BUSTER\}`/,
  "publisher must append the cache buster to shared entry URLs");
assert.match(publisher, /const canonicalUrl = canonicalEntryUrl\(entry\)/,
  "publisher must validate the clean canonical behind the cache-busted URL");
assert.match(publisher, /dimensions\.width !== 1200 \|\| dimensions\.height !== 630/,
  "publisher must verify the social image's actual PNG dimensions");

for (const entry of manifest.entries) {
  const url = `${SITE}/d/${entry.slug}`;
  const filename = `${entry.slug}.html`;
  assert.ok(files.includes(filename), `${entry.slug}: generated file exists`);
  const html = readFileSync(`website/d/${filename}`, "utf8");
  assert.equal((html.match(/data-diary-slug=/g) || []).length, 1, `${entry.slug}: one complete entry`);
  assert.ok(html.includes(`data-diary-slug="${entry.slug}"`), `${entry.slug}: deploy marker`);
  assert.ok(html.includes(`<link rel="canonical" href="${url}">`), `${entry.slug}: canonical`);
  assert.ok(html.includes(`<meta property="og:url" content="${url}">`), `${entry.slug}: og:url`);
  assert.ok(html.includes('<meta property="og:type" content="article">'), `${entry.slug}: article type`);
  assert.ok(html.includes(`<meta property="og:title" content="${entry.title.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}">`), `${entry.slug}: og:title`);
  assert.ok(html.includes('<meta property="og:image:width" content="1200">'), `${entry.slug}: OG width`);
  assert.ok(html.includes('<meta property="og:image:height" content="630">'), `${entry.slug}: OG height`);
  assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image">'), `${entry.slug}: large X card`);
  assert.ok(html.includes(`<meta name="twitter:title" content="${entry.title.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}">`), `${entry.slug}: twitter:title`);
  assert.ok(html.includes(`/api/og?slug=${entry.slug}&amp;v=${entry.imageVersion}`), `${entry.slug}: versioned image URL`);
  assert.ok(html.includes('href="/diary">Read the full diary →</a>'), `${entry.slug}: full diary link`);
  assert.ok(diary.includes(`id="${entry.slug}"`), `${entry.slug}: legacy diary anchor remains`);
  assert.ok(diary.includes(`href="/d/${entry.slug}"`), `${entry.slug}: diary links to entry page`);
  assert.equal((sitemap.match(new RegExp(`<loc>${url}</loc>`, "g")) || []).length, 1, `${entry.slug}: sitemap URL`);

  const jsonLdMatch = /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/.exec(html);
  assert.ok(jsonLdMatch, `${entry.slug}: JSON-LD exists`);
  const jsonLd = JSON.parse(jsonLdMatch[1]);
  assert.equal(jsonLd["@type"], "BlogPosting", `${entry.slug}: JSON-LD type`);
  assert.equal(jsonLd.url, url, `${entry.slug}: JSON-LD URL`);
  assert.equal(jsonLd.headline, entry.title, `${entry.slug}: JSON-LD title`);
  assert.equal(jsonLd.datePublished, entry.datePublished, `${entry.slug}: JSON-LD date`);
}

assert.doesNotMatch(diary, /"url": "https:\/\/byko\.bykovas\.lt\/diary#/, "Blog JSON-LD uses entry URLs");
console.log(`diary pages: ${manifest.entries.length} pages, metadata, links, JSON-LD, sitemap and publisher invariants ok`);
