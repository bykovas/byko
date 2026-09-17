// One-off X API diagnosis (temporary; delete after use).
// GET /2/users/me, and with POST_TEXT set, POST /2/tweets with that text.
// Prints status, full JSON body and every response header. Never prints keys.
import crypto from "node:crypto";

const enc = encodeURIComponent;
function oauthHeader(method, url, query = {}) {
  const params = {
    oauth_consumer_key: process.env.XCOM_BYKO_API_KEY,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: process.env.XCOM_BYKO_ACCESS_TOKEN,
    oauth_version: "1.0",
  };
  const all = { ...params, ...query };
  const paramString = Object.keys(all).sort().map(k => `${enc(k)}=${enc(all[k])}`).join("&");
  const base = [method, enc(url), enc(paramString)].join("&");
  const key = `${enc(process.env.XCOM_BYKO_API_SECRET)}&${enc(process.env.XCOM_BYKO_ACCESS_SECRET)}`;
  params.oauth_signature = crypto.createHmac("sha1", key).update(base).digest("base64");
  return "OAuth " + Object.keys(params).sort().map(k => `${enc(k)}="${enc(params[k])}"`).join(", ");
}

async function show(label, res) {
  console.log(`\n=== ${label}: HTTP ${res.status} ${res.statusText}`);
  console.log("--- headers");
  for (const [k, v] of res.headers) console.log(`${k}: ${v}`);
  const text = await res.text();
  console.log("--- body");
  try { console.log(JSON.stringify(JSON.parse(text), null, 2)); } catch { console.log(text); }
  for (const h of ["x-rate-limit-reset", "x-user-limit-24hour-reset", "x-app-limit-24hour-reset"]) {
    const v = res.headers.get(h);
    if (v) console.log(`${h} = ${new Date(Number(v) * 1000).toISOString()}`);
  }
}

for (const k of ["XCOM_BYKO_API_KEY", "XCOM_BYKO_API_SECRET", "XCOM_BYKO_ACCESS_TOKEN", "XCOM_BYKO_ACCESS_SECRET"]) {
  console.log(`${k}: ${process.env[k] ? "present" : "MISSING"}`);
}

const meUrl = "https://api.x.com/2/users/me";
await show("GET /2/users/me", await fetch(meUrl, { headers: { Authorization: oauthHeader("GET", meUrl) } }));

/* exactly what publish-diary.mjs would send for this entry from commit
   6fe66fe: the X field, a newline, the entry URL with that commit's time */
const CARD2 = "Pragma’s Vesu post-mortem shows how many sources can still mean one failure: " +
  "two publishers reused the same bad USDT conversion and cut major asset prices in half. " +
  "For BYKO, surface count is not data independence. Sources: Pragma, Vesu, crypto.news." +
  "\nhttps://byko.bykovas.lt/d/two-publishers-one-shared-failure?v=1789650287";
const text = process.env.POST_CARD2 === "true" ? CARD2 : "";
if (text) {
  const url = "https://api.x.com/2/tweets";
  console.log(`\nposting ${text.length} chars`);
  await show("POST /2/tweets", await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: oauthHeader("POST", url) },
    body: JSON.stringify({ text }),
  }));
} else {
  console.log("\nPOST_CARD2 not set — no post attempted");
}

/* write probe that publishes nothing lasting: like our own last tweet, then
   remove the like. 403 here too means the account cannot write at all. */
if (process.env.LIKE_PROBE === "true") {
  const me = "2087521805871325184", tweet = "2100570090907333036";
  const likeUrl = `https://api.x.com/2/users/${me}/likes`;
  await show("POST likes", await fetch(likeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: oauthHeader("POST", likeUrl) },
    body: JSON.stringify({ tweet_id: tweet }),
  }));
  const unUrl = `${likeUrl}/${tweet}`;
  await show("DELETE like", await fetch(unUrl, { method: "DELETE", headers: { Authorization: oauthHeader("DELETE", unUrl) } }));
}
