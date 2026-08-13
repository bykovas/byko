/* Shared, dependency-free layout for per-entry diary OG cards.
 *
 * SVG does not wrap text, and resvg deliberately does not run a browser layout
 * engine. Measure Inter SemiBold by its actual advance widths, split only on
 * word boundaries, and reduce the font size until the complete title fits.
 * There is intentionally no truncation or ellipsis fallback: an impossible
 * title is a publishing error, not a reason to ship a misleading card.
 */

export const TITLE_MAX_WIDTH = 940;

const FONT_SIZES = [96, 92, 88, 84, 80, 76, 72, 68, 64, 60, 56, 52, 48];

/* Inter-SemiBold.ttf horizontal advances for ASCII U+0020..U+007E,
   normalized to units-per-em. Kerning generally makes the rendered result
   narrower, so summing advances is a conservative fit check. */
const ASCII_ADVANCES = [
  0.251953, 0.321289, 0.522949, 0.643555, 0.650391, 1.004395,
  0.662598, 0.325684, 0.373047, 0.373047, 0.539551, 0.672852,
  0.318848, 0.465332, 0.318848, 0.378906, 0.659668, 0.422852,
  0.623047, 0.636230, 0.666016, 0.612305, 0.639648, 0.576172,
  0.640137, 0.639648, 0.318848, 0.329102, 0.672852, 0.672852,
  0.672852, 0.543457, 0.999023, 0.727539, 0.659180, 0.736816,
  0.722168, 0.605469, 0.587891, 0.749023, 0.745605, 0.276855,
  0.579590, 0.703125, 0.565430, 0.922363, 0.759277, 0.768555,
  0.645020, 0.772949, 0.652344, 0.650391, 0.660156, 0.735840,
  0.727539, 1.020020, 0.719727, 0.713379, 0.652344, 0.373047,
  0.378906, 0.373047, 0.481445, 0.469238, 0.351074, 0.574219,
  0.624023, 0.582520, 0.624023, 0.591309, 0.388672, 0.625488,
  0.612305, 0.261719, 0.261719, 0.569336, 0.261719, 0.900391,
  0.611816, 0.608887, 0.624023, 0.624023, 0.396973, 0.549316,
  0.353027, 0.612305, 0.586914, 0.839355, 0.568848, 0.588379,
  0.565918, 0.454590, 0.358887, 0.454590, 0.672852,
];

const EXTRA_ADVANCES = new Map([
  ["–", 0.5], ["—", 1], ["‘", 0.293945], ["’", 0.293945],
  ["“", 0.506836], ["”", 0.501465], ["…", 0.956055],
  ["€", 0.678711], ["£", 0.629395],
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
function balancedPartition(words, lineCount, fontSize) {
  let best = null;

  function visit(start, remaining, lines, widths) {
    if (remaining === 1) {
      const line = words.slice(start).join(" ");
      const width = measureTitleLine(line, fontSize);
      if (!line || width > TITLE_MAX_WIDTH) return;
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
      if (width > TITLE_MAX_WIDTH) break;
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

  for (const fontSize of fontSizes) {
    const limit = Math.min(lineLimitForSize(fontSize), words.length);
    for (let lineCount = 1; lineCount <= limit; lineCount++) {
      const partition = balancedPartition(words, lineCount, fontSize);
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

  throw new Error(`diary OG title cannot fit without truncation: "${normalized}"`);
}

export function escapeXml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function renderDiaryOgSvg(entry) {
  const layout = layoutTitle(entry.title);
  const titleLines = layout.lines.map((line, index) =>
    `<tspan x="152" y="${layout.firstBaseline + index * layout.lineHeight}">${escapeXml(line)}</tspan>`
  ).join("");
  const date = escapeXml(String(entry.dateText || "").toUpperCase());
  const path = escapeXml(`byko.bykovas.lt/d/${entry.slug}`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs><linearGradient id="g" x1="0" y1="0" x2="96" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7CCBFF"/><stop offset="1" stop-color="#FFB088"/></linearGradient></defs>
<rect x="0.5" y="0.5" width="1199" height="629" fill="#0B0D10" stroke="rgba(255,255,255,.14)"/>
<line x1="56.5" y1="0" x2="56.5" y2="630" stroke="rgba(255,255,255,.14)"/>
<line x1="108.5" y1="0" x2="108.5" y2="630" stroke="rgba(255,255,255,.14)"/>
<text transform="translate(78,6) rotate(90)" font-family="JetBrains Mono" font-size="7" letter-spacing="1.5" fill="rgba(232,234,238,.45)">BYKO · DIARY · BASE · 8453 · BYKO · DIARY · BASE · 8453 · BYKO · DIARY · BASE · 8453 · BYKO · DIARY · BASE · 8453 · BYKO · DIARY · BASE · 8453 ·</text>
<text transform="translate(92,6) rotate(90)" font-family="JetBrains Mono" font-size="7" letter-spacing="1.5" fill="rgba(232,234,238,.3)">8453 · BYKO · ENTRY · 790227 · 8453 · BYKO · ENTRY · 790227 · 8453 · BYKO · ENTRY · 790227 · 8453 · BYKO · ENTRY · 790227 ·</text>
<g transform="translate(152,58) scale(0.5)" fill="none" stroke="url(#g)" stroke-width="13" stroke-linecap="butt" stroke-linejoin="miter"><path d="M24 14 V82"/><path d="M40 20 L70 48 L40 76"/></g>
<text x="216" y="93" font-family="Inter" font-weight="600" font-size="30" letter-spacing="-0.6" fill="#E8EAEE">BYKO</text>
<text x="1144" y="88" font-family="Inter" font-weight="600" font-size="11" letter-spacing="2.6" fill="rgba(232,234,238,.35)" text-anchor="end">DIARY / ENTRY</text>
<line x1="152" y1="143.5" x2="1144" y2="143.5" stroke="rgba(255,255,255,.08)"/>
<text x="152" y="191" font-family="JetBrains Mono" font-size="12" letter-spacing="1.7" fill="#7CCBFF">EPISODE / ${date}</text>
<text font-family="Inter" font-weight="600" font-size="${layout.fontSize}" letter-spacing="-1.4" fill="#E8EAEE">${titleLines}</text>
<line x1="152" y1="535.5" x2="1144" y2="535.5" stroke="rgba(255,255,255,.08)"/>
<text x="152" y="585" font-family="JetBrains Mono" font-size="12" fill="rgba(232,234,238,.45)">${path}</text>
<text x="1144" y="585" font-family="JetBrains Mono" font-size="12" fill="rgba(232,234,238,.45)" text-anchor="end">1 BYKO = 1 BYKO</text>
</svg>`;
}
