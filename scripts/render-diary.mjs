#!/usr/bin/env node
/* Render the diary from its single source into static HTML.
 *
 * Source:  website/content/diary.md — published entries, newest first.
 * Output:  website/diary.html  — every entry, full text, between
 *                                <!-- diary:begin --> / <!-- diary:end -->
 *          website/index.html  — the CARD_COUNT most recent entries as cards,
 *                                between the same markers.
 *
 * Run from the repository root after editing the markdown, commit the
 * regenerated pages together with it:
 *   node scripts/render-diary.mjs
 *
 * Entry format (hand-writable, nothing exotic):
 *
 *   ## {Title} — {DD Month YYYY}
 *
 *   Long-form body: paragraphs separated by blank lines. Supported inline
 *   markup: **bold**, `code`, [text](https://url). "- " lines form lists.
 *
 *   ---
 *   **Teaser:** one or two short sentences for the home-page card.
 *
 * The Teaser line is required — cards never truncate the body. With zero
 * entries the home page renders no card block at all and the diary page
 * keeps only its static note.
 */

import { readFileSync, writeFileSync } from "node:fs";

const SOURCE = "website/content/diary.md";
const DIARY_PAGE = "website/diary.html";
const INDEX_PAGE = "website/index.html";
const CARD_COUNT = 3;
const BEGIN = "<!-- diary:begin -->";
const END = "<!-- diary:end -->";

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* The supported inline subset, applied after escaping. */
function inline(text) {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

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

function bodyToHtml(lines) {
  const blocks = lines.join("\n").split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  const html = [];
  for (const block of blocks) {
    const rows = block.split("\n").map(r => r.trim());
    if (rows.every(r => r.startsWith("- "))) {
      html.push("<ul>" + rows.map(r => "<li>" + inline(r.slice(2)) + "</li>").join("") + "</ul>");
    } else {
      html.push("<p>" + inline(rows.join(" ")) + "</p>");
    }
  }
  return html.join("\n");
}

function parse(source) {
  /* strip HTML comments (the file may carry a format note at the top) */
  const text = source.replace(/<!--[\s\S]*?-->/g, "");
  const entries = [];
  const parts = text.split(/^## /m).slice(1);
  for (const part of parts) {
    const lines = part.split("\n");
    const header = lines.shift().trim();
    const sep = header.lastIndexOf(" — ");
    if (sep === -1) throw new Error(`entry header needs "{title} — {DD Month YYYY}": "## ${header}"`);
    const title = header.slice(0, sep).trim();
    const dateText = header.slice(sep + 3).trim();
    const date = parseDate(dateText);
    if (!date) throw new Error(`unparseable date "${dateText}" in "## ${header}"`);

    /* tail block: after the LAST "---" line, "**Key:** value" fields */
    let cut = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim() === "---") { cut = i; break; }
    }
    if (cut === -1) throw new Error(`entry "${title}" is missing the --- field block`);
    const fields = {};
    for (const row of lines.slice(cut + 1)) {
      const match = /^\*\*([A-Za-z]+):\*\*\s*(.+)$/.exec(row.trim());
      if (match) fields[match[1].toLowerCase()] = match[2].trim();
    }
    if (!fields.teaser) throw new Error(`entry "${title}" is missing a "**Teaser:** ..." line`);

    entries.push({
      title, dateText, date,
      slug: slugify(title),
      teaser: fields.teaser,
      bodyHtml: bodyToHtml(lines.slice(0, cut)),
    });
  }
  entries.sort((a, b) => b.date - a.date); /* newest first, whatever the file order */
  return entries;
}

function replaceBetween(path, html) {
  const page = readFileSync(path, "utf8");
  const begin = page.indexOf(BEGIN);
  const end = page.indexOf(END);
  if (begin === -1 || end === -1 || end < begin) {
    throw new Error(`${path}: diary markers not found`);
  }
  const inner = html ? "\n" + html + "\n" : "\n";
  writeFileSync(path, page.slice(0, begin + BEGIN.length) + inner + page.slice(end));
}

const entries = parse(readFileSync(SOURCE, "utf8"));

/* /diary — every entry, full text */
const diaryHtml = entries.map(entry => `<article class="entry" id="${entry.slug}">
  <div class="entry-head">
    <h3>${inline(entry.title)}</h3>
    <span class="entry-date">${escapeHtml(entry.dateText)}</span>
  </div>
${entry.bodyHtml}
</article>`).join("\n");

/* home page — the CARD_COUNT most recent as cards; zero entries → no block */
const cards = entries.slice(0, CARD_COUNT).map(entry => `      <a class="card" href="diary.html#${entry.slug}">
        <span class="label">${escapeHtml(entry.dateText)}</span>
        <h3>${inline(entry.title)}</h3>
        <p>${inline(entry.teaser)}</p>
      </a>`).join("\n");
const indexHtml = entries.length ? `    <div class="cards3">\n${cards}\n    </div>` : "";

replaceBetween(DIARY_PAGE, diaryHtml);
replaceBetween(INDEX_PAGE, indexHtml);
console.log(`rendered ${entries.length} entr${entries.length === 1 ? "y" : "ies"} → ${DIARY_PAGE}, ${entries.length ? Math.min(CARD_COUNT, entries.length) + " card(s)" : "no cards"} → ${INDEX_PAGE}`);
