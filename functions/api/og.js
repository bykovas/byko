/* Cloudflare Pages Function — live og:image.
 *
 * GET /api/og → PNG 1200×630 rendered from assets/og-live.svg with the
 * current price, holders count and block filled in. Rasterization happens
 * right here via resvg-wasm (vendored in functions/lib, MPL-2.0); fonts are
 * served from the site's own assets. Fully self-contained — no third-party
 * image services.
 *
 * Data failures degrade to "—" placeholders; template/render failures fall
 * back to the static assets/social-1200x630.png. Cached for 10 minutes.
 */

import { initWasm, Resvg } from "../lib/resvg.js";
import wasmModule from "../lib/resvg.wasm";

var BYKO = "0x078bB16e24c8931fc007928c370422e5e38F4372";
var USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
var POOL = "0x02dd4285ad38ea93d021ca854016a839b0b2a6ca";
var RPC_URLS = [
  "https://mainnet.base.org",
  "https://base.drpc.org"
];
var FONT_PATHS = [
  "/assets/fonts/Inter-SemiBold.ttf",
  "/assets/fonts/Inter-ExtraLight.ttf",
  "/assets/fonts/JetBrainsMono-Regular.ttf"
];

var wasmReady = null;
var fontCache = null;

function keyedRpcUrls(env) {
  var urls = [];
  if (env && env.RPC_URL) urls.push(env.RPC_URL);
  if (env && env.DRPC_API_KEY) {
    urls.push(env.DRPC_API_KEY.indexOf("http") === 0
      ? env.DRPC_API_KEY
      : "https://lb.drpc.live/base/" + env.DRPC_API_KEY);
  }
  return urls;
}

function balanceOfData(address) {
  return "0x70a08231" + address.slice(2).toLowerCase().padStart(64, "0");
}

/* One batched call: pool reserves + block number. Returns null on failure. */
async function fetchMarket(env) {
  var urls = keyedRpcUrls(env).concat(RPC_URLS);
  var i;
  var response;
  var items;
  var values;
  var j;
  for (i = 0; i < urls.length; i++) {
    try {
      response = await fetch(urls[i], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          { jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: BYKO, data: balanceOfData(POOL) }, "latest"] },
          { jsonrpc: "2.0", id: 2, method: "eth_call", params: [{ to: USDC, data: balanceOfData(POOL) }, "latest"] },
          { jsonrpc: "2.0", id: 3, method: "eth_blockNumber", params: [] }
        ])
      });
      if (!response.ok) continue;
      items = await response.json();
      if (!Array.isArray(items)) continue;
      values = {};
      for (j = 0; j < items.length; j++) {
        if (items[j].error || !items[j].result || items[j].result === "0x") { values = null; break; }
        values[items[j].id] = items[j].result;
      }
      if (!values || !values[1] || !values[2] || !values[3]) continue;
      return {
        byko: Number(BigInt(values[1])) / 1e18,
        usdc: Number(BigInt(values[2])) / 1e6,
        block: parseInt(values[3], 16)
      };
    } catch (error) { /* try next endpoint */ }
  }
  return null;
}

async function fetchHolders(origin) {
  try {
    var response = await fetch(origin + "/api/holders");
    if (!response.ok) return null;
    var data = await response.json();
    return typeof data.holders === "number" ? data.holders : null;
  } catch (error) {
    return null;
  }
}

async function loadFonts(origin) {
  var buffers = [];
  var i;
  var response;
  if (fontCache) return fontCache;
  for (i = 0; i < FONT_PATHS.length; i++) {
    response = await fetch(origin + FONT_PATHS[i]);
    if (!response.ok) throw new Error("font");
    buffers.push(new Uint8Array(await response.arrayBuffer()));
  }
  fontCache = buffers;
  return buffers;
}

function fillTemplate(svg, data) {
  return svg
    .replace("{{PRICE}}", data.price)
    .replace("{{PRICE_SUB}}", data.priceSub)
    .replace("{{HOLDERS}}", data.holders)
    .replace("{{BLOCK}}", data.block)
    .replace("{{DATE}}", data.date);
}

async function staticFallback(origin) {
  var response = await fetch(origin + "/assets/social-1200x630.png");
  return new Response(response.body, {
    status: 200,
    headers: { "Content-Type": "image/png", "Cache-Control": "public, s-maxage=600" }
  });
}

export async function onRequestGet(context) {
  var origin = new URL(context.request.url).origin;
  var cache = caches.default;
  var cached = await cache.match(context.request);
  var market;
  var holders;
  var price;
  var now;
  var svg;
  var fonts;
  var resvg;
  var png;
  var response;
  if (cached) return cached;
  try {
    market = await fetchMarket(context.env);
    holders = await fetchHolders(origin);
    price = market && market.byko > 0 ? market.usdc / market.byko : null;
    now = new Date().toISOString();
    svg = await (await fetch(origin + "/assets/og-live.svg")).text();
    svg = fillTemplate(svg, {
      price: price ? (price * 100).toFixed(4) : "—",
      priceSub: price ? price.toFixed(6) : "—",
      holders: holders !== null ? holders.toLocaleString("en-US") : "—",
      block: market ? market.block.toLocaleString("en-US") : "—",
      date: now.slice(0, 10) + " " + now.slice(11, 16)
    });

    if (!wasmReady) wasmReady = initWasm(wasmModule);
    await wasmReady;
    fonts = await loadFonts(origin);
    resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 1200 },
      font: {
        loadSystemFonts: false,
        fontBuffers: fonts,
        defaultFontFamily: "Inter"
      }
    });
    png = resvg.render().asPng();
    response = new Response(png, {
      status: 200,
      headers: { "Content-Type": "image/png", "Cache-Control": "public, s-maxage=600" }
    });
    context.waitUntil(cache.put(context.request, response.clone()));
    return response;
  } catch (error) {
    return staticFallback(origin);
  }
}
