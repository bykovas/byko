/* The warm payload: everything the market page derives from the pool.
 *
 * It used to be derived in the reader's browser — nine getAmountsOut calls per
 * visitor plus a call to the ECB feed, against public endpoints that already
 * answer this project "over rate limit". Deriving it once here and serving the
 * result with the time it was measured costs the same nine calls a few times an
 * hour instead of once per page view.
 *
 * What is NOT here, on purpose: the pool reserves and the price. The market
 * page says in its own lede that those are read from the chain in the reader's
 * browser with nothing in between, and that sentence has to stay true. They are
 * included in this payload only as a cross-check a reader can compare against
 * their own read — never as the page's source for them.
 */
import type { Env } from "../types";
import { RULES } from "./rules";
import { ethCallBatch, poolReserves, foundersShare, blockNumber, num } from "./collector";
import { readCache, writeCache, ageOf } from "./cache";

const EUR_STEPS = [1, 5, 10, 20, 50, 100, 200, 500, 1000];
const EUR_FALLBACK = 1.17;
const EUR_MAX_AGE = 12 * 60 * 60 * 1000;   /* the ECB publishes once a day */
const QUOTE_SELECTOR = "0x5509a1ac";       /* getAmountsOut(uint256,(address,address,bool,address)[]) */

const pad = (hex: string) => hex.replace(/^0x/, "").toLowerCase().padStart(64, "0");

function quoteData(usdcUnits: bigint): string {
  const v = RULES.venue;
  return QUOTE_SELECTOR +
    pad(usdcUnits.toString(16)) +
    pad("40") + pad("1") +
    pad(v.quote.slice(2)) + pad(RULES.arms[0].token.slice(2)) +
    pad("0") + pad(v.factory.slice(2));
}

/* amounts[1] of a two-element uint256[]: offset, length, in, out */
function decodeQuote(hex: string): bigint {
  const body = hex.replace(/^0x/, "");
  if (body.length < 256) throw new Error("quote");
  return num("0x" + body.slice(192, 256));
}

export interface EurRate { rate: number; live: boolean; date: string; at: string }

async function eurRate(env: Env): Promise<EurRate> {
  const cached = await readCache<EurRate>(env, "eur");
  if (cached && cached.value.live && ageOf(cached) < EUR_MAX_AGE) return cached.value;
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD", {
      headers: { "User-Agent": "byko-market/1.0 (+https://byko.bykovas.lt)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`http ${res.status}`);
    const body = await res.json() as { rates?: { USD?: number }; date?: string };
    const rate = Number(body?.rates?.USD);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error("no rate");
    const value: EurRate = { rate, live: true, date: String(body.date ?? ""), at: new Date().toISOString() };
    await writeCache(env, "eur", value, "ECB reference rate via frankfurter.dev");
    return value;
  } catch {
    /* Keep the last real reading rather than dropping to the constant the
       moment one request fails; only say "fallback" when nothing was ever
       measured. */
    if (cached) return cached.value;
    return { rate: EUR_FALLBACK, live: false, date: "", at: new Date().toISOString() };
  }
}

export interface PoolPayload {
  block: number;
  reserve_token: string;
  reserve_usdc: string;
  price: number;
  fdv: number;
  k: number;
  founders_pct: string | null;
  trade_cap_usdc: number;
  eur: EurRate;
  quotes: Array<{ eur: number; usdc: number; byko: number }>;
  measured_at: string;
}

export async function computePool(env: Env): Promise<PoolPayload> {
  const arm = RULES.arms[0];
  const [res, block, eur] = await Promise.all([
    poolReserves(env, arm.pool),
    blockNumber(env),
    eurRate(env),
  ]);
  if (!res.token || !res.usdc) throw new Error("reserves");
  const token = Number(res.token) / 1e18;
  const usdc = Number(res.usdc) / 1e6;
  const price = usdc / token;

  /* chunked at three inside ethCallBatch: DRPC refuses larger batches and says
     so inside an HTTP 200, one error object per element */
  const out = await ethCallBatch(env, EUR_STEPS.map((step) => ({
    to: RULES.venue.router,
    data: quoteData(BigInt(Math.round(step * eur.rate * 1e6))),
  })));
  const quotes = EUR_STEPS.map((step, i) => ({
    eur: step,
    usdc: Number((step * eur.rate).toFixed(6)),
    byko: Number(decodeQuote(out[i])) / 1e18,
  }));

  let founders: string | null = null;
  try { founders = await foundersShare(env, arm.token); } catch { founders = null; }

  return {
    block,
    reserve_token: res.token,
    reserve_usdc: res.usdc,
    price,
    fdv: price * 790227,
    k: usdc * token,
    founders_pct: founders || null,
    trade_cap_usdc: usdc * RULES.strategy.max_trade_pct_pool / 100,
    eur,
    quotes,
    measured_at: new Date().toISOString(),
  };
}
