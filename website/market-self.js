/* Self-trading readout — one token per page. The page names its token in
   <main data-token="byko">; this script reads the byko-market worker and
   renders only the arms trading that token: the pool card, the rules strip,
   the trade table with the next scheduled fires, and the log. Vanilla, no
   framework. Blue only on the figures read live from the chain. */
(function () {
  "use strict";
  var API = "https://byko-market.bykovas.lt/api/wash?limit=120";
  var SCAN = "https://basescan.org";
  var main = document.querySelector("main[data-token]");
  var TOKEN = main ? main.getAttribute("data-token") : "byko";
  var SYM = TOKEN.toUpperCase();

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  /* On a phone the header row is gone and every cell carries its own label,
     so a cell must know what column it came from. */
  function cell(cls, text, label) {
    var td = el("td", cls, text);
    if (label) td.setAttribute("data-label", label);
    return td;
  }
  function short(h) { return h ? h.slice(0, 6) + "…" + h.slice(-4) : "—"; }

  /* The arms of this page: every arm whose id starts with the token name
     (byko → byko; luko → luko, luko01, luko02). */
  function mine(arms) {
    return (arms || []).filter(function (a) { return a.id.indexOf(TOKEN) === 0; });
  }

  /* A value asked for but not yet received: three monospace cells with the dash
     stepping between them, each on its own random phase. */
  var FRAMES = ["-  ", " - ", "  -"];
  var loaders = [];
  var tick = 0;
  setInterval(function () {
    tick += 1;
    for (var i = 0; i < loaders.length; i++) {
      var n = loaders[i];
      if (!n.isConnected) { loaders.splice(i, 1); i -= 1; continue; }
      n.textContent = FRAMES[(tick + n._phase) % FRAMES.length];
    }
  }, 420);

  function dash() {
    var n = el("span", "load");
    n._phase = Math.floor(Math.random() * FRAMES.length);
    n.textContent = FRAMES[n._phase];
    loaders.push(n);
    return n;
  }
  function cellDash(cls, label) {
    var td = el("td", cls);
    if (label) td.setAttribute("data-label", label);
    td.appendChild(dash());
    return td;
  }

  var RULE_KEYS = ["declared", "interval", "modes", "size", "targets", "slip", "commit"];
  var CARD_FIELDS = ["price", "FDV", "pool USDC", "holders", "turnover", "trades 24h",
    "LP burned", "LP held by founders", "supply held by founders"];

  /* Draw everything that is known without the network. */
  function renderSkeleton() {
    var rules = $("rules"); rules.textContent = "";
    RULE_KEYS.forEach(function (k) {
      var span = el("span");
      span.appendChild(document.createTextNode(k + " "));
      span.appendChild(dash());
      rules.appendChild(span);
    });

    var wrap = $("arms"); wrap.textContent = "";
    var box = el("div", "arm");
    box.appendChild(el("h3", null, SYM + " / USDC pool"));
    var dl = el("dl");
    CARD_FIELDS.forEach(function (f) {
      dl.appendChild(el("dt", null, f));
      var dd = el("dd"); dd.appendChild(dash()); dl.appendChild(dd);
    });
    box.appendChild(dl);
    wrap.appendChild(box);

    var tb = $("trades").querySelector("tbody");
    tb.textContent = "";
    var tr = el("tr");
    var lab = ["", "utc", "side", "usdc", SYM, "price", "fdv", "pool usdc", "status", "tx"];
    for (var i = 0; i < 10; i++) tr.appendChild(cellDash(i === 0 ? "l mono lead" : (i < 3 ? "l" : "mono"), lab[i]));
    tb.appendChild(tr);

    var log = $("events"); log.textContent = "";
    var line = el("div");
    line.appendChild(el("span", "k", "reading "));
    line.appendChild(dash());
    log.appendChild(line);
  }

  function n(v, d) {
    if (v === null || v === undefined || v === "") return "—";
    var x = Number(v);
    return isNaN(x) ? String(v) : x.toLocaleString("en-US", { maximumFractionDigits: d === undefined ? 2 : d });
  }
  /* Fixed decimals, not significant digits: a column of prices should line up. */
  function price(v) {
    if (v === null || v === undefined || v === "") return "—";
    var x = Number(v);
    return isNaN(x) ? String(v) : "$" + x.toFixed(8);
  }

  /* Holder and trade counts arrive from a probe outside the Worker and are
     older than the chain reads beside them; print how old. */
  function ago(ts) {
    if (!ts) return "";
    var t = Date.parse(String(ts).replace(" ", "T") + "Z");
    if (!isFinite(t)) return "";
    var h = Math.floor((Date.now() - t) / 3600000);
    if (h < 1) return "";
    return h < 48 ? h + "h ago" : Math.floor(h / 24) + "d ago";
  }

  function renderRules(data) {
    var box = $("rules"); box.textContent = "";
    var s = data.rules.strategy;
    var modes = s.modes || [];
    var lo = null, hi = null;
    modes.forEach(function (m) {
      if (lo === null || m.interval_minutes[0] < lo) lo = m.interval_minutes[0];
      if (hi === null || m.interval_minutes[1] > hi) hi = m.interval_minutes[1];
    });
    var range = function (a) { return a ? "$" + a[0] + "–" + a[1] : "—"; };
    var bits = [
      ["declared", data.rules.declared_at],
      ["interval", lo !== null ? lo + "–" + hi + "m" : "—"],
      ["modes", modes.length ? modes.map(function (m) { return m.id + " " + m.weight + "%"; }).join(" · ") : "—"],
      ["size", "$" + s.trade_usdc[0] + "–$" + s.trade_usdc[1]],
      ["targets", range(s.run_floor_usdc) + " / " + range(s.run_ceiling_usdc)],
      ["slip", (s.slippage_bps / 100) + "%"],
      ["commit", data.rules.git_commit ? data.rules.git_commit.slice(0, 8) : "—"],
    ];
    bits.forEach(function (b) {
      var span = el("span");
      span.appendChild(document.createTextNode(b[0] + " "));
      span.appendChild(el("b", null, b[1]));
      box.appendChild(span);
    });
  }

  /* One card for the pool. Several arms may trade the same pool; the pool
     figures are the same for all of them, and turnover is their sum. */
  function renderCard(data) {
    var arms = mine(data.arms);
    var wrap = $("arms"); wrap.textContent = "";
    if (!arms.length) return;
    /* The collector's hourly sample sometimes comes back without a price when
       the RPC refuses it. The arm with a priced sample wins; failing that, the
       newest confirmed trade carries the same three figures, and says so. */
    var m = (arms.filter(function (a) { return a.market && a.market.price_usd; })[0] || arms[0]).market || {};
    var ids = arms.map(function (a) { return a.id; });
    var last = (data.trades || []).filter(function (t) {
      return ids.indexOf(t.arm) >= 0 && t.status === "confirmed" && t.price_after;
    })[0];
    var fromTrade = !m.price_usd && last;
    var tag = fromTrade ? " · last trade" : "";
    var box = el("div", "arm");
    box.appendChild(el("h3", null, SYM + " / USDC pool"));
    var dl = el("dl");
    function row(k, v, live) {
      dl.appendChild(el("dt", null, k));
      dl.appendChild(el("dd", live ? "live" : null, v));
    }
    var px = fromTrade ? last.price_after : m.price_usd;
    var fdv = fromTrade ? last.fdv_after : m.fdv_usd;
    var pool = fromTrade ? last.reserve_usdc_after : m.reserve_usdc;
    row("price", px ? price(px) + tag : "—");
    row("FDV", fdv ? "$" + n(fdv) + tag : "—");
    /* Read from the chain: the vendors disagree on what "TVL" counts. */
    row("pool USDC", pool ? "$" + n(Number(pool) / 1e6) + tag : "—", true);
    var hm = (arms.filter(function (a) { return a.market && a.market.holders != null; })[0] || {}).market || {};
    var hAge = hm.holders != null ? ago(hm.holders_at) : "";
    row("holders", hm.holders != null ? n(hm.holders, 0) + (hAge ? " · " + hAge : "") : "—");

    /* Turnover: USDC moved by confirmed trades on both sides, not buys minus
       sells. */
    var bought = 0, sold = 0;
    arms.forEach(function (a) {
      bought += Number(a.usdc_bought || 0);
      sold += Number(a.usdc_received || 0);
    });
    dl.appendChild(el("dt", null, "turnover"));
    var turnDd = el("dd", null, "$" + n(bought + sold));
    turnDd.appendChild(el("br"));
    turnDd.appendChild(document.createTextNode("buys $" + n(bought) + " · sells $" + n(sold)));
    dl.appendChild(turnDd);

    var tm = (arms.filter(function (a) { return a.market && a.market.buys_24h != null; })[0] || {}).market || {};
    var tAge = tm.buys_24h != null ? ago(tm.trades_at) : "";
    row("trades 24h", tm.buys_24h != null
      ? tm.buys_24h + " / " + (tm.sells_24h != null ? tm.sells_24h : "?") + (tAge ? " · " + tAge : "")
      : "—");
    /* "Burned" is LP at an address nobody holds a key to. "Held by founders"
       prints even at zero: a missing row would read as nothing to declare. */
    /* "?" is a read that failed, not a figure: leave those rows out rather
       than print "?%" or a zero that was never measured. */
    var lpOk = m.lp_locked != null && m.lp_locked !== "?";
    if (lpOk) row("LP burned", m.lp_locked + "%", true);
    var keeper = m.lp_holder ? String(m.lp_holder).split(":") : null;
    var keeperPct = keeper && keeper.length === 2 ? keeper[1] : "0.00";
    if (lpOk) row("LP held by founders", keeperPct + "%", true);
    if (m.founders_pct != null) row("supply held by founders", m.founders_pct + "%", true);
    box.appendChild(dl);
    wrap.appendChild(box);

    var scan = $("scan");
    if (scan && arms[0].pool) scan.href = SCAN + "/address/" + arms[0].pool;
  }

  /* The next scheduled fire of each arm. Side and size range are what the
     published rule yields right now ("by rule"), not a claim about a trade
     that has not happened; the fill itself stays a dash. */
  function waitingRows(data, arms, tbody) {
    arms.forEach(function (a) {
      if (a.halted || !a.next_fire_at) return;
      var tr = el("tr");
      var labels = ["side", "usdc", "token", "price", "fdv", "pool usdc"];
      tr.appendChild(cell("l mono lead", "next"));
      tr.appendChild(cell("l mono", String(a.next_fire_at).replace("T", " ").slice(0, 19), "utc"));
      if (a.next_side) {
        var mode = a.next_mode ? " · " + a.next_mode : "";
        var cpct = data.rules && data.rules.strategy && data.rules.strategy.contrarian_pct;
        var flips = cpct ? " · flips " + cpct + "%" : "";
        tr.appendChild(cell("l mono byrule",
          "by rule " + a.next_side.toUpperCase() + flips + mode, labels[0]));
      } else tr.appendChild(cellDash("l", labels[0]));
      if (a.next_size_max) {
        tr.appendChild(cell("mono byrule",
          "by rule $" + Number(a.next_size_min).toFixed(2) + "–" + Number(a.next_size_max).toFixed(2),
          labels[1]));
      } else tr.appendChild(cellDash("mono", labels[1]));
      for (var i = 2; i < 6; i++) tr.appendChild(cellDash("mono", labels[i]));
      var stat = cell("l", null, "status");
      stat.appendChild(el("span", "pill", "waiting"));
      tr.appendChild(stat);
      tr.appendChild(cell("l mono", "—", "tx"));
      tbody.appendChild(tr);
    });
  }

  function renderTrades(data) {
    var arms = mine(data.arms);
    var ids = arms.map(function (a) { return a.id; });
    var tbody = $("trades").querySelector("tbody");
    tbody.textContent = "";
    var all = (data.trades || []).filter(function (t) { return ids.indexOf(t.arm) >= 0; });
    var rows = all.slice(0, 10);
    $("trades-n").textContent = all.length > 10 ? "last 10" : all.length + " done";
    var upcoming = arms.slice().sort(function (a, b) {
      return String(a.next_fire_at).localeCompare(String(b.next_fire_at));
    });
    waitingRows(data, upcoming, tbody);
    if (!rows.length) {
      var tr = el("tr");
      var td = el("td", "l"); td.colSpan = 10;
      td.appendChild(el("span", "empty", "No trades yet."));
      tr.appendChild(td); tbody.appendChild(tr); return;
    }
    rows.forEach(function (t) {
      var buy = t.side === "buy";
      var usdc = t.usdc_settled || (Number(t.usdc_amount) * 1e6).toFixed(0);
      var tok = t.token_amount ? Number(t.token_amount) / 1e18 : null;
      var poolUsdc = t.reserve_usdc_after ? Number(t.reserve_usdc_after) / 1e6 : null;
      var tr = el("tr");
      tr.appendChild(cell("l mono lead", "#" + t.id));
      tr.appendChild(cell("l mono", (t.decided_at || "").replace("T", " ").slice(0, 19), "utc"));
      tr.appendChild(cell("side " + (buy ? "buy" : "sell"), t.side, "side"));
      tr.appendChild(cell("mono", (buy ? "−" : "+") + n(Number(usdc) / 1e6, 4), "usdc"));
      tr.appendChild(cell("mono", tok == null ? "—" : (buy ? "+" : "−") + n(tok, 0), SYM));
      tr.appendChild(cell("mono", price(t.price_after || t.price_before), "price"));
      tr.appendChild(cell("mono", t.fdv_after ? "$" + n(t.fdv_after) : "—", "fdv"));
      tr.appendChild(cell("mono pos", poolUsdc == null ? "—" : "$" + n(poolUsdc), "pool usdc"));
      var stat = cell("l", null, "status");
      stat.appendChild(el("span", "pill", t.status));
      tr.appendChild(stat);
      var txtd = cell("l", null, "tx");
      if (t.tx_hash) {
        var a = el("a", null, short(t.tx_hash));
        a.href = SCAN + "/tx/" + t.tx_hash; a.target = "_blank"; a.rel = "noopener";
        txtd.appendChild(a);
      } else { txtd.textContent = "—"; }
      tr.appendChild(txtd);
      tbody.appendChild(tr);
    });
  }

  function renderEvents(data) {
    var box = $("events"); box.textContent = "";
    var ids = mine(data.arms).map(function (a) { return a.id; });
    var evs = (data.events || []).filter(function (e) { return ids.indexOf(e.arm) >= 0; }).slice(0, 25);
    if (!evs.length) { box.appendChild(el("div", null, "nothing logged")); return; }
    evs.forEach(function (e) {
      var d = el("div");
      d.appendChild(el("span", "k", (e.at || "").replace("T", " ").slice(0, 19) + " · " + e.kind));
      d.appendChild(document.createTextNode(e.detail || ""));
      box.appendChild(d);
    });
  }

  function render(data) {
    $("meta").innerHTML = "read " + new Date(data.generated).toISOString().replace("T", " ").slice(0, 19) + " UTC" +
      (data.rules.hash_ok ? "" : " · <span class=\"err\">rules hash MISMATCH — worker will not trade</span>");
    renderRules(data); renderCard(data); renderTrades(data); renderEvents(data);
  }

  function load() {
    $("meta").textContent = "reading the worker…";
    renderSkeleton();
    fetch(API + "&t=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        return r.json().then(function (body) {
          if (r.ok) return body;
          throw new Error(body && body.error ? body.error : "HTTP " + r.status);
        });
      })
      .then(render)
      .catch(function (err) {
        $("meta").innerHTML = '<span class="err">could not read the readout: ' +
          String(err.message || err).replace(/</g, "&lt;") + "</span>";
      });
  }

  var btn = $("refresh");
  if (btn) btn.addEventListener("click", load);
  load();
})();
