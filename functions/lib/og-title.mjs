/* Shared, dependency-free layout for per-entry diary OG cards.
 *
 * SVG does not wrap text, and resvg deliberately does not run a browser layout
 * engine. Measure Archivo Bold by its actual advance widths, split only on
 * word boundaries, and reduce the font size until the complete title fits.
 * There is intentionally no truncation or ellipsis fallback: an impossible
 * title is a publishing error, not a reason to ship a misleading card.
 */

export const TITLE_MAX_WIDTH = 1000;

/* When a hero image takes the right of the card, the title keeps the left
   column. Narrower band, so it may wrap to more lines and go smaller. */
export const HERO_TITLE_MAX_WIDTH = 572;

const FONT_SIZES = [96, 92, 88, 84, 80, 76, 72, 68, 64, 60, 56, 52, 48];
const HERO_FONT_SIZES = [84, 80, 76, 72, 68, 64, 60, 56, 52, 48, 44];

function heroMaximumLines(fontSize) {
  if (fontSize >= 72) return 3;
  if (fontSize >= 56) return 4;
  return 5;
}

/* One source of truth for how a title is laid out, shared by the build-time
   fit check and the card renderer so they can never disagree. */
export function titleOptionsForEntry(entry) {
  return entry && entry.hero
    ? { maxWidth: HERO_TITLE_MAX_WIDTH, fontSizes: HERO_FONT_SIZES, maximumLines: heroMaximumLines }
    : {};
}

/* Archivo-Bold.ttf horizontal advances for ASCII U+0020..U+007E,
   normalized to units-per-em. Kerning generally makes the rendered result
   narrower, so summing advances is a conservative fit check. */
const ASCII_ADVANCES = [
  0.196000, 0.301000, 0.456000, 0.600000, 0.556000, 0.973000,
  0.764000, 0.253000, 0.364000, 0.364000, 0.407000, 0.641000,
  0.307000, 0.333000, 0.307000, 0.300000, 0.595000, 0.596000,
  0.596000, 0.596000, 0.597000, 0.595000, 0.596000, 0.596000,
  0.596000, 0.595000, 0.335000, 0.335000, 0.641000, 0.641000,
  0.641000, 0.613000, 1.001000, 0.724000, 0.722000, 0.733000,
  0.739000, 0.683000, 0.622000, 0.802000, 0.754000, 0.301000,
  0.603000, 0.725000, 0.591000, 0.872000, 0.754000, 0.793000,
  0.681000, 0.793000, 0.730000, 0.679000, 0.641000, 0.748000,
  0.694000, 0.964000, 0.706000, 0.699000, 0.653000, 0.350000,
  0.300000, 0.350000, 0.641000, 0.518000, 0.228000, 0.580000,
  0.608000, 0.573000, 0.608000, 0.584000, 0.325000, 0.607000,
  0.602000, 0.267000, 0.264000, 0.570000, 0.267000, 0.891000,
  0.602000, 0.613000, 0.608000, 0.608000, 0.380000, 0.556000,
  0.342000, 0.601000, 0.547000, 0.798000, 0.572000, 0.547000,
  0.519000, 0.393000, 0.253000, 0.393000, 0.641000,
];

const EXTRA_ADVANCES = new Map([
  ["–", 0.5], ["—", 1], ["‘", 0.28], ["’", 0.28],
  ["“", 0.488], ["”", 0.488], ["…", 0.973],
  ["€", 0.599], ["£", 0.599],
]);

function glyphAdvance(character) {
  const code = character.codePointAt(0);
  if (code >= 32 && code <= 126) return ASCII_ADVANCES[code - 32];
  return EXTRA_ADVANCES.get(character) || 0.68;
}

export function measureTitleLine(line, fontSize) {
  let em = 0;
  for (const character of line) em += glyphAdvance(character);
  return em * fontSize;
}

function maximumLines(fontSize) {
  if (fontSize >= 72) return 2;
  if (fontSize >= 60) return 3;
  return 4;
}

/* For an exact line count, find the most balanced valid word partition. */
function balancedPartition(words, lineCount, fontSize, maxWidth) {
  let best = null;

  function visit(start, remaining, lines, widths) {
    if (remaining === 1) {
      const line = words.slice(start).join(" ");
      const width = measureTitleLine(line, fontSize);
      if (!line || width > maxWidth) return;
      const candidateLines = lines.concat(line);
      const candidateWidths = widths.concat(width);
      const widest = Math.max(...candidateWidths);
      const narrowest = Math.min(...candidateWidths);
      const lastIsOrphan = words.length > lineCount && line.indexOf(" ") === -1;
      const score = widest + (widest - narrowest) * 0.15 + (lastIsOrphan ? 80 : 0);
      if (!best || score < best.score) {
        best = { lines: candidateLines, widths: candidateWidths, score };
      }
      return;
    }

    /* Leave at least one word for every remaining line. */
    const finalEnd = words.length - remaining + 1;
    for (let end = start + 1; end <= finalEnd; end++) {
      const line = words.slice(start, end).join(" ");
      const width = measureTitleLine(line, fontSize);
      if (width > maxWidth) break;
      visit(end, remaining - 1, lines.concat(line), widths.concat(width));
    }
  }

  visit(0, lineCount, [], []);
  return best;
}

