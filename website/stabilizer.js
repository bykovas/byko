/* Stabilizer readout — reads the byko-market worker's /api/wash and draws the
   sixteenth amendment's stabilizer: the state card, the /market reserve axis
   carrying genesis, the reference with its dead band, and the live fact, a
   detail rail on its own ±20% scale, the decision in one line, one glyph per
   look today, the decisions table and the log. Every figure is what the
   stabilizer read and wrote at its last look; nothing here asks the chain.
   Vanilla, no framework. Blue only on figures that came from the chain. */
(function () {
  "use strict";
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var API = (LOCAL ? "http://127.0.0.1:8787" : "https://byko-market.bykovas.lt") + "/api/wash?limit=5";
  var SCAN = "https://basescan.org";
  var GENESIS_BYKO = 740227, GENESIS_USDC = 74.0227, HALVINGS = 6;
  var SPAN = Math.log(1.2);                 /* detail rail: ±20% of price */

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function set(id, text) { var n = $(id); if (n) n.textContent = text; }
  function cell(cls, text, label) {
    var td = el("td", cls, text);
    if (label) td.setAttribute("data-label", label);
    return td;
  }
  function money(n) { return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function px(n) { return "$" + Number(n).toFixed(7); }
  function pct(n) { return (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(1) + "%"; }
  function int(n) { return Math.round(n).toLocaleString("en-US"); }
  function short(h) { return h ? h.slice(0, 6) + "…" + h.slice(-4) : "—"; }
  function whole(raw, dp) { return raw == null || raw === "" ? null : Number(raw) / Math.pow(10, dp); }
  function utc(ts) { return ts ? String(ts).replace("T", " ").slice(0, 19) : "—"; }
  function hhmm(ts) { return ts ? String(ts).replace("T", " ").slice(11, 16) : "—"; }
  function clamp(x) { return Math.max(0, Math.min(100, x)); }
  function minutesUntil(ts) {
    var t = Date.parse(ts);
    if (!isFinite(t)) return null;
    return Math.max(0, Math.round((t - Date.now()) / 60000));
  }
  function txLink(hash) {
    var a = el("a", null, short(hash));
    a.href = SCAN + "/tx/" + hash; a.target = "_blank"; a.rel = "noopener";
    return a;
  }

  /* The /market axis: the pool state is one edge, the BYKO reserve as a
     number of halvings from genesis. A price maps to a BYKO reserve through
     the constant product k of the reading on screen. */
  function posMain(bykoReserve) {
    return 50 + 50 * (Math.log(bykoReserve / GENESIS_BYKO) / Math.LN2) / HALVINGS;
  }
  function posDtl(p, ref) { return 50 + 50 * Math.log(p / ref) / SPAN; }

  function renderRules(s) {
    set("r-th", s.threshold_pct + "%");
    set("r-damp", s.damp_pct + "%");
    set("r-every", s.check_minutes + " min");
  }

  function paint(data) {
    var s = data.stabilizer;
    var meta = $("meta");
    if (!s) {
      meta.textContent = "the stabilizer has not started — the worker has no record of it yet";
      set("s-status", "not started");
      set("s-say", "Not started. The rule is published; the stabilizer has not taken its first look.");
      return;
    }
    renderRules(s.rules);
    set("r-commit", data.rules && data.rules.git_commit ? data.rules.git_commit.slice(0, 8) : "—");

    var TH = s.rules.threshold_pct, DAMP = s.rules.damp_pct;
    var ref = s.reference ? Number(s.reference.price) : null;
    var live = s.live ? Number(s.live.price) : null;
    var hasRef = ref != null && live != null && s.live.reserve_token;
    var dev = hasRef ? (live / ref - 1) * 100 : null;
    var inside = hasRef && Math.abs(dev) <= TH;
    var next = s.next_check_at ? minutesUntil(s.next_check_at) : null;
    var look = s.live ? s.live.at : (s.last_look && s.last_look.at);

    meta.textContent = "last look " + (look ? utc(look) + " UTC" : "—") +
      (s.live && s.live.block ? " · block " + Number(s.live.block).toLocaleString("en-US") : "") +
      " · every " + s.rules.check_minutes + " min" +
      (s.halted ? " · halted (" + (s.halt_reason || "manual") + "), watching only" : "");
    if (data.rules && !data.rules.hash_ok) {
      meta.appendChild(document.createTextNode(" · "));
      meta.appendChild(el("span", "err", "rules hash MISMATCH — watching only"));
    }

    /* ── the card ── */
    set("s-ref", ref != null ? px(ref) : "—");
    set("s-live", live != null ? px(live) : "—");
    set("s-devcell", dev != null ? pct(dev) : "—");
    var status = {
      unset: "waiting for the first look",
      quiet: "inside the band",
      above: "above the band",
      below: "below the band",
      cannot: "cannot act · logged",
      acted: "acted · reference moves with its trade"
    }[s.state] || s.state;
    set("s-status", status);
    var w = s.wallet;
    set("s-wb", w && w.byko != null ? int(whole(w.byko, 18)) : "—");
    set("s-wu", w && w.usdc != null ? money(whole(w.usdc, 6)) : "—");
    set("s-we", w && w.eth != null ? whole(w.eth, 18).toFixed(4) : "—");
    var la = s.last_action;
    set("s-last", la
      ? la.side + " " + int(whole(la.settled_token || la.token_amount, 18)) + " BYKO · " + hhmm(la.at) + " UTC" +
        (la.status && la.status !== "confirmed" ? " · " + la.status : "")
      : "none yet");

    /* ── the readouts and the main axis ── */
    var rT = s.live ? whole(s.live.reserve_token, 18) : null;
    var rU = s.live ? whole(s.live.reserve_usdc, 6) : null;
    var k = rT && rU ? rT * rU : null;
    function bykoAt(p) { return Math.sqrt(k / p); }
    set("s-byko", rT ? "~" + int(rT) : "—");
    set("s-usdc", rU ? "~" + int(rU) : "—");
    set("s-byko-label", "BYKO in pool · " + (rT ? Math.round(rT / GENESIS_BYKO * 100) + "% of genesis" : "no reading"));
    set("s-usdc-label", (rU ? Math.round(rU / GENESIS_USDC * 100) + "% of genesis · " : "") + "USDC in pool");

    var bar = $("s-bar");
    if (bar && rT) {
      var edge = posMain(rT);
      bar.style.setProperty("--split", clamp(edge).toFixed(2) + "%");
      bar.setAttribute("data-off-scale", edge < 0 || edge > 100 ? "true" : "false");
    }
    var landPrice = hasRef ? ref * (1 + (dev / 100) * (1 - DAMP / 100)) : null;
    var showLand = hasRef && !inside && s.state !== "cannot" && s.state !== "acted";

    var band = $("s-band");
    if (band) {
      band.style.display = hasRef ? "" : "none";
      if (hasRef) {
        var a = posMain(bykoAt(ref * (1 + TH / 100))), b = posMain(bykoAt(ref * (1 - TH / 100)));
        band.style.left = Math.min(a, b).toFixed(3) + "%";
        band.style.width = Math.max(0.28, Math.abs(b - a)).toFixed(3) + "%";
      }
    }
    var refMain = $("s-ref-main");
    if (refMain) {
      refMain.style.display = hasRef ? "" : "none";
      if (hasRef) refMain.style.left = clamp(posMain(bykoAt(ref))).toFixed(3) + "%";
    }
    var landMain = $("s-land-main");
    if (landMain) {
      landMain.style.display = showLand ? "" : "none";
      if (showLand) landMain.style.left = clamp(posMain(bykoAt(landPrice))).toFixed(3) + "%";
    }

    /* ── the detail rail ── */
    var ticks = $("s-dtl-ticks");
    ticks.textContent = "";
    if (hasRef) {
      [-20, -10, -5, 0, 5, 10, 20].forEach(function (d) {
        var i = el("i", d === 0 ? "major" : null);
        i.style.left = posDtl(ref * (1 + d / 100), ref).toFixed(3) + "%";
        i.appendChild(el("span", null, d === 0 ? "0" : (d > 0 ? "+" : "−") + Math.abs(d) + "%"));
        ticks.appendChild(i);
      });
    }
    var zone = $("s-zone");
    zone.style.display = hasRef ? "" : "none";
    if (hasRef) {
      var za = clamp(posDtl(ref * (1 - TH / 100), ref)), zb = clamp(posDtl(ref * (1 + TH / 100), ref));
      zone.style.left = za.toFixed(3) + "%";
      zone.style.width = (zb - za).toFixed(3) + "%";
    }
    set("s-zone-label", "±" + TH + "% · nothing to do");
    $("s-ref-dtl").style.display = hasRef ? "" : "none";
    $("s-ref-dtl").style.left = "50%";
    var land = $("s-land");
    land.style.display = showLand ? "" : "none";
    if (showLand) land.style.left = clamp(posDtl(landPrice, ref)).toFixed(3) + "%";
    var fact = $("s-fact");
    var off = hasRef && Math.abs(Math.log(live / ref)) > SPAN;
    fact.style.display = hasRef ? "" : "none";
    if (hasRef) {
      var fx = clamp(posDtl(live, ref));
      fact.style.left = fx.toFixed(3) + "%";
      fact.classList.toggle("flip", fx > 68);
    }
    set("s-fact-label", hasRef ? px(live) + " · " + pct(dev) : "—");
    var offNote = $("s-offscale");
    offNote.hidden = !off;
    if (off) offNote.textContent = "the fact is off this rail — " + pct(dev) +
      " is outside ±20% of price · read it on the axis above, where it is still on scale";

    /* ── the decision, in one line ── */
    var devEl = $("s-dev");
    devEl.textContent = dev != null ? pct(dev) : "—";
    devEl.classList.toggle("quiet", dev == null || inside);
    var say, sub;
    var nextTxt = next == null ? "" : next === 0 ? "next look any moment" : "next look in " + next + " min";
    var it = s.intent;
    if (s.state === "unset" || !hasRef) {
      say = "No reference yet. The stabilizer has not taken its first full look at the pool, so there is nothing for a deviation to be measured against.";
      sub = "the first look sets the reference to the pool as it stands";
    } else if (s.state === "acted" && la) {
      var landed = la.landed_price && la.ref_price ? (Number(la.landed_price) / Number(la.ref_price) - 1) * 100 : null;
      say = "Acted. " + (la.side === "sell" ? "Sold " : "Bought ") + int(whole(la.settled_token || la.token_amount, 18)) +
        " BYKO for about " + money(whole(la.usdc_settled || la.usdc_amount, 6)) +
        "; that trade becomes the reference" + (landed != null ? ", and it landed at " + pct(landed) + " of the old one." : " once it is in the pool history.");
      sub = "tx " + short(la.tx_hash) + " · " + DAMP + "% traded back, " + (100 - DAMP) + "% left standing" + (nextTxt ? " · " + nextTxt : "");
    } else if (inside) {
      say = "Inside the ±" + TH + "% band. Nothing to do.";
      sub = (nextTxt ? nextTxt + " · " : "") + "the band is " + TH + "% of price either way";
    } else if (s.state === "cannot" && it) {
      var blockedWhy = it.blocked || "the wallet cannot act";
      say = (dev > 0 ? "Above" : "Below") + " the band by " + Math.abs(dev).toFixed(1) + "%, and the stabilizer cannot act: " + blockedWhy + ".";
      sub = "it would have " + (it.side === "sell"
        ? "sold ~" + int(whole(it.token, 18)) + " BYKO (about " + money(whole(it.usdc, 6)) + ")"
        : "bought about " + money(whole(it.usdc, 6)) + " of BYKO") +
        " to land at " + pct(it.land_pct) + " · the deviation stands and is logged";
    } else if (it) {
      var amount = it.side === "sell"
        ? "sells ~" + int(whole(it.token, 18)) + " BYKO (about " + money(whole(it.usdc, 6)) + ")"
        : "buys about " + money(whole(it.usdc, 6)) + " of BYKO";
      say = (dev > 0 ? "Above" : "Below") + " the band by " + Math.abs(dev).toFixed(1) +
        "%. At the next look the wallet " + amount + " to land at " + pct(it.land_pct) + " of the reference.";
      sub = (nextTxt ? nextTxt + " · " : "") + DAMP + "% of the move traded back, " + (100 - DAMP) +
        "% left standing · size from the reserves with the pool's 0.3% fee";
    } else {
      say = (dev > 0 ? "Above" : "Below") + " the band by " + Math.abs(dev).toFixed(1) + "%.";
      sub = nextTxt;
    }
    set("s-say", say);
    set("s-sub", sub || "");

    /* ── today's looks ── */
    var strip = $("s-checks");
    strip.textContent = "";
    (s.checks_today || []).forEach(function (c) {
      var glyph = c.kind === "sell" ? "▲" : c.kind === "buy" ? "▼" : c.kind === "cannot" ? "×"
        : c.kind === "skipped" ? "?" : "·";
      var i = el("i", c.kind === "none" ? null : c.kind, glyph);
      i.title = hhmm(c.at) + " UTC · " + c.kind;
      strip.appendChild(i);
    });
    if (!(s.checks_today || []).length) strip.appendChild(el("i", null, "no looks yet today"));

    renderDecisions(s);
    renderEvents(s);
  }

  function renderDecisions(s) {
    var tbody = $("decisions").querySelector("tbody");
    tbody.textContent = "";
    var rows = s.decisions || [];
    rows.forEach(function (r) {
      var tr = el("tr");
      tr.appendChild(cell("l lead", utc(r.at).slice(5, 16).replace(" ", " · "), "UTC"));
      var dv = r.dev_pct == null ? "—" : pct(Number(r.dev_pct));
      tr.appendChild(cell(Math.abs(Number(r.dev_pct || 0)) > s.rules.threshold_pct ? "pos" : null, dv, "deviation"));
      var dec = r.decision === "sell" || r.decision === "buy" ? r.decision
        : r.decision === "cannot" ? "cannot" : r.decision === "wait" ? "wait" : "none";
      var label = r.decision === "bootstrap" ? "reference set"
        : r.decision === "skipped" ? "skipped" : dec;
      tr.appendChild(cell("side " + dec + " l", label, "decision"));
      var tok = whole(r.settled_token || r.token_amount, 18);
      var usd = whole(r.usdc_settled || r.usdc_amount, 6);
      var acted = dec === "sell" || dec === "buy";
      tr.appendChild(cell(null, acted && tok != null ? int(tok) + " BYKO" : "—", "size"));
      tr.appendChild(cell(null, acted && usd != null ? money(usd)
        : r.decision === "cannot" || r.decision === "skipped" || r.decision === "wait" ? (r.note || "—") : "—", "value"));
      var landed = r.landed_price && r.ref_price ? pct((Number(r.landed_price) / Number(r.ref_price) - 1) * 100) : "—";
      tr.appendChild(cell(null, acted ? landed : "—", "landed at"));
      var txtd = cell("l", null, "tx");
      if (r.tx_hash) txtd.appendChild(txLink(r.tx_hash)); else txtd.textContent = "—";
      tr.appendChild(txtd);
      tbody.appendChild(tr);
    });
    (s.days || []).forEach(function (d) {
      var tr = el("tr", "day");
      tr.appendChild(cell("l lead", d.day, "UTC"));
      tr.appendChild(cell(null, d.checks + " looks", "deviation"));
      tr.appendChild(cell("l", "outside the band " + d.outside_band, "decision"));
      tr.appendChild(cell(null, "acted " + d.acted, "size"));
      tr.appendChild(cell(null, "could not " + d.could_not, "value"));
      tr.appendChild(cell(null, "—", "landed at"));
      tr.appendChild(cell("l", "—", "tx"));
      tbody.appendChild(tr);
    });
    if (!rows.length && !(s.days || []).length) {
      var tr = el("tr");
      var td = el("td", "l"); td.colSpan = 7;
      td.appendChild(el("span", "empty", "Nothing above 1% yet, and no action."));
      tr.appendChild(td); tbody.appendChild(tr);
    }
  }

  function renderEvents(s) {
    var box = $("events"); box.textContent = "";
    var evs = s.events || [];
    if (!evs.length) { box.appendChild(el("div", null, "nothing logged yet")); return; }
    evs.forEach(function (e) {
      var d = el("div");
      d.appendChild(el("span", "k", utc(e.at) + " · " + e.kind));
      d.appendChild(document.createTextNode(e.detail || ""));
      box.appendChild(d);
    });
  }

  function load() {
    $("meta").textContent = "reading the worker…";
    fetch(API + "&t=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        return r.json().then(function (body) {
          if (r.ok) return body;
          throw new Error(body && body.error ? body.error : "HTTP " + r.status);
        });
      })
      .then(paint)
      .catch(function (err) {
        var meta = $("meta");
        meta.textContent = "";
        meta.appendChild(el("span", "err", "could not read the stabilizer: " + String(err.message || err)));
        set("s-status", "no reading");
        set("s-say", "No reading. The worker's readout did not answer, so nothing on this page is current — the wallet's own decisions happen on chain and appear here when the readout comes back.");
        set("s-sub", "");
      });
  }

  var btn = $("refresh");
  if (btn) btn.addEventListener("click", load);
  load();
})();
