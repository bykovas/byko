import type { Env } from "../types";
import { RULES } from "./rules";

/* The collector: hourly.
 *
 * Only the BYKO arm is measured. It is the one with a flag to clear, so it is
 * the one the classifiers are asked about; LUKO simply trades in the
 * background and gets a chain-read sample only. That halves the outbound
 * calls, which is also what stops the shared Workers egress IP from earning
 * 429s at GoPlus, GeckoTerminal and CoinGecko.
 *
 * It never fabricates "unchanged" — a request that fails writes ok=0 and the
 * grid renders '?'. Base App has no API and is entered by hand via
 * /api/observe; it is not fetched here.
 *
 * Every endpoint below was probed on 19 Aug 2026 and behaves as coded. */

/* the arm whose classifiers we actually poll */
const MEASURED_ARM = "byko";

const LP_HOLDER: Record<string, string> = {
  /* byko: LP is 100% burned; luko: 100% held by MEETLUKO, withdrawable */
  byko: "0x000000000000000000000000000000000000dEaD",
  luko: "0xf0adec1e81c31bbb253b819c67cbb1826fb7109e",
};

interface Probe { ok: boolean; value: string; raw: string }

/* CoinGecko refuses anonymous callers with a 403 asking for a descriptive
   agent; every other host is happy to be told who is calling anyway. */
const UA = "byko-market/1.0 (+https://byko.bykovas.lt/self-trading; hello@byko.bykovas.lt)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* Workers egress from shared Cloudflare addresses, so the free tiers of
   GoPlus, GeckoTerminal and CoinGecko answer 429 far below our own volume —
   we ask twice an hour. Back off and try again rather than record a throttle
   as if it were a verdict. */
async function get(url: string, headers: Record<string, string> = {}): Promise<{ status: number; text: string }> {
  let last = { status: 0, text: "" };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, accept: "application/json", ...headers },
      signal: AbortSignal.timeout(12_000),
    });
    last = { status: res.status, text: (await res.text()).slice(0, 4000) };
    if (last.status !== 429 && last.status < 500) return last;
    await sleep(1_500 * (attempt + 1));
  }
  return last;
}

/* A refusal is not a reading. Rate limits, blocks and gateway errors mean the
   question was never answered, so they must record ok=0 — which renders '?'
   and, because the baseline query only considers ok=1, can never poison the
   comparison the whole grid is built on. */
function unmeasured(reason: string, raw = ""): Probe {
  return { ok: false, value: reason, raw };
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
    /* Only a POSITIVE price counts as "this token can be priced". The endpoint
       demonstrably answers 200 with usd:0 when the token is asked for beside a
       known one, and a zero is the refusal, not the answer. Anything that is
       not a real price is written with a non-numeric prefix so no downstream
       reader can mistake a status code for a quote. */
    if (typeof price === "number" && price > 0) return { ok: true, value: String(price), raw: text };
    return { ok: true, value: `no-price:${status}`, raw: text };
  } catch (e) { return unmeasured("error", String(e)); }
}

async function metamaskToken(token: string): Promise<Probe> {
  try {
    const { status, text } = await get(`https://token.api.cx.metamask.io/token/8453?address=${token}`);
    if (status === 404) return { ok: true, value: "unknown", raw: text };
    if (status !== 200) return unmeasured(`http:${status}`, text);
    const j = JSON.parse(text) as { aggregators?: string[] };
    return { ok: true, value: (j.aggregators ?? []).join("+") || "none", raw: text };
  } catch (e) { return unmeasured("error", String(e)); }
}

async function goplus(token: string): Promise<Probe & { holders: number | null }> {
  try {
    const { status, text } = await get(`https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses=${token}`);
    if (status !== 200) return { ...unmeasured(`http:${status}`, text), holders: null };
    const j = JSON.parse(text) as {
      code?: number;
      result?: Record<string, {
        holder_count?: string; is_in_dex?: string; is_honeypot?: string;
        is_blacklisted?: string; is_whitelisted?: string;
      }>;
    };
    /* GoPlus answers code 1 on success; 4029 is its rate limit, and its body
       still parses cleanly, which is exactly how a throttle sneaks in as data. */
    const r = j.result ? Object.values(j.result)[0] : undefined;
    if (j.code !== 1 || !r) return { ...unmeasured(`goplus:${j.code ?? "empty"}`, text), holders: null };
    const holders = r?.holder_count ? Number(r.holder_count) : null;
    /* The grid tracks the VERDICT, not the market. holder_count moves every
       time anyone is paid and would light the "changed" mark for a reason that
       has nothing to do with what the classifier thinks; it belongs in
       market_samples, where it already goes. */
    const verdict = [
      `dex:${r?.is_in_dex ?? "?"}`,
      `honeypot:${r?.is_honeypot ?? "?"}`,
      `blacklist:${r?.is_blacklisted ?? "?"}`,
      `whitelist:${r?.is_whitelisted ?? "?"}`,
    ].join(" ");
    return { ok: true, value: verdict, raw: text, holders };
  } catch (e) { return { ...unmeasured("error", String(e)), holders: null }; }
}

async function dexscreener(token: string): Promise<Probe> {
  try {
    const { status, text } = await get(`https://api.dexscreener.com/latest/dex/tokens/${token}`);
    if (status !== 200) return unmeasured(`http:${status}`, text);
    const j = JSON.parse(text) as { pairs?: unknown[] };
    const n = Array.isArray(j.pairs) ? j.pairs.length : 0;
    return { ok: true, value: n > 0 ? "listed" : "unlisted", raw: text };
  } catch (e) { return unmeasured("error", String(e)); }
}