export function layoutTitle(title, options = {}) {
  const normalized = String(title || "").normalize("NFC").replace(/\s+/g, " ").trim();
  if (!normalized) throw new Error("diary OG title is empty");
  const words = normalized.split(" ");
  const fontSizes = options.fontSizes || FONT_SIZES;
  const lineLimitForSize = options.maximumLines || maximumLines;
  const maxWidth = options.maxWidth || TITLE_MAX_WIDTH;

  for (const fontSize of fontSizes) {
    const limit = Math.min(lineLimitForSize(fontSize), words.length);
    for (let lineCount = 1; lineCount <= limit; lineCount++) {
      const partition = balancedPartition(words, lineCount, fontSize, maxWidth);
      if (!partition) continue;
      const lineHeight = Math.round(fontSize * 1.08);
      const titleTop = 220;
      const titleBottom = 500;
      const blockHeight = fontSize + (lineCount - 1) * lineHeight;
      if (blockHeight > titleBottom - titleTop) continue;
      const firstBaseline = Math.round(
        titleTop + (titleBottom - titleTop - blockHeight) / 2 + fontSize * 0.82
      );
      return {
        title: normalized,
        lines: partition.lines,
        widths: partition.widths,
        fontSize,
        lineHeight,
        firstBaseline,
      };
    }
  }

  throw new Error(`diary OG title cannot fit without truncation: "${normalized}"`
    + (maxWidth < TITLE_MAX_WIDTH
      ? " (a hero image narrows the title column — shorten the title or drop the image)" : ""));
}

export function escapeXml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/* A hero image sits in a fixed 3:2 landscape panel on the right — the same
   aspect the diary list thumbnails and the entry-page lead use, so ONE source
   image shows the identical framing everywhere instead of being cropped one way
   here and another way in the list. The source is cover-fitted (scaled to fill,
   centred, clipped); a 3:2 source fills it with no crop at all, and the blue
   rule stops short of it. */
const HERO_PANEL = { x: 684, y: 212, w: 444, h: 296 };

function heroPanelSvg(hero) {
  if (!hero || !hero.dataUri || !hero.width || !hero.height) return "";
  const { x, y, w, h } = HERO_PANEL;
  const scale = Math.max(w / hero.width, h / hero.height);
  const dw = hero.width * scale;
  const dh = hero.height * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  return `<clipPath id="og-hero"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>`
    + `<image href="${hero.dataUri}" x="${dx.toFixed(2)}" y="${dy.toFixed(2)}"`
    + ` width="${dw.toFixed(2)}" height="${dh.toFixed(2)}"`
    + ` clip-path="url(#og-hero)" preserveAspectRatio="none"/>`
    + `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#0D1116" stroke-width="1.5"/>`;
}

export function renderDiaryOgSvg(entry) {
  const layout = layoutTitle(entry.title, titleOptionsForEntry(entry));
  const titleLines = layout.lines.map((line, index) =>
    `<tspan x="72" y="${layout.firstBaseline + index * layout.lineHeight}">${escapeXml(line)}</tspan>`
  ).join("");
  const date = escapeXml(String(entry.dateText || "").toUpperCase());
  const path = escapeXml(`byko.bykovas.lt/d/${entry.slug}`);
  const hasHero = !!(entry.hero && entry.hero.dataUri);
  const ruleX2 = hasHero ? 644 : 1128;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#FAF9F5"/>
<rect x="0" y="0" width="1200" height="66" fill="#FAF9F5"/>
<line x1="0" y1="65.25" x2="1200" y2="65.25" stroke="#0D1116" stroke-width="1.5"/>
<circle cx="88" cy="33" r="17" fill="#7CCBFF"/>
<g transform="translate(77,22) scale(0.229)" fill="none" stroke="#0D1116" stroke-width="15" stroke-linecap="butt" stroke-linejoin="miter"><path d="M24 14 V82"/><path d="M40 20 L70 48 L40 76"/></g>
<text x="118" y="41" font-family="Archivo" font-weight="700" font-size="25" letter-spacing="-1" fill="#0D1116">BYKO</text>
<text x="1140" y="40" font-family="Archivo" font-weight="600" font-size="11" letter-spacing="1.8" fill="#5A6068" text-anchor="end">DIARY · EPISODE</text>
<line x1="72" y1="150" x2="${ruleX2}" y2="150" stroke="#7CCBFF" stroke-width="3"/>
<text x="72" y="196" font-family="Archivo" font-weight="600" font-size="12" letter-spacing="1.9" fill="#0A5C8F">EPISODE · ${date}</text>
<text font-family="Archivo" font-weight="700" font-size="${layout.fontSize}" letter-spacing="-1.4" fill="#0D1116">${titleLines}</text>
<line x1="72" y1="536" x2="1128" y2="536" stroke="#DCD8CD"/>
<text x="72" y="580" font-family="IBM Plex Mono" font-size="13" fill="#5A6068">${path}</text>
<text x="1128" y="580" font-family="IBM Plex Mono" font-size="13" fill="#5A6068" text-anchor="end">1 BYKO = 1 BYKO</text>
${heroPanelSvg(entry.hero)}</svg>`;
}
