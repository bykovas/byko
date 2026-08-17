/* Cloudflare Pages Function — live og:image.
 *
 * GET /api/og → PNG 1200×630 rendered from assets/og-live.svg with the
 * current price, holders count and block filled in.
 * GET /api/og?slug={diary-slug}&v={content-hash} → a per-entry card whose
 * complete title is laid out from website/data/diary-og.json. That branch is
 * deliberately independent of RPC/holder data so social crawlers get a fast,
 * deterministic image. `v` is a cache-busting hash of its title/date and the
 * card renderer/fonts; entry lookup is always by slug.
 *
 * HEAD returns the same representation status/type without invoking slow
 * market RPCs or rasterization. GET rasterization happens here via resvg-wasm
 * (vendored in functions/lib, MPL-2.0); fonts are served from the site's own
 * assets. Fully self-contained — no third-party image services.
 *
 * On the live market card, data failures degrade to "—" placeholders and
 * template/render failures fall back to assets/social-1200x630.png. A diary
 * card fails closed instead of returning the wrong entry image.
 */

import { initWasm, Resvg } from "../lib/resvg.js";
import wasmModule from "../lib/resvg.wasm";
import { renderDiaryOgSvg } from "../lib/og-title.mjs";

var BYKO = "0x078bB16e24c8931fc007928c370422e5e38F4372";
var USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
var POOL = "0x02dd4285ad38ea93d021ca854016a839b0b2a6ca";
var RPC_URLS = [
  "https://mainnet.base.org",
  "https://base.drpc.org"
];
var FONT_PATHS = [
  "/assets/fonts/Archivo-Bold.ttf",
  "/assets/fonts/Archivo-SemiBold.ttf",
  "/assets/fonts/Archivo-Regular.ttf",
  "/assets/fonts/IBMPlexMono-Regular.ttf",
  "/assets/fonts/IBMPlexMono-SemiBold.ttf"
];
var DIARY_MANIFEST_PATH = "/data/diary-og.json";
var ENTRY_CACHE_CONTROL = "public, max-age=86400, s-maxage=31536000, immutable";
var LIVE_CACHE_CONTROL = "public, max-age=600, s-maxage=600";
var LIVE_DATA_TIMEOUT_MS = 1800;

var wasmReady = null;
var fontPromise = null;

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
async function fetchMarket(env, signal) {
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
        signal: signal,
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

async function fetchHolders(origin, signal) {
  try {
    var response = await fetch(origin + "/api/holders", { signal: signal });
    if (!response.ok) return null;
    var data = await response.json();
    return typeof data.holders === "number" ? data.holders : null;
  } catch (error) {
    return null;
  }
}

async function loadFonts(origin) {
  if (!fontPromise) {
    fontPromise = Promise.all(FONT_PATHS.map(async function (path) {
      var response = await fetch(origin + path);
      if (!response.ok) throw new Error("font " + path + " → " + response.status);
      return new Uint8Array(await response.arrayBuffer());
    })).catch(function (error) {
      fontPromise = null;
      throw error;
    });
  }
  return fontPromise;
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
    headers: { "Content-Type": "image/png", "Cache-Control": LIVE_CACHE_CONTROL }
  });
}

async function renderPng(svg, fonts) {
  var resvg;
  if (!wasmReady) wasmReady = initWasm(wasmModule);
  await wasmReady;
  resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
    font: {
      loadSystemFonts: false,
      fontBuffers: fonts,
      defaultFontFamily: "Archivo"
    }
  });
  return resvg.render().asPng();
}

function pngResponse(png, cacheControl) {
  return new Response(png, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(png.byteLength),
      "Cache-Control": cacheControl
    }
  });
}

function errorResponse(status, message) {
  return new Response(message + "\n", {
    status: status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": status === 404 ? "public, max-age=60" : "no-store"
    }
  });
}

function withoutBody(response) {
  return new Response(null, { status: response.status, headers: response.headers });
}

async function fetchDiaryEntry(origin, slug) {
  var response = await fetch(origin + DIARY_MANIFEST_PATH);
  var manifest;
  var i;
  if (!response.ok) throw new Error("diary OG manifest → " + response.status);
  manifest = await response.json();
  if (!manifest || !Array.isArray(manifest.entries)) {
    throw new Error("diary OG manifest has no entries array");
  }
  for (i = 0; i < manifest.entries.length; i++) {
    if (manifest.entries[i].slug === slug) return manifest.entries[i];
  }
  return null;
}

function diaryCacheRequest(origin, entry) {
  return new Request(origin + "/api/og?slug=" + encodeURIComponent(entry.slug) +
    "&v=" + encodeURIComponent(entry.imageVersion), { method: "GET" });
}

