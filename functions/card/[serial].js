/* Cloudflare Pages Function — permanent BYKO card page.
 *
 * GET /card/BK0000001 → the filled card SVG (image/svg+xml).
 * Reads what /api/card wrote to KV (binding CARDS):
 *   serial:{slug} → txHash, card:{txHash} → card JSON.
 * Never touches the chain. The bearer contact is masked on this public page.
 */

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* keep in sync with functions/api/card.js */
function maskEmail(value) {
  var at = String(value).indexOf("@");
  var local = at === -1 ? String(value) : String(value).slice(0, at);
  var domain = at === -1 ? "" : String(value).slice(at + 1);
  var dot = domain.indexOf(".");
  var label = dot === -1 ? domain : domain.slice(0, dot);
  var rest = dot === -1 ? "" : domain.slice(dot);
  if (local.length > 3) local = local.slice(0, 2) + "*".repeat(local.length - 3) + local.slice(-1);
  if (label.length > 2) label = label[0] + "*".repeat(label.length - 2) + label.slice(-1);
  return at === -1 ? local : local + "@" + label + rest;
}

function inscriptionMarkup(text) {
  var escaped;
  var words;
  var lines = [];
  var line = "";
  var i;
  var out = "";
  if (!text) text = "For systems that cannot fail";
  if (text.length <= 70) {
    return { size: 19, markup: escapeXml(text) };
  }
  words = text.split(" ");
  for (i = 0; i < words.length; i++) {
    if (line && (line + " " + words[i]).length > 100) {
      lines.push(line);
      line = words[i];
    } else {
      line = line ? line + " " + words[i] : words[i];
    }
  }
  if (line) lines.push(line);
  for (i = 0; i < lines.length && i < 4; i++) {
    escaped = escapeXml(lines[i]);
    out += '<tspan x="176" dy="' + (i === 0 ? 0 : 18) + '">' + escaped + "</tspan>";
  }
  return { size: 14, markup: out };
}

async function fillTemplate(origin, card) {
  var response = await fetch(origin + "/assets/donation-card.svg");
  var svg;
  var inscription;
  if (!response.ok) throw new Error("template");
  svg = await response.text();
  inscription = inscriptionMarkup(card.inscription);
  svg = svg.replace('font-size="19" fill="rgba(232,234,238,.72)">{{INSCRIPTION}}',
    'font-size="' + inscription.size + '" fill="rgba(232,234,238,.72)">{{INSCRIPTION}}');
  return svg
    .replace(/\{\{SERIAL\}\}/g, escapeXml(card.serial))
    .replace(/\{\{NOMINAL\}\}/g, escapeXml(card.nominal))
    .replace(/\{\{INSCRIPTION\}\}/g, inscription.markup)
    .replace(/\{\{BEARER\}\}/g, escapeXml(card.bearer ? maskEmail(card.bearer) : ""))
    .replace(/\{\{TXHASH\}\}/g, escapeXml(card.txHash))
    .replace(/\{\{DATE\}\}/g, escapeXml(card.date))
    .replace(/\{\{DATE_SHORT\}\}/g, escapeXml(card.date.slice(0, 10)));
}

export async function onRequestGet(context) {
  var slug;
  var txHash;
  var raw;
  var card;
  var svg;
  if (!context.env || !context.env.CARDS) {
    return new Response("Not available", { status: 503 });
  }
  slug = String(context.params.serial || "").replace(/\s+/g, "").toUpperCase();
  if (!/^BK\d{7}$/.test(slug)) return new Response("Not found", { status: 404 });
  try {
    txHash = await context.env.CARDS.get("serial:" + slug);
    if (!txHash) return new Response("Not found", { status: 404 });
    raw = await context.env.CARDS.get("card:" + txHash.toLowerCase());
    if (!raw) return new Response("Not found", { status: 404 });
    card = JSON.parse(raw);
    svg = await fillTemplate(new URL(context.request.url).origin, card);
    return new Response(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=UTF-8",
        "Cache-Control": "public, s-maxage=86400"
      }
    });
  } catch (error) {
    return new Response("Not available", { status: 503 });
  }
}
