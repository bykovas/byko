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

const BURN = "0x000000000000000000000000000000000000dEaD";

/* The wallet that actually holds each pool's LP tokens when they are NOT
   burned. BYKO has none — its LP is entirely at the burn address. LUKO's sits
   with MEETLUKO, a founder wallet, which is the whole point of disclosing it. */
const LP_KEEPER: Record<string, string> = {
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

export function num(hex: string): bigint { return hex && hex !== "0x" ? BigInt(hex) : 0n; }

/* Chain reads walk the node list instead of trusting one endpoint. The earlier
   version asked a single node and returned "0x" on any failure, so a rate limit
   arrived as a balance of zero — a refusal dressed as data, which is the one
   thing nothing here is allowed to do. A read that cannot be made now throws,
   and the caller records nothing rather than something false. */
function nodeList(env: Env): string[] {
  return [env.DRPC_URL, env.RPC_URL, "https://base-rpc.publicnode.com", "https://base.drpc.org"]
    .filter((u): u is string => Boolean(u))
    .filter((u, i, all) => all.indexOf(u) === i);
}

/* A node can answer HTTP 200 and still have refused: DRPC's free plan returns a
   well-formed JSON-RPC array whose every element carries "Batch of more than 3
   requests are not allowed". Accepting that as a reply is how a refusal turns
   into a statistic, so the caller supplies a validator and a response that
   fails it moves us to the next node instead of being believed. */
async function rpcCall(env: Env, payload: unknown, valid: (body: unknown) => boolean): Promise<unknown> {
  let last: unknown = null;
  for (const url of nodeList(env)) {
    try {
      const res = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`http ${res.status}`);
      const body = await res.json();
      if (!valid(body)) throw new Error("node refused the call");
      return body;
    } catch (err) { last = err; }
  }
  throw last instanceof Error ? last : new Error("no node answered");
}

export async function blockNumber(env: Env): Promise<number> {
  const body = await rpcCall(env,
    { jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] },
    (b) => typeof (b as { result?: unknown }).result === "string",
  ) as { result: string };
  return parseInt(body.result, 16);
}

const WORD = 66;   /* "0x" + 32 bytes: the width of any uint256 answer */
const isWord = (v: unknown): v is string => typeof v === "string" && v.length >= WORD;

export async function ethCall(env: Env, to: string, data: string): Promise<string> {
  const body = await rpcCall(env,
    { jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] },
    (b) => isWord((b as { result?: unknown }).result),
  ) as { result: string };
  return body.result;
}

/* One HTTP round trip for many reads. Thirteen register wallets per arm as
   thirteen separate requests is what exhausted the keyed node in the first
   place. */
/* DRPC's free plan caps a batch at three calls, so the register's fourteen
   reads go out in chunks of three rather than as one rejected block. Still five
   round trips instead of fourteen, and every chunk is validated before it is
   believed. */
const BATCH_MAX = 3;

export async function ethCallBatch(env: Env, calls: Array<{ to: string; data: string }>): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < calls.length; i += BATCH_MAX) {
    const chunk = calls.slice(i, i + BATCH_MAX);
    const payload = chunk.map((c, k) => ({
      jsonrpc: "2.0", id: k, method: "eth_call", params: [{ to: c.to, data: c.data }, "latest"],
    }));
    const body = await rpcCall(env, payload, (b) =>
      Array.isArray(b) && b.length === chunk.length &&
      (b as Array<{ result?: unknown }>).every((x) => isWord(x.result))) as Array<{ id: number; result: string }>;
    const slot = new Array<string>(chunk.length).fill("");
    for (const item of body) slot[item.id] = item.result;
    if (slot.some((x) => !x)) throw new Error("batch: missing id in response");
    out.push(...slot);
  }
  return out;
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

/* CoinMarketCap. Two different questions, deliberately kept apart:
   - cmc-index: does the main CMC listing know this token at all (the same
     question CoinGecko answers, from the other big index);
   - cmc-dex:   does its DEX side price this pool. It does — which is worth
     recording precisely because MetaMask's price service answers 500 for the
     same token. The price itself goes to market_samples; the grid keeps a
     verdict that only moves when the answer changes, not when the price does. */