interface GeckoSample { price: string; fdv: string; tvl: string; vol: string; buys: number; sells: number }
async function geckoPool(pool: string): Promise<Probe & { sample: GeckoSample | null }> {
  try {
    const { status, text } = await get(`https://api.geckoterminal.com/api/v2/networks/base/pools/${pool}`);
    if (status !== 200) return { ...unmeasured(`http:${status}`, text), sample: null };
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
  } catch (e) { return { ...unmeasured("error", String(e)), sample: null }; }
}

async function coingecko(token: string): Promise<Probe> {
  try {
    const { status, text } = await get(`https://api.coingecko.com/api/v3/coins/base/contract/${token}`);
    if (status === 200) return { ok: true, value: "known", raw: text.slice(0, 500) };
    if (status === 404) return { ok: true, value: "unknown", raw: text.slice(0, 500) };
    /* 403 (no agent) and 429 (rate limit) say nothing about the token */
    return unmeasured(`http:${status}`, text.slice(0, 500));
  } catch (e) { return unmeasured("error", String(e)); }
}

async function blockscout(token: string): Promise<Probe> {
  try {
    const { status, text } = await get(`https://base.blockscout.com/api/v2/tokens/${token}`);
    if (status !== 200) return unmeasured(`http:${status}`, text);
    const j = JSON.parse(text) as { holders_count?: string; holders?: string };
    return { ok: true, value: String(j.holders_count ?? j.holders ?? "?"), raw: text.slice(0, 800) };
  } catch (e) { return unmeasured("error", String(e)); }
}

function listMembership(listText: string, token: string): Probe {
  const present = listText.toLowerCase().includes(token.toLowerCase());
  return { ok: true, value: present ? "present" : "absent", raw: "" };
}

/* price and reserves straight from the pool — no vendor in between */
async function poolReserves(env: Env, pool: string): Promise<{ price: string; token: string; usdc: string }> {
  try {
    const raw = await ethCall(env, pool, "0x0902f1ac");
    const hex = raw.slice(2);
    const t = num("0x" + hex.slice(0, 64));
    const u = num("0x" + hex.slice(64, 128));
    const price = t > 0n ? (Number(u) / 1e6) / (Number(t) / 1e18) : 0;
    return { price: price ? price.toPrecision(12) : "", token: String(t), usdc: String(u) };
  } catch { return { price: "", token: "", usdc: "" }; }
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

    /* LUKO: chain reads only — its own reserves for a price, and the LP holder
       that this experiment discloses about itself. No third-party opinion is
       sought, because nothing about LUKO is being measured. */
    if (r.id !== MEASURED_ARM) {
      const lpOnly = await lpState(env, r.id, r.pool);
      const res = await poolReserves(env, r.pool);
      await env.DB.prepare(
        `INSERT INTO market_samples
           (sampled_at, arm, price_usd, reserve_token, reserve_usdc, lp_holder, lp_locked)
         VALUES (datetime('now'), ?1, ?2, ?3, ?4, ?5, ?6)`,
      ).bind(r.id, res.price, res.token, res.usdc, lpOnly.holder, lpOnly.locked).run();
      continue;
    }

    /* one host at a time, with a breath between: a burst is what trips the
       shared-IP limits in the first place */
    const mp = await metamaskPrice(token);   await sleep(400);
    const mt = await metamaskToken(token);   await sleep(400);
    const gp = await goplus(token);          await sleep(800);
    const dx = await dexscreener(token);     await sleep(400);
    const gk = await geckoPool(r.pool);      await sleep(800);
    const cg = await coingecko(token);       await sleep(400);
    const bs = await blockscout(token);

    await record(env, r.id, "metamask-price", "api", mp);
    await record(env, r.id, "metamask-token", "api", mt);
    await record(env, r.id, "goplus", "api", gp);
    await record(env, r.id, "dexscreener", "api", dx);
    await record(env, r.id, "geckoterminal", "api", gk);
    await record(env, r.id, "coingecko", "api", cg);
    await record(env, r.id, "blockscout", "api", bs);
    await record(env, r.id, "uniswap-list", "api",
      uniList ? listMembership(uniList, token) : unmeasured("fetch-failed"));
    await record(env, r.id, "1inch-list", "api",
      oneInch ? listMembership(oneInch, token) : unmeasured("fetch-failed"));

    /* The LP figure is read from the chain, not from GeckoTerminal, and it is
       this experiment's own disclosure — LUKO's liquidity is withdrawable by a
       founder wallet. It must not disappear from the page because a third
       party rate-limited us, so the sample is written either way and the
       market columns are simply left empty when the quote did not arrive. */
    const lp = await lpState(env, r.id, r.pool);
    const m = gk.sample;
    await env.DB.prepare(
      `INSERT INTO market_samples
         (sampled_at, arm, price_usd, fdv_usd, tvl_usd, vol_24h, buys_24h, sells_24h, holders, lp_holder, lp_locked)
       VALUES (datetime('now'), ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
    ).bind(r.id, m?.price ?? null, m?.fdv ?? null, m?.tvl ?? null, m?.vol ?? null,
      m?.buys ?? null, m?.sells ?? null, gp.holders, lp.holder, lp.locked).run();
  }
}
