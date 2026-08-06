var BYKO = "0x078bB16e24c8931fc007928c370422e5e38F4372";
var RATE_LIMIT = 5;
var RATE_WINDOW_SECONDS = 3600;

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

export async function onRequestPost(context) {
  var input;
  var email;
  var env = context.env;
  var from = env.CARD_FROM_EMAIL || "byko@bykovas.lt";
  var notifyTo = env.CARD_NOTIFY_TO || "byko@bykovas.lt";
  var timestamp = new Date().toISOString();
  var mailjet;
  var response;

  try {
    input = await context.request.json();
    email = input && typeof input.email === "string" ? input.email.trim() : "";
  } catch (error) {
    return json({ error: "email" }, 400);
  }
  if (!validEmail(email)) return json({ error: "email" }, 400);
  if (!await underRateLimit(context.request)) return json({ error: "rate" }, 429);
  if (!env.MAILJET_API_KEY || !env.MAILJET_SECRET_KEY) return json({ error: "send" }, 502);

  try {
    mailjet = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(env.MAILJET_API_KEY + ":" + env.MAILJET_SECRET_KEY),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        Messages: [
          {
            From: { Email: from },
            To: [{ Email: email }],
            Subject: "BYKO / card",
            TextPart: "Your card request was recorded.\nContract: " + BYKO
          },
          {
            From: { Email: from },
            To: [{ Email: notifyTo }],
            Subject: "BYKO / card request",
            TextPart: "card request: " + email + " · " + timestamp + " · " + clientIp(context.request)
          }
        ]
      })
    });
  } catch (error) {
    return json({ error: "send" }, 502);
  }
  if (!mailjet.ok || !await allMessagesSent(mailjet)) return json({ error: "send" }, 502);
  response = json({ ok: true }, 200);
  return response;
}

/* Mailjet v3.1 can answer 200 with per-message failures inside. */
async function allMessagesSent(response) {
  var payload;
  var i;
  try {
    payload = await response.json();
  } catch (error) {
    return false;
  }
  if (!payload || !Array.isArray(payload.Messages) || payload.Messages.length !== 2) return false;
  for (i = 0; i < payload.Messages.length; i++) {
    if (payload.Messages[i].Status !== "success") return false;
  }
  return true;
}