interface CmcQuote { price?: number; liquidity?: number; volume_24h?: number; fully_diluted_value?: number }

async function cmcDex(env: Env, pool: string): Promise<Probe & { q: CmcQuote | null }> {
  const key = env.CMC_API_KEY;
  if (!key) return { ...unmeasured("no-key"), q: null };
  try {
    const { status, text } = await get(
      `https://pro-api.coinmarketcap.com/v4/dex/pairs/quotes/latest?network_slug=base&contract_address=${pool}`,
      { "X-CMC_PRO_API_KEY": key });
    if (status !== 200) return { ...unmeasured(`http:${status}`, text), q: null };
    const j = JSON.parse(text) as { data?: Array<{ quote?: CmcQuote[] }> };
    const q = j.data?.[0]?.quote?.[0] ?? null;
    if (!q || typeof q.price !== "number") return { ok: true, value: "unpriced", raw: text, q: null };
    return { ok: true, value: "priced", raw: text, q };
  } catch (e) { return { ...unmeasured("error", String(e)), q: null }; }
}

async function cmcIndex(env: Env, symbol: string): Promise<Probe> {
  const key = env.CMC_API_KEY;
  if (!key) return unmeasured("no-key");
  try {
    const { status, text } = await get(
      `https://pro-api.coinmarketcap.com/v1/cryptocurrency/map?symbol=${symbol}`,
      { "X-CMC_PRO_API_KEY": key });
    if (status === 200) return { ok: true, value: "known", raw: text.slice(0, 400) };
    /* 400 "Invalid value for symbol" is CMC's way of saying it has never
       heard of the ticker — a real reading, not a refusal */
    if (status === 400) return { ok: true, value: "unknown", raw: text.slice(0, 400) };
    return unmeasured(`http:${status}`, text.slice(0, 400));
  } catch (e) { return unmeasured("error", String(e)); }
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

/* What share of a token's supply sits in the project's own published wallets.
   The register is the same file the site's tally and home-page list read — one
   source, never a second list — and the sum is a plain chain read, so the
   figure on this page cannot drift from the one on the front page. */
export async function foundersShare(env: Env, token: string): Promise<string> {
  try {
    const res = await fetch("https://byko.bykovas.lt/data/founder-wallets.json",
      { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return "";
    const raw = (await res.json()) as { wallets?: Array<{ address: string }> } | Array<{ address: string }>;
    const list = Array.isArray(raw) ? raw : raw.wallets ?? [];
    if (!list.length) return "";
    const reads = await ethCallBatch(env, [
      { to: token, data: "0x18160ddd" },
      ...list.map((w) => ({
        to: token, data: "0x70a08231" + w.address.slice(2).toLowerCase().padStart(64, "0"),
      })),
    ]);
    const supply = num(reads[0]);
    if (supply === 0n) return "";
    const held = reads.slice(1).reduce((sum, r) => sum + num(r), 0n);
    return (Number(held) * 100 / Number(supply)).toFixed(2);
  } catch { return ""; }
}

/* price and reserves straight from the pool — no vendor in between */
export async function poolReserves(env: Env, pool: string): Promise<{ price: string; token: string; usdc: string }> {
  try {
    const raw = await ethCall(env, pool, "0x0902f1ac");
    const hex = raw.slice(2);
    const t = num("0x" + hex.slice(0, 64));
    const u = num("0x" + hex.slice(64, 128));
    const price = t > 0n ? (Number(u) / 1e6) / (Number(t) / 1e18) : 0;
    return { price: price ? price.toPrecision(12) : "", token: String(t), usdc: String(u) };
  } catch { return { price: "", token: "", usdc: "" }; }
}

/* "Locked" means BURNED — LP tokens at an address with no private key, which
 * nobody can ever withdraw. It does not mean "sitting where we expect".
 * Measuring the designated holder's share and calling it locked would have
 * reported LUKO as 100% locked when 100% of its LP is in a founder wallet and
 * withdrawable at will — the exact opposite of the truth, printed under the
 * word this experiment promised to be loudest about. So the number published
 * is the share at the burn address, for both arms, and the keeper is named
 * separately. */
async function lpState(env: Env, arm: string, pool: string):
  Promise<{ holder: string; burned: string }> {
  const keeper = LP_KEEPER[arm];
  const bal = (who: string) =>
    ({ to: pool, data: "0x70a08231" + who.slice(2).toLowerCase().padStart(64, "0") });
  try {
    const reads = await ethCallBatch(env, keeper
      ? [{ to: pool, data: "0x18160ddd" }, bal(BURN), bal(keeper)]
      : [{ to: pool, data: "0x18160ddd" }, bal(BURN)]);
    const ts = num(reads[0]);
    if (ts === 0n) return { holder: "", burned: "?" };
    const burnedPct = Number(num(reads[1])) * 100 / Number(ts);
    const holder = keeper
      ? `${keeper}:${(Number(num(reads[2])) * 100 / Number(ts)).toFixed(2)}`
      : "";
    return { holder, burned: burnedPct.toFixed(2) };
  } catch { return { holder: "", burned: "?" }; }
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


    /* one host at a time, with a breath between: a burst is what trips the
       shared-IP limits in the first place */
    const mp = await metamaskPrice(token);   await sleep(400);
    const mt = await metamaskToken(token);   await sleep(400);
    const gp = await goplus(token);          await sleep(800);
    const dx = await dexscreener(token);     await sleep(400);
    const gk = await geckoPool(r.pool);      await sleep(800);
    const cg = await coingecko(token);       await sleep(400);
    const cd = await cmcDex(env, r.pool);    await sleep(400);
    const ci = await cmcIndex(env, r.id.toUpperCase()); await sleep(400);
    const bs = await blockscout(token);

    await record(env, r.id, "metamask-price", "api", mp);
    await record(env, r.id, "metamask-token", "api", mt);
    await record(env, r.id, "goplus", "api", gp);
    await record(env, r.id, "dexscreener", "api", dx);
    await record(env, r.id, "geckoterminal", "api", gk);
    await record(env, r.id, "coingecko", "api", cg);
    await record(env, r.id, "cmc-dex", "api", cd);
    await record(env, r.id, "cmc-index", "api", ci);
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
    const founders = await foundersShare(env, token);
    const m = gk.sample;
    /* GeckoTerminal is rate-limited from the shared Workers egress often
       enough that the market row would be mostly empty; CMC's DEX side answers
       with a key and covers the same ground except the trade counts. Whichever
       replied fills the row, and the LP figure — read from the chain — is
       written regardless. */
    const q = cd.q;
    /* last resort: the pool itself. A price we can always read beats an empty
       column filled by nobody. */
    /* Read the reserves EVERY pass, not only when both vendors are silent.
       tvl_usd was filled by whichever of them answered, and they do not report
       the same quantity: GeckoTerminal's reserve_in_usd counts both sides of
       the pool, CMC's liquidity counts one. So the column held $140 for byko
       and $578 for luko while the chain said $140 and $290 — the same column
       meaning two different things depending on who replied, published on two
       cards side by side for comparison. The chain answer is unambiguous and
       is now stored in its own columns; tvl_usd keeps whatever the vendor
       said, and nothing computes against it. */
    const chain = await poolReserves(env, r.pool);
    await env.DB.prepare(
      `INSERT INTO market_samples
         (sampled_at, arm, price_usd, fdv_usd, tvl_usd, vol_24h, buys_24h, sells_24h, holders, lp_holder, lp_locked, founders_pct,
          reserve_token, reserve_usdc)
       VALUES (datetime('now'), ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
    ).bind(r.id,
      m?.price ?? (q?.price != null ? String(q.price) : chain?.price || null),
      m?.fdv ?? (q?.fully_diluted_value != null ? String(q.fully_diluted_value) : null),
      m?.tvl ?? (q?.liquidity != null ? String(q.liquidity) : null),
      m?.vol ?? (q?.volume_24h != null ? String(q.volume_24h) : null),
      m?.buys ?? null, m?.sells ?? null, gp.holders, lp.holder, lp.burned, founders || null,
      chain.token || null, chain.usdc || null).run();
  }
}
