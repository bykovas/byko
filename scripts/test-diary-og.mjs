#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initWasm, Resvg } from "../functions/lib/resvg.js";
import {
  layoutTitle, measureTitleLine, renderDiaryOgSvg, TITLE_MAX_WIDTH,
  HERO_TITLE_MAX_WIDTH, titleOptionsForEntry,
} from "../functions/lib/og-title.mjs";

const manifest = JSON.parse(readFileSync("website/data/diary-og.json", "utf8"));
await initWasm(readFileSync("functions/lib/resvg.wasm"));
/* the same faces the generator and /api/og load, in the same order */
const fonts = [
  readFileSync("website/assets/fonts/Archivo-Bold.ttf"),
  readFileSync("website/assets/fonts/Archivo-SemiBold.ttf"),
  readFileSync("website/assets/fonts/IBMPlexMono-Regular.ttf"),
];

for (const entry of manifest.entries) {
  /* A hero entry carries only its path in the manifest; rebuild the data URI
     from the committed file so the re-render can reproduce the baked card. */
  if (entry.hero) {
    const buf = readFileSync(`website${entry.hero.src}`);
    entry.hero.dataUri = `data:${entry.hero.src.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg"};base64,`
      + buf.toString("base64");
  }
  const layout = layoutTitle(entry.title, titleOptionsForEntry(entry));
  assert.equal(layout.lines.join(" "), entry.title, `${entry.slug}: full title must survive layout`);
  assert.ok(layout.lines.length >= 1 && layout.lines.length <= 5, `${entry.slug}: line count`);
  assert.ok(layout.widths.every(width => width <= TITLE_MAX_WIDTH), `${entry.slug}: title width`);
  for (let i = 0; i < layout.lines.length; i++) {
    assert.equal(layout.widths[i], measureTitleLine(layout.lines[i], layout.fontSize));
  }
  const svg = renderDiaryOgSvg(entry);
  assert.match(svg, /^<svg[^>]+width="1200" height="630"/);
  assert.doesNotMatch(svg, /…|\.\.\./, `${entry.slug}: no ellipsis`);
  const expectedPng = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
    font: { loadSystemFonts: false, fontBuffers: fonts, defaultFontFamily: "Archivo" },
  }).render().asPng();
  const staticPng = readFileSync(
    `website/assets/og/diary/${entry.slug}-${entry.twitterImageVersion}.png`
  );
  assert.equal(Buffer.compare(staticPng, Buffer.from(expectedPng)), 0,
    `${entry.slug}: static X PNG must exactly match the dynamic renderer`);
}

assert.deepEqual(
  layoutTitle("Burning the liquidity, and the first flag that moved").lines,
  ["Burning the liquidity, and", "the first flag that moved"]
);
assert.deepEqual(
  layoutTitle("The diary started with two things I got wrong").lines,
  ["The diary started with", "two things I got wrong"]
);

const forcedThree = layoutTitle(
  "One two three four five six seven eight nine ten eleven twelve thirteen fourteen",
  { fontSizes: [60], maximumLines: () => 3 }
);
assert.equal(forcedThree.lines.length, 3);
assert.equal(forcedThree.lines.join(" "), forcedThree.title);

const forcedFour = layoutTitle(
  "One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone",
  { fontSizes: [48], maximumLines: () => 4 }
);
assert.equal(forcedFour.lines.length, 4);
assert.equal(forcedFour.lines.join(" "), forcedFour.title);

assert.throws(
  () => layoutTitle("x".repeat(200)),
  /cannot fit without truncation/
);

const escapedSvg = renderDiaryOgSvg({
  slug: "xml-title",
  title: "Angles < & > stay words",
  dateText: "13 August 2026",
});
assert.match(escapedSvg, /Angles &lt; &amp; &gt;/);
assert.doesNotMatch(escapedSvg, /Angles < & >/);

/* Hero image: the panel appears, the title keeps the narrow left column, the
   blue rule stops before the panel, and the rasteriser accepts the inlined
   data URI — while the same entry without a hero stays the full-width card. */
{
  const shot = readFileSync("website/assets/diary/metamask-values-a-malicious-token-at-1-032-while-byko-still-has-no-price/metamask-byko-risky-no-price.png");
  const hero = {
    src: "/assets/diary/x/hero.png", alt: "a", mime: "image/png",
    width: shot.readUInt32BE(16), height: shot.readUInt32BE(20),
    dataUri: "data:image/png;base64," + shot.toString("base64"),
  };
  const heroEntry = { slug: "hero-case", title: "EURR is the opposite control case BYKO needed", dateText: "27 August 2026", hero };
  assert.deepEqual(Object.keys(titleOptionsForEntry(heroEntry)).sort(), ["fontSizes", "maxWidth", "maximumLines"]);
  assert.deepEqual(titleOptionsForEntry({ slug: "x", title: "y" }), {}, "no hero → default title options");
  const heroLayout = layoutTitle(heroEntry.title, titleOptionsForEntry(heroEntry));
  assert.ok(heroLayout.widths.every(w => w <= HERO_TITLE_MAX_WIDTH), "hero title fits the narrow column");
  const heroSvg = renderDiaryOgSvg(heroEntry);
  assert.match(heroSvg, /<image href="data:image\/png;base64,/, "hero panel embeds the image");
  assert.match(heroSvg, /<clipPath id="og-hero">/, "hero panel is clipped to its rect");
  assert.match(heroSvg, /x1="72" y1="150" x2="724"/, "blue rule stops before the hero panel");
  const heroPng = new Resvg(heroSvg, {
    fitTo: { mode: "width", value: 1200 },
    font: { loadSystemFonts: false, fontBuffers: fonts, defaultFontFamily: "Archivo" },
  }).render().asPng();
  assert.ok(heroPng.byteLength > 40_000, "hero card rasterises with the image baked in");

  const plainSvg = renderDiaryOgSvg({ slug: "hero-case", title: heroEntry.title, dateText: heroEntry.dateText });
  assert.doesNotMatch(plainSvg, /<image /, "no hero → no image element");
  assert.match(plainSvg, /x1="72" y1="150" x2="1128"/, "no hero → full-width blue rule");
}

console.log(`diary OG layout/render: ${manifest.entries.length} current titles and byte-identical static PNGs + long/3-line/4-line/XML/failure/hero cases ok`);
