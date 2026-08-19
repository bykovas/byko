import type { Env } from "../types";
import { RULES } from "./rules";

/* The collector: hourly, it asks each classifier what it says about each arm's
 * token and records the answer verbatim. It never fabricates "unchanged" — a
 * request that fails writes ok=0 (the grid renders '?'). Base App has no API
 * and is entered by hand elsewhere; it is not fetched here.
 *
 * Every endpoint below was probed on 19 Aug 2026 and behaves as coded. */

const LP_HOLDER: Record<string, string> = {
  /* byko: LP is 100% burned; luko: 100% held by MEETLUKO, withdrawable */
  byko: "0x000000000000000000000000000000000000dEaD",
  luko: "0xf0adec1e81c31bbb253b819c67cbb1826fb7109e",
};

interface Probe { ok: boolean; value: string; raw: string }

async function get(url: string, headers: Record<string, string> = {}): Promise<{ status: number; text: string }> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) });
  return { status: res.status, text: (await res.text()).slice(0, 4000) };
}

function num(hex: string): bigint { return hex && hex !== "0x" ? BigInt(hex) : 0n; }

async function ethCall(env: Env, to: string, data: string): Promise<string> {
  const node = env.DRPC_URL || env.RPC_URL;
  const res = await fetch(node, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
    signal: AbortSignal.timeout(8_000),
  });
  const body = (await res.json()) as { result?: string };
  return body.result ?? "0x";
}

/* --- per-token probes --- */

async function metamaskPrice(token: string): Promise<Probe> {
  try {
    const { status, text } = await get(
      `https://price.api.cx.metamask.io/v2/chains/8453/spot-prices?tokenAddresses=${token}&vsCurrency=usd`);
    const j = JSON.parse(text) as Record<string, { usd?: number }> | { statusCode?: number };
    const key = token.toLowerCase();
    const price = (j as Record<string, { usd?: number }>)[key]?.usd;
    if (typeof price === "number") return { ok: true, value: String(price), raw: text };
    return { ok: true, value: String(status), raw: text };
  } catch (e) { return { ok: false, value: "", raw: String(e) }; }
}

async function metamaskToken(token: string): Promise<Probe> {
  try {
    const { status, text } = await get(`https://token.api.cx.metamask.io/token/8453?address=${token}`);
    if (status !== 200) return { ok: true, value: String(status), raw: text };
    const j = JSON.parse(text) as { aggregators?: string[] };
    return { ok: true, value: (j.aggregators ?? []).join("+") || "none", raw: text };
  } catch (e) { return { ok: false, value: "", raw: String(e) }; }
}

async function goplus(token: string): Promise<Probe & { holders: number | null }> {
  try {
    const { text } = await get(`https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses=${token}`);
    const j = JSON.parse(text) as { result?: Record<string, { holder_count?: string; is_in_dex?: string }> };
    const r = j.result ? Object.values(j.result)[0] : undefined;
    const holders = r?.holder_count ? Number(r.holder_count) : null;
    return { ok: true, value: `${holders ?? "?"}/${r?.is_in_dex ?? "?"}`, raw: text, holders };
  } catch (e) { return { ok: false, value: "", raw: String(e), holders: null }; }
}

async function dexscreener(token: string): Promise<Probe> {
  try {
    const { text } = await get(`https://api.dexscreener.com/latest/dex/tokens/${token}`);
    const j = JSON.parse(text) as { pairs?: unknown[] };
    const n = Array.isArray(j.pairs) ? j.pairs.length : 0;
    return { ok: true, value: n > 0 ? "listed" : "unlisted", raw: text };
  } catch (e) { return { ok: false, value: "", raw: String(e) }; }
}

interface GeckoSample { price: string; fdv: string; tvl: string; vol: string; buys: number; sells: number }
async function geckoPool(pool: string): Promise<Probe & { sample: GeckoSample | null }> {
  try {
    const { text } = await get(`https://api.geckoterminal.com/api/v2/networks/base/pools/${pool}`);
    const a = (JSON.parse(text) as { data?: { attributes?: Record<string, unknown> } }).data?.attributes ?? {};
    const tx = (a.transactions as { h24?: { buys?: number; sells?: number } } | undefined)?.h24;
    const locked = a.locked_liquidity_percentage;
    const sample: GeckoSample = {
      price: String(a.base_token_price_usd ?? ""), fdv: String(a.fdv_usd ?? ""),
      tvl: String(a.reserve_in_usd ?? ""),
      vol: String((a.volume_usd as { h24?: string } | undefined)?.h24 ?? ""),
      buys: tx?.buys ?? 0, sells: tx?.sells ?? 0,
    };
    return { ok: true, value: locked == null ? "null" : String(locked), raw: text, sample };
  } catch (e) { return { ok: false, value: "", raw: String(e), sample: null }; }
}

