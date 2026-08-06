/* Cloudflare Pages Function — BYKO donation card.
 *
 * POST /api/card { txHash, email, inscription? }
 *   1. if a card already exists for this tx in KV, return it (idempotent)
 *   2. verify the tx on Base: receipt exists, status ok
 *   3. confirm it carries a BYKO ERC-20 Transfer TO the donation address
 *   4. read the donated amount and the block timestamp
 *   5. issue a serial from KV, fill the SVG template, email the permanent link
 *   Response: { ok, serial, url, svg } or { error }
 *
 * Config:
 *   DONATION_ADDRESS — dedicated donation wallet (a fresh address that holds
 *     nothing else, so every inbound BYKO transfer is unambiguously a donation).
 *     Empty string disables the endpoint with {"error":"config"}.
 *   KV binding CARDS — create a KV namespace, bind as CARDS in the Pages
 *     project (Settings → Bindings), then redeploy.
 *   Secrets MAILJET_API_KEY / MAILJET_SECRET_KEY, vars CARD_FROM_EMAIL /
 *     CARD_NOTIFY_TO — as before.
 *
 * Local testing: npx wrangler pages dev website --kv CARDS
 */

var DONATION_ADDRESS = "0x42873C60bC22424dBB4518DF7bE8b7F9eF4ac1D6";
/* Donations count from here; earlier transfers to the address cannot mint. */
var DONATION_START_BLOCK = 49614625;

var BYKO = "0x078bB16e24c8931fc007928c370422e5e38F4372";
var TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
/* Public keyless RPCs; each rate-limits Cloudflare egress IPs, so rotate. */
var RPC_URLS = [
  "https://mainnet.base.org",
  "https://base.drpc.org",
  "https://base.meowrpc.com"
];
var RATE_LIMIT = 5;
var RATE_WINDOW_SECONDS = 3600;
var INSCRIPTION_MAX = 300;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: { "Content-Type": "application/json; charset=UTF-8" }
  });
}

function clientIp(request) {
  var forwarded = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
  return forwarded.split(",")[0].trim();
}

async function underRateLimit(request) {
  var ip = clientIp(request);
  var cacheKey = new Request("https://byko-rate-limit.invalid/card/" + encodeURIComponent(ip));
  var cache = caches.default;
  var cached = await cache.match(cacheKey);
  var count = 0;
  var response;
  if (cached) {
    try {
      count = Number((await cached.json()).count) || 0;
    } catch (error) {
      count = 0;
    }
  }
  if (count >= RATE_LIMIT) return false;
  response = json({ count: count + 1 }, 200);
  response.headers.set("Cache-Control", "public, max-age=" + RATE_WINDOW_SECONDS);
  await cache.put(cacheKey, response);
  return true;
}

function validEmail(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validTxHash(value) {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
}

/* strip control characters; the raw value is stored, escaping happens at render */
function cleanInscription(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, INSCRIPTION_MAX);
}

async function rpc(method, params) {
  var i;
  var response;
  var payload;
  for (i = 0; i < RPC_URLS.length; i++) {
    try {
      response = await fetch(RPC_URLS[i], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: method, params: params })
      });
      if (!response.ok) continue;
      payload = await response.json();
      if (!payload || payload.error) continue;
      return payload.result; /* may legitimately be null (unknown tx) */
    } catch (error) { /* try next endpoint */ }
  }
  throw new Error("rpc");
}

function pad40(address) {
  return address.slice(2).toLowerCase().padStart(64, "0");
}

/* Verify the donation and return { amountWei, timestamp } */
async function verifyDonation(txHash) {
  var receipt = await rpc("eth_getTransactionReceipt", [txHash]);
  var i;
  var log;
  var amount = null;
  var block;
  if (!receipt) return { error: "tx_not_found" };
  if (receipt.status !== "0x1") return { error: "tx_failed" };
  for (i = 0; i < (receipt.logs || []).length; i++) {
    log = receipt.logs[i];
    if (!log.address || log.address.toLowerCase() !== BYKO.toLowerCase()) continue;
    if (!log.topics || log.topics.length < 3 || log.topics[0] !== TRANSFER_TOPIC) continue;
    if (log.topics[2].slice(-64) !== pad40(DONATION_ADDRESS)) continue;
    amount = BigInt(log.data);
    break;
  }
  if (amount === null) return { error: "no_byko_donation" };
  if (amount <= 0n) return { error: "no_byko_donation" };
  if (parseInt(receipt.blockNumber, 16) < DONATION_START_BLOCK) return { error: "no_byko_donation" };
  block = await rpc("eth_getBlockByNumber", [receipt.blockNumber, false]);
  if (!block || !block.timestamp) throw new Error("rpc");
  return { amountWei: amount, timestamp: parseInt(block.timestamp, 16) };
}

function formatNominal(amountWei) {
  var whole = amountWei / 1000000000000000000n;
  var frac = amountWei % 1000000000000000000n;
  var text = whole.toLocaleString("en-US");
  var fracText;
  if (frac > 0n) {
    fracText = frac.toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
    if (fracText) text += "." + fracText;
  }
  return text;
}