function liveCacheRequest(origin) {
  return new Request(origin + "/api/og", { method: "GET" });
}

async function serveDiaryCard(context, origin, slug) {
  var cache = caches.default;
  var cacheRequest;
  var cached;
  var entry;
  var fonts;
  var png;
  var response;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return errorResponse(404, "unknown diary entry");
  }
  try {
    entry = await fetchDiaryEntry(origin, slug);
    if (!entry) return errorResponse(404, "unknown diary entry");
    cacheRequest = diaryCacheRequest(origin, entry);
    cached = await cache.match(cacheRequest);
    if (cached) return cached;
    fonts = await loadFonts(origin);
    png = await renderPng(renderDiaryOgSvg(entry), fonts);
    response = pngResponse(png, ENTRY_CACHE_CONTROL);
    context.waitUntil(cache.put(cacheRequest, response.clone()));
    return response;
  } catch (error) {
    return errorResponse(500, "diary OG render failed: " + error.message);
  }
}

async function serveLiveCard(context, origin) {
  var cache = caches.default;
  var cacheRequest = liveCacheRequest(origin);
  var cached = await cache.match(cacheRequest);
  var market;
  var holders;
  var price;
  var now;
  var svg;
  var svgResponse;
  var fonts;
  var png;
  var response;
  var controller;
  var timeoutId;
  if (cached) return cached;
  try {
    controller = new AbortController();
    timeoutId = setTimeout(function () { controller.abort(); }, LIVE_DATA_TIMEOUT_MS);
    [market, holders, svgResponse, fonts] = await Promise.all([
      fetchMarket(context.env, controller.signal),
      fetchHolders(origin, controller.signal),
      fetch(origin + "/assets/og-live.svg"),
      loadFonts(origin)
    ]);
    clearTimeout(timeoutId);
    if (!svgResponse.ok) throw new Error("live OG template → " + svgResponse.status);
    price = market && market.byko > 0 ? market.usdc / market.byko : null;
    now = new Date().toISOString();
    svg = await svgResponse.text();
    svg = fillTemplate(svg, {
      price: price ? (price * 100).toFixed(4) : "—",
      priceSub: price ? price.toFixed(6) : "—",
      holders: holders !== null ? holders.toLocaleString("en-US") : "—",
      block: market ? market.block.toLocaleString("en-US") : "—",
      date: now.slice(0, 10) + " " + now.slice(11, 16)
    });
    png = await renderPng(svg, fonts);
    response = pngResponse(png, LIVE_CACHE_CONTROL);
    context.waitUntil(cache.put(cacheRequest, response.clone()));
    return response;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    return staticFallback(origin);
  }
}

async function serveOg(context) {
  var url = new URL(context.request.url);
  var origin = url.origin;
  if (url.searchParams.has("slug")) {
    return serveDiaryCard(context, origin, url.searchParams.get("slug") || "");
  }
  return serveLiveCard(context, origin);
}

export async function onRequestGet(context) {
  return serveOg(context);
}

export async function onRequestHead(context) {
  /* A crawler may probe with HEAD before it performs GET. Never send that
     probe through live market RPCs or rasterization: it needs truthful image
     metadata quickly, not the bytes. If the exact GET is already cached, copy
     its headers (including Content-Length); otherwise validate an entry slug
     against the local manifest and return the representation headers only. */
  var url = new URL(context.request.url);
  var slug = url.searchParams.get("slug") || "";
  var cache = caches.default;
  var cacheRequest;
  var cached;
  var entry;
  if (!url.searchParams.has("slug")) {
    cached = await cache.match(liveCacheRequest(url.origin));
    if (cached) return new Response(null, { status: cached.status, headers: cached.headers });
    return new Response(null, {
      status: 200,
      headers: { "Content-Type": "image/png", "Cache-Control": LIVE_CACHE_CONTROL }
    });
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return withoutBody(errorResponse(404, "unknown diary entry"));
  }
  try {
    entry = await fetchDiaryEntry(url.origin, slug);
    if (!entry) return withoutBody(errorResponse(404, "unknown diary entry"));
    cacheRequest = diaryCacheRequest(url.origin, entry);
    cached = await cache.match(cacheRequest);
    if (cached) return new Response(null, { status: cached.status, headers: cached.headers });
    return new Response(null, {
      status: 200,
      headers: { "Content-Type": "image/png", "Cache-Control": ENTRY_CACHE_CONTROL }
    });
  } catch (error) {
    return withoutBody(errorResponse(500, "diary OG probe failed: " + error.message));
  }
}