async function coingecko(token: string): Promise<Probe> {
  try {
    const { status, text } = await get(`https://api.coingecko.com/api/v3/coins/base/contract/${token}`);
    return { ok: true, value: status === 200 ? "known" : String(status), raw: text.slice(0, 500) };
  } catch (e) { return { ok: false, value: "", raw: String(e) }; }
}

async function blockscout(token: string): Promise<Probe> {
  try {
    const { text } = await get(`https://base.blockscout.com/api/v2/tokens/${token}`);
    const j = JSON.parse(text) as { holders_count?: string; holders?: string };
    return { ok: true, value: String(j.holders_count ?? j.holders ?? "?"), raw: text.slice(0, 800) };
  } catch (e) { return { ok: false, value: "", raw: String(e) }; }
}

function listMembership(listText: string, token: string): Probe {
  const present = listText.toLowerCase().includes(token.toLowerCase());
  return { ok: true, value: present ? "present" : "absent", raw: "" };
}

async function lpState(env: Env, arm: string, pool: string): Promise<{ holder: string; locked: string }> {
  try {
    const holder = LP_HOLDER[arm];
    const ts = num(await ethCall(env, pool, "0x18160ddd"));
    const bal = num(await ethCall(env, pool, "0x70a08231" + holder.slice(2).toLowerCase().padStart(64, "0")));
    const pct = ts > 0n ? Number(bal) * 100 / Number(ts) : 0;
    return { holder, locked: pct.toFixed(2) };
  } catch { return { holder: LP_HOLDER[arm] ?? "", locked: "?" }; }
}

async function record(env: Env, arm: string, source: string, method: string, p: Probe): Promise<void> {
  const baseline = await env.DB.prepare(
    `SELECT value FROM flag_checks WHERE arm = ?1 AND source = ?2 AND ok = 1 ORDER BY id ASC LIMIT 1`,
  ).bind(arm, source).first<string>("value");
  const changed = p.ok && baseline != null && baseline !== p.value ? 1 : 0;
  await env.DB.prepare(
    `INSERT INTO flag_checks (checked_at, arm, source, method, ok, value, raw, changed)
     VALUES (datetime('now'), ?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
  ).bind(arm, source, method, p.ok ? 1 : 0, p.value || null, p.raw.slice(0, 2000) || null, changed).run();
}

export async function collect(env: Env): Promise<void> {
  /* list endpoints fetched once and shared across arms */
  let uniList = ""; let oneInch = "";
  try { uniList = (await get("https://tokens.uniswap.org")).text; } catch { /* leaves '' */ }
  try { oneInch = (await get("https://tokens.1inch.io/v1.2/8453")).text; } catch { /* leaves '' */ }

  for (const r of RULES.arms) {
    const token = r.token;
    const [mp, mt, gp, dx, gk, cg, bs] = await Promise.all([
      metamaskPrice(token), metamaskToken(token), goplus(token),
      dexscreener(token), geckoPool(r.pool), coingecko(token), blockscout(token),
    ]);

    await record(env, r.id, "metamask-price", "api", mp);
    await record(env, r.id, "metamask-token", "api", mt);
    await record(env, r.id, "goplus", "api", gp);
    await record(env, r.id, "dexscreener", "api", dx);
    await record(env, r.id, "geckoterminal", "api", gk);
    await record(env, r.id, "coingecko", "api", cg);
    await record(env, r.id, "blockscout", "api", bs);
    await record(env, r.id, "uniswap-list", "api",
      uniList ? listMembership(uniList, token) : { ok: false, value: "", raw: "" });
    await record(env, r.id, "1inch-list", "api",
      oneInch ? listMembership(oneInch, token) : { ok: false, value: "", raw: "" });

    const lp = await lpState(env, r.id, r.pool);
    if (gk.sample) {
      await env.DB.prepare(
        `INSERT INTO market_samples
           (sampled_at, arm, price_usd, fdv_usd, tvl_usd, vol_24h, buys_24h, sells_24h, holders, lp_holder, lp_locked)
         VALUES (datetime('now'), ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
      ).bind(r.id, gk.sample.price, gk.sample.fdv, gk.sample.tvl, gk.sample.vol,
        gk.sample.buys, gk.sample.sells, gp.holders, lp.holder, lp.locked).run();
    }
  }
}