function formatDate(timestamp) {
  var iso = new Date(timestamp * 1000).toISOString();
  return iso.slice(0, 10) + " " + iso.slice(11, 19) + " UTC";
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* bearer masking for the public card page — keep in sync with card/[serial].js */
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

/* Wrap the inscription into tspans that fit the 176..1040 column.
   One line at 19px for short texts, 14px multi-line for long ones. */
function inscriptionMarkup(text) {
  var escaped;
  var words;
  var lines = [];
  var line = "";
  var i;
  var out = "";
  var perLine;
  var size;
  if (!text) text = "Nothing promised. Everything recorded.";
  if (text.length <= 70) {
    return { size: 19, markup: escapeXml(text) };
  }
  size = 14;
  perLine = 100;
  words = text.split(" ");
  for (i = 0; i < words.length; i++) {
    if (line && (line + " " + words[i]).length > perLine) {
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
  return { size: size, markup: out };
}

async function fillTemplate(origin, card, publicView) {
  var response = await fetch(origin + "/assets/donation-card.svg");
  var svg;
  var inscription;
  var bearer;
  if (!response.ok) throw new Error("template");
  svg = await response.text();
  inscription = inscriptionMarkup(card.inscription);
  bearer = publicView ? maskEmail(card.bearer) : card.bearer;
  svg = svg.replace('font-size="19" fill="rgba(232,234,238,.72)">{{INSCRIPTION}}',
    'font-size="' + inscription.size + '" fill="rgba(232,234,238,.72)">{{INSCRIPTION}}');
  return svg
    .replace(/\{\{SERIAL\}\}/g, escapeXml(card.serial))
    .replace(/\{\{NOMINAL\}\}/g, escapeXml(card.nominal))
    .replace(/\{\{INSCRIPTION\}\}/g, inscription.markup)
    .replace(/\{\{BEARER\}\}/g, escapeXml(bearer))
    .replace(/\{\{TXHASH\}\}/g, escapeXml(card.txHash))
    .replace(/\{\{DATE\}\}/g, escapeXml(card.date))
    .replace(/\{\{DATE_SHORT\}\}/g, escapeXml(card.date.slice(0, 10)));
}

function slugFor(serial) {
  return String(serial).replace(/\s+/g, "").toUpperCase();
}

async function issueSerial(kv, txHash) {
  var counter = Number(await kv.get("serial-counter")) || 0;
  var next = counter + 1;
  await kv.put("serial-counter", String(next));
  return "BK " + String(next).padStart(7, "0");
}

async function sendMail(env, card, url, ip) {
  var from = env.CARD_FROM_EMAIL || "byko@bykovas.lt";
  var notifyTo = env.CARD_NOTIFY_TO || "byko@bykovas.lt";
  var response;
  var payload;
  var i;
  if (!env.MAILJET_API_KEY || !env.MAILJET_SECRET_KEY) return false;
  try {
    response = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(env.MAILJET_API_KEY + ":" + env.MAILJET_SECRET_KEY),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        Messages: [
          {
            From: { Email: from },
            To: [{ Email: card.bearer }],
            Subject: "BYKO / card " + card.serial,
            TextPart: "Your donation card.\n\n" +
              "Serial: " + card.serial + "\n" +
              "Nominal: " + card.nominal + " BYKO\n" +
              "Tx: " + card.txHash + "\n" +
              "Permanent link: " + url + "\n\n" +
              "1 BYKO = 1 BYKO"
          },
          {
            From: { Email: from },
            To: [{ Email: notifyTo }],
            Subject: "BYKO / card issued " + card.serial,
            TextPart: "card: " + card.serial + " · " + card.nominal + " BYKO · " +
              card.bearer + " · " + card.txHash + " · " + ip
          }
        ]
      })
    });
  } catch (error) {
    return false;
  }
  if (!response.ok) return false;
  try {
    payload = await response.json();
  } catch (error) {
    return false;
  }
  if (!payload || !Array.isArray(payload.Messages)) return false;
  for (i = 0; i < payload.Messages.length; i++) {
    if (payload.Messages[i].Status !== "success") return false;
  }
  return true;
}

export async function onRequestPost(context) {
  var env = context.env;
  var origin = new URL(context.request.url).origin;
  var input;
  var txHash;
  var email;
  var inscription;
  var existing;
  var verification;
  var card;
  var url;
  var svg;
  var mailed;

  if (!DONATION_ADDRESS) return json({ error: "config" }, 503);
  if (!env || !env.CARDS) return json({ error: "config" }, 503);

  try {
    input = await context.request.json();
  } catch (error) {
    return json({ error: "input" }, 400);
  }
  txHash = input && typeof input.txHash === "string" ? input.txHash.trim().toLowerCase() : "";
  email = input && typeof input.email === "string" ? input.email.trim() : "";
  inscription = cleanInscription(input && input.inscription);
  if (!validTxHash(txHash)) return json({ error: "tx" }, 400);
  if (!validEmail(email)) return json({ error: "email" }, 400);
  if (!await underRateLimit(context.request)) return json({ error: "rate" }, 429);

  try {
    existing = await env.CARDS.get("card:" + txHash);
    if (existing) {
      card = JSON.parse(existing);
      url = origin + "/card/" + slugFor(card.serial);
      svg = await fillTemplate(origin, card, false);
      return json({ ok: true, serial: card.serial, url: url, svg: svg }, 200);
    }

    verification = await verifyDonation(txHash);
    if (verification.error) return json({ error: verification.error }, 422);

    card = {
      serial: await issueSerial(env.CARDS, txHash),
      nominal: formatNominal(verification.amountWei),
      date: formatDate(verification.timestamp),
      txHash: txHash,
      inscription: inscription,
      bearer: email
    };
    await env.CARDS.put("card:" + txHash, JSON.stringify(card));
    await env.CARDS.put("serial:" + slugFor(card.serial), txHash);

    url = origin + "/card/" + slugFor(card.serial);
    svg = await fillTemplate(origin, card, false);
    mailed = await sendMail(env, card, url, clientIp(context.request));
    return json({ ok: true, serial: card.serial, url: url, svg: svg, mailed: mailed }, 200);
  } catch (error) {
    return json({ error: "rpc" }, 503);
  }
}
