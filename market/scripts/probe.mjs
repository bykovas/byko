#!/usr/bin/env node
/* Ask the three classifiers that will not answer a Cloudflare Worker.
 *
 * GoPlus, GeckoTerminal and CoinGecko rate-limit the shared Workers egress
 * (4029 / 429) far below our own volume — we ask twice an hour. From an
 * ordinary connection they answer immediately. This runs from that connection
 * and posts the readings back through /api/observe, recorded with
 * method='api-local' so anyone reading the log can tell which network asked.
 *
 *   ADMIN_TOKEN=... node market/scripts/probe.mjs
 *   (or leave it in market/.dev.vars, which this reads)
 *
 * A refusal is still posted, as ok=false — it renders '?' and never becomes a
 * baseline. Silence would be the one dishonest option.
 */
import { readFileSync, existsSync } from "node:fs";

const BASE = process.env.MARKET_URL || "https://byko-market.bykovas.lt";
const ARMS = [
  { arm: "byko", token: "0x078bb16e24C8931Fc007928c370422e5e38F4372",
    pool: "0x02dd4285ad38ea93d021ca854016a839b0b2a6ca" },
  { arm: "luko", token: "0x4a9DA2831A691E7C4aca594CaFd58c35e0131fD1",
    pool: "0x2222a01b83db8c533b062aeb6de4f61d6ae792f2" },
];

function adminToken() {
  if (process.env.ADMIN_TOKEN) return process.env.ADMIN_TOKEN.trim();
  const path = new URL("../.dev.vars", import.meta.url);
  if (existsSync(path)) {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = /^ADMIN_TOKEN=(.+)$/.exec(line.trim());
      if (m) return m[1].trim();
    }
  }
  return null;
}

const UA = "byko-market-probe/1.0 (+https://byko.bykovas.lt/self-trading)";
async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, accept: "application/json" } });
  return { status: res.status, text: await res.text() };
}

async function goplus(a) {
  const { status, text } = await get(
    `https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses=${a.token}`);
  if (status !== 200) return { ok: false, value: `http:${status}` };
  const j = JSON.parse(text);
  const r = j.result ? Object.values(j.result)[0] : undefined;
  if (j.code !== 1 || !r) return { ok: false, value: `goplus:${j.code ?? "empty"}` };
  return {
    ok: true,
    value: [`dex:${r.is_in_dex ?? "?"}`, `honeypot:${r.is_honeypot ?? "?"}`,
            `blacklist:${r.is_blacklisted ?? "?"}`, `whitelist:${r.is_whitelisted ?? "?"}`].join(" "),
    note: `holders ${r.holder_count ?? "?"}`,
    holders: r.holder_count ? Number(r.holder_count) : undefined,
  };
}

async function geckoterminal(a) {
  const { status, text } = await get(
    `https://api.geckoterminal.com/api/v2/networks/base/pools/${a.pool}`);
  if (status !== 200) return { ok: false, value: `http:${status}` };
  const at = JSON.parse(text).data?.attributes ?? {};
  const locked = at.locked_liquidity_percentage;
  return {
    ok: true,
    value: locked == null ? "null" : String(locked),
    note: `price ${at.base_token_price_usd ?? "?"} tvl ${at.reserve_in_usd ?? "?"}`,
  };
}

async function coingecko(a) {
  const { status } = await get(`https://api.coingecko.com/api/v3/coins/base/contract/${a.token}`);
  if (status === 200) return { ok: true, value: "known" };
  if (status === 404) return { ok: true, value: "unknown" };
  return { ok: false, value: `http:${status}` };
}

const token = adminToken();
if (!token) {
  console.error("no ADMIN_TOKEN (env or market/.dev.vars)");
  process.exit(1);
}

const probes = { goplus, geckoterminal, coingecko };
for (const a of ARMS) {
  console.log(`[${a.arm}]`);
  for (const [source, fn] of Object.entries(probes)) {
    let result;
    try { result = await fn(a); } catch (err) { result = { ok: false, value: `error:${err.message}` }; }
    const res = await fetch(`${BASE}/api/observe`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        arm: a.arm, source, method: "api-local",
        ok: result.ok, value: result.value, note: result.note ?? null,
        holders: result.holders,
      }),
    });
    const body = await res.json().catch(() => ({}));
    console.log(`  ${source.padEnd(15)} ${result.ok ? " " : "?"} ${String(result.value).slice(0, 44).padEnd(46)} → ${res.status} ${body.recorded ? "recorded" : JSON.stringify(body).slice(0, 60)}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}
