#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const SITE = "https://byko.bykovas.lt";
const manifest = JSON.parse(readFileSync("website/data/diary-og.json", "utf8"));
const sitemap = readFileSync("website/sitemap.xml", "utf8");
const diary = readFileSync("website/diary.html", "utf8");
const index = readFileSync("website/index.html", "utf8");
const publisher = readFileSync("scripts/publish-diary.mjs", "utf8");
const headers = readFileSync("website/_headers", "utf8");
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
assert.match(publisher, /twitter:image must be a same-origin versioned static diary PNG/,
  "publisher must reject dynamic or cross-origin X images");
assert.match(publisher, /"User-Agent": "facebookexternalhit\/1\.1"/,
  "publisher must verify the page the way a crawler receives it, without asking for revalidation");
assert.match(publisher, /params\.scrape = "true"/,
  "publisher must force a Facebook crawl before the post exists");
assert.match(publisher, /await primeFacebookPreview\(entry\)/,
  "publisher must prime the Facebook preview before posting");
assert.equal((publisher.match(/await requireDeployed\(entry\);/g) || []).length, 2,
  "both posts must re-verify the entry immediately before they go out");
assert.match(publisher, /"User-Agent": "Twitterbot\/1\.0" \},\s*\}\);\s*const crawlerType/,
  "publisher must fetch the social image the way a crawler receives it");
assert.match(publisher, /commitMessage\.includes\("\[skip-facebook\]"\)/,
  "publisher must honour a per-commit Facebook skip");
assert.match(publisher, /commitMessage\.includes\("\[skip-x\]"\)/,
  "publisher must honour a per-commit X skip");
assert.match(publisher, /settling \$\{SETTLE_S\}s before inviting the crawlers/,
  "publisher must let the deploy propagate before any crawler is invited");
assert.match(publisher, /that URL is now cached as such and any post would carry it/,
  "publisher must refuse to post once Facebook has crawled a 404 for the share URL");
assert.match(publisher, /facebookObjectTitle\(url, \{ rescrape: false \}\)/,
  "publisher must read back what Facebook stores, not only what it just crawled");
assert.match(headers, /\/assets\/og\/diary\/\*[\s\S]*Cache-Control: public, max-age=31536000, immutable/,
  "versioned static X images must have immutable cache headers");

for (const entry of manifest.entries) {
  const url = `${SITE}/d/${entry.slug}`;
  const filename = `${entry.slug}.html`;
  const ogImageUrl = `${SITE}/api/og?slug=${entry.slug}&v=${entry.imageVersion}`;
  const twitterImageUrl = `${SITE}/assets/og/diary/${entry.slug}-${entry.twitterImageVersion}.png`;
  const twitterImagePath = `website/assets/og/diary/${entry.slug}-${entry.twitterImageVersion}.png`;
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
  assert.ok(html.includes(`<meta property="og:image" content="${ogImageUrl.replace(/&/g, "&amp;")}">`),
    `${entry.slug}: Facebook keeps the dynamic OG image`);
  assert.ok(html.includes(`<meta name="twitter:image" content="${twitterImageUrl}">`),
    `${entry.slug}: X gets a static PNG URL`);
  assert.notEqual(ogImageUrl, twitterImageUrl, `${entry.slug}: platform image delivery URLs are split`);
  const png = readFileSync(twitterImagePath);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10],
    `${entry.slug}: static X asset is PNG`);
  assert.equal(png.readUInt32BE(16), 1200, `${entry.slug}: static X asset width`);
  assert.equal(png.readUInt32BE(20), 630, `${entry.slug}: static X asset height`);
  assert.ok(png.byteLength < 5_000_000, `${entry.slug}: static X asset is comfortably below 5 MB`);
  assert.equal(createHash("sha256").update(png).digest("hex").slice(0, 12),
    entry.twitterImageVersion, `${entry.slug}: static X filename hash matches its bytes`);
  /* the wording of the link is the designer's; that one exists is the invariant */
  assert.ok(html.includes('href="/diary"'), `${entry.slug}: links back to the diary index`);
  assert.ok(diary.includes(`id="${entry.slug}"`), `${entry.slug}: legacy diary anchor remains`);
  assert.ok(diary.includes(`href="/d/${entry.slug}"`), `${entry.slug}: diary links to entry page`);
  assert.equal((sitemap.match(new RegExp(`<loc>${url}</loc>`, "g")) || []).length, 1, `${entry.slug}: sitemap URL`);

  for (const [tag, src] of [...html.matchAll(/<img\s+src="(\/assets\/diary\/[^"]+)"[^>]*>/g)].map(m => [m[0], m[1]])) {
    assert.match(tag, /\salt="[^"]+"/, `${entry.slug}: diary image has alt text`);
    assert.match(tag, /\swidth="\d+"\sheight="\d+"/, `${entry.slug}: diary image reserves its space`);
    assert.match(tag, /\sloading="lazy"/, `${entry.slug}: diary image loads lazily`);
    assert.ok(existsSync(`website${src}`), `${entry.slug}: ${src} exists in the repository`);
  }
  assert.doesNotMatch(html, /!\[[^\]]*\]\(/, `${entry.slug}: no unrendered image markdown`);

  const jsonLdMatch = /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/.exec(html);
  assert.ok(jsonLdMatch, `${entry.slug}: JSON-LD exists`);
  const jsonLd = JSON.parse(jsonLdMatch[1]);
  assert.equal(jsonLd["@type"], "BlogPosting", `${entry.slug}: JSON-LD type`);
  assert.equal(jsonLd.url, url, `${entry.slug}: JSON-LD URL`);
  assert.equal(jsonLd.headline, entry.title, `${entry.slug}: JSON-LD title`);
  assert.equal(jsonLd.datePublished, entry.datePublished, `${entry.slug}: JSON-LD date`);
  assert.equal(jsonLd.image.url, ogImageUrl, `${entry.slug}: JSON-LD follows Open Graph image`);
}

assert.doesNotMatch(diary, /"url": "https:\/\/byko\.bykovas\.lt\/diary#/, "Blog JSON-LD uses entry URLs");
console.log(`diary pages: ${manifest.entries.length} pages, metadata, links, JSON-LD, sitemap and publisher invariants ok`);
