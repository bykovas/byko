/* Self-trading readout — reads the byko-market worker and renders the
   disclosure, the classifier grid and the trade log. Vanilla, no framework,
   same shape as the ledger page. No blue anywhere except the one genuinely
   live chain read (LUKO's LP balance): the trade log is recorded history. */
(function () {
  "use strict";
  var API = "https://byko-market.bykovas.lt/api/wash?limit=300";
  var SCAN = "https://basescan.org";

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function short(h) { return h ? h.slice(0, 6) + "…" + h.slice(-4) : "—"; }
  function n(v, d) {
    if (v === null || v === undefined || v === "") return "—";
    var x = Number(v);
    return isNaN(x) ? String(v) : x.toLocaleString("en-US", { maximumFractionDigits: d === undefined ? 2 : d });
  }
  function price(v) {
    if (v === null || v === undefined || v === "") return "—";
    var x = Number(v);
    return isNaN(x) ? String(v) : "$" + x.toPrecision(4);
  }

  function renderRules(data) {
    var box = $("rules"); box.textContent = "";
    var s = data.rules.strategy, v = data.rules.venue;
    var bits = [
      ["declared", data.rules.declared_at],
      ["interval", s.interval_minutes[0] + "–" + s.interval_minutes[1] + " min"],
      ["size", "$" + s.trade_usdc[0] + "–$" + s.trade_usdc[1]],
      ["pivot", "$" + s.pivot_usdc],
      ["slippage", (s.slippage_bps / 100) + "%"],
      ["hash", data.rules.hash_ok ? "verified" : "MISMATCH"],
      ["kill switch", data.market_open ? "open" : "closed"],
    ];
    bits.forEach(function (b) {
      var span = el("span");
      span.appendChild(document.createTextNode(b[0] + " "));
      span.appendChild(el("b", null, b[1]));
      box.appendChild(span);
    });
    if (data.rules.git_commit) {
      var a = el("span");
      a.appendChild(document.createTextNode("rules commit "));
      var link = el("b", null, data.rules.git_commit.slice(0, 10));
      a.appendChild(link);
      box.appendChild(a);
    }
  }

  function renderArms(data) {
    var wrap = $("arms"); wrap.textContent = "";
    data.arms.forEach(function (arm, i) {
      var box = el("div", "arm" + (i % 2 ? " right" : ""));
      box.appendChild(el("h3", null, arm.label + " · " + arm.id.toUpperCase()));
      var st = arm.halted ? "halted — " + (arm.halt_reason || "") :
        (data.market_open ? (arm.next_fire_at ? "running" : "armed") : "waiting for kill switch");
      box.appendChild(el("div", "st", st));
      var m = arm.market || {};
      var dl = el("dl");
      function row(k, v, live) {
        dl.appendChild(el("dt", null, k));
        dl.appendChild(el("dd", live ? "live" : null, v));
      }
      row("price", price(m.price_usd));
      row("FDV", m.fdv_usd ? "$" + n(m.fdv_usd) : "—");
      row("pool TVL", m.tvl_usd ? "$" + n(m.tvl_usd) : "—");
      row("holders", m.holders != null ? n(m.holders, 0) : "—");
      row("USDC spent", "$" + n(arm.usdc_spent));
      row("trades 24h", (m.buys_24h != null ? m.buys_24h : "?") + " / " + (m.sells_24h != null ? m.sells_24h : "?"));
      /* the one live chain read on this page — LUKO's LP is withdrawable */
      if (m.lp_locked != null) row("LP locked", m.lp_locked + "%", true);
      box.appendChild(dl);
      if (arm.id === "luko") {
        box.appendChild(el("div", "warn",
          "The strongest objection to this arm, stated by us: LUKO's LP is not burned — it is held by a founder wallet and can be withdrawn, unlike BYKO's, which is 100% at 0x…dEaD. The figure above is read live so anyone can watch it stays untouched."));
      }
      wrap.appendChild(box);
    });
  }

  function renderChecks(data) {
    var table = $("checks");
    var thead = table.querySelector("thead"), tbody = table.querySelector("tbody");
    thead.textContent = ""; tbody.textContent = "";
    var maxDay = 0;
    data.arms.forEach(function (a) {
      (a.checks || []).forEach(function (c) {
        (c.cells || []).forEach(function (x) { if (x.day > maxDay) maxDay = x.day; });
      });
    });
    var htr = el("tr");
    htr.appendChild(el("th", "l", "source"));
    htr.appendChild(el("th", "l", "asks"));
    htr.appendChild(el("th", "l", "now"));
    for (var d = 1; d <= maxDay; d++) htr.appendChild(el("th", null, "d" + d));
    thead.appendChild(htr);

    data.arms.forEach(function (a) {
      var cap = el("tr");
      var c0 = el("td", "src", a.id.toUpperCase());
      c0.colSpan = 3 + maxDay;
      c0.style.color = "var(--byko-label)";
      c0.style.fontWeight = "400";
      c0.style.paddingTop = "10px";
      cap.appendChild(c0);
      tbody.appendChild(cap);
      (a.checks || []).forEach(function (c) {
        var tr = el("tr");
        tr.appendChild(el("td", "src", c.source));
        tr.appendChild(el("td", "asks", c.asks));
        tr.appendChild(el("td", "now", c.now ? (c.now.ok ? (c.now.value || "—") : "?") : "—"));
        var byDay = {};
        (c.cells || []).forEach(function (x) { byDay[x.day] = x.state; });
        for (var d = 1; d <= maxDay; d++) {
          var s = byDay[d];
          var glyph = s === "changed" ? "▲" : s === "same" ? "·" : s === "missing" ? "?" : "";
          var cls = "g" + (s === "changed" ? " moved" : s === "missing" ? " miss" : "");
          tr.appendChild(el("td", cls, glyph));
        }
        tbody.appendChild(tr);
      });
    });
    $("checks-n").textContent = maxDay ? "day " + maxDay : "not started";
  }

  function renderTrades(data) {
    var tbody = $("trades").querySelector("tbody");
    tbody.textContent = "";
    var rows = data.trades || [];
    $("trades-n").textContent = rows.length + " shown";
    if (!rows.length) {
      var tr = el("tr");
      var td = el("td", "l"); td.colSpan = 11;
      td.appendChild(el("span", "empty", "No trades yet. The parameters are pre-registered; trading begins only when the kill switch opens."));
      tr.appendChild(td); tbody.appendChild(tr); return;
    }
    rows.forEach(function (t) {
      var buy = t.side === "buy";
      var usdc = t.usdc_settled || (Number(t.usdc_amount) * 1e6).toFixed(0);
      var usdcWhole = Number(usdc) / 1e6;
      var tok = t.token_amount ? Number(t.token_amount) / 1e18 : null;
      var poolUsdc = t.reserve_usdc_after ? Number(t.reserve_usdc_after) / 1e6 : null;
      var tr = el("tr");
      tr.appendChild(el("td", "l mono", t.id));
      tr.appendChild(el("td", "l mono", (t.decided_at || "").replace("T", " ").slice(0, 19)));
      tr.appendChild(el("td", "l", t.arm));
      tr.appendChild(el("td", "side " + (buy ? "buy" : "sell"), t.side));
      tr.appendChild(el("td", "mono", (buy ? "−" : "+") + n(usdcWhole, 4)));
      tr.appendChild(el("td", "mono", tok == null ? "—" : (buy ? "+" : "−") + n(tok, 0)));
      tr.appendChild(el("td", "mono", price(t.price_after || t.price_before)));
      tr.appendChild(el("td", "mono", t.fdv_after ? "$" + n(t.fdv_after) : "—"));
      tr.appendChild(el("td", "mono pos", poolUsdc == null ? "—" : "$" + n(poolUsdc)));
      var stat = el("td", "l");
      stat.appendChild(el("span", "pill", t.status));
      tr.appendChild(stat);
      var txtd = el("td", "l");
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
    var evs = data.events || [];
    if (!evs.length) { box.appendChild(el("div", null, "nothing logged")); return; }
    evs.forEach(function (e) {
      var d = el("div");
      d.appendChild(el("span", "k", (e.at || "").replace("T", " ").slice(0, 19) + " · " + (e.arm || "—") + " · " + e.kind));
      d.appendChild(document.createTextNode(e.detail || ""));
      box.appendChild(d);
    });
  }

  function render(data) {
    $("meta").innerHTML = "read " + new Date(data.generated).toISOString().replace("T", " ").slice(0, 19) +
      " UTC · kill switch <b>" + (data.market_open ? "open" : "closed") + "</b>" +
      (data.rules.hash_ok ? "" : " · <span class=\"err\">rules hash MISMATCH — worker will not trade</span>");
    renderRules(data); renderArms(data); renderChecks(data); renderTrades(data); renderEvents(data);
  }

  function load() {
    $("meta").textContent = "loading…";
    fetch(API + (API.indexOf("?") < 0 ? "?" : "&") + "t=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        return r.json().then(function (body) {
          if (r.ok) return body;
          throw new Error(body && body.error ? body.error : "HTTP " + r.status);
        });
      })
      .then(render)
      .catch(function (err) {
        var msg = String(err.message || err);
        if (/not pre-registered|no rules/.test(msg)) {
          $("meta").innerHTML = "The experiment is pre-registered but has not started. The parameters are committed; the worker begins only when the kill switch opens.";
        } else {
          $("meta").innerHTML = '<span class="err">could not read the readout: ' + msg + "</span>";
        }
      });
  }

  var btn = $("refresh");
  if (btn) btn.addEventListener("click", load);
  load();
})();
