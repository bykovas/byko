#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  layoutTitle, measureTitleLine, renderDiaryOgSvg, TITLE_MAX_WIDTH,
} from "../functions/lib/og-title.mjs";

const manifest = JSON.parse(readFileSync("website/data/diary-og.json", "utf8"));

for (const entry of manifest.entries) {
  const layout = layoutTitle(entry.title);
  assert.equal(layout.lines.join(" "), entry.title, `${entry.slug}: full title must survive layout`);
  assert.ok(layout.lines.length >= 1 && layout.lines.length <= 4, `${entry.slug}: line count`);
  assert.ok(layout.widths.every(width => width <= TITLE_MAX_WIDTH), `${entry.slug}: title width`);
  for (let i = 0; i < layout.lines.length; i++) {
    assert.equal(layout.widths[i], measureTitleLine(layout.lines[i], layout.fontSize));
  }
  const svg = renderDiaryOgSvg(entry);
  assert.match(svg, /^<svg[^>]+width="1200" height="630"/);
  assert.doesNotMatch(svg, /…|\.\.\./, `${entry.slug}: no ellipsis`);
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
  "One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty",
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

console.log(`diary OG layout: ${manifest.entries.length} current titles + long/3-line/4-line/XML/failure cases ok`);
