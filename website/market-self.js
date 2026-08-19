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

  /* A value asked for but not yet received: three monospace cells with the dash
     stepping between them. One shared ticker drives every placeholder, and each
     starts on a random frame — identical phases would make the whole page beat
     in unison and read as one wave rather than many small independent waits. */
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
  function cellDash(cls) {
    var td = el("td", cls);
    td.appendChild(dash());
    return td;
  }

  /* What we ask each source, known before any answer arrives. The server sends
     the same list with the data; this copy exists only so the labels can be on
     screen while the request is in flight, and is replaced wholesale by the
     real render. */
  var ASKING = [
    ["metamask-price", "price or refusal"], ["metamask-token", "aggregators"],
    ["goplus", "risk verdict"], ["dexscreener", "pair listed"],
    ["geckoterminal", "locked liquidity"], ["coingecko", "contract known"],
    ["cmc-dex", "pool priced"], ["cmc-index", "ticker known"],
    ["blockscout", "holders / reputation"], ["uniswap-list", "present"],
    ["1inch-list", "present"], ["base-app", "what the screen says (by hand)"],
  ];
  var ARM_LABELS = [["byko", "BYKO Buyer"], ["luko", "LUKO Buyer"]];
  var ARM_FIELDS = ["price", "FDV", "pool TVL", "holders", "USDC spent", "trades 24h", "LP burned"];

  /* Draw everything that is known without the network: the rules strip, both
     arm panels, every source row, one trade line and one log line. */
  function renderSkeleton() {
    var rules = $("rules"); rules.textContent = "";
    ["declared", "interval", "size", "pivot", "slip", "hash", "switch", "commit"].forEach(function (k) {
      var span = el("span");
      span.appendChild(document.createTextNode(k + " "));
      span.appendChild(dash());
      rules.appendChild(span);
    });

    var wrap = $("arms"); wrap.textContent = "";
    ARM_LABELS.forEach(function (pair, i) {
      var box = el("div", "arm" + (i % 2 ? " right" : ""));
      box.appendChild(el("h3", null, pair[1] + " · " + pair[0].toUpperCase()));
      box.appendChild(el("div", "st", "reading…"));
      var dl = el("dl");
      ARM_FIELDS.forEach(function (f) {
        dl.appendChild(el("dt", null, f));
        var dd = el("dd"); dd.appendChild(dash()); dl.appendChild(dd);
      });
      box.appendChild(dl);
      if (KEEPER_ARMS.indexOf(pair[0]) >= 0) box.appendChild(objection(pair[0], null, null));
      wrap.appendChild(box);
    });

    var table = $("checks");
    var thead = table.querySelector("thead"), tbody = table.querySelector("tbody");
    thead.textContent = ""; tbody.textContent = "";
    var htr = el("tr");
    htr.appendChild(el("th", "l", "source"));
    htr.appendChild(el("th", "l", "asks"));
    htr.appendChild(el("th", "l", "now"));
    thead.appendChild(htr);
    ARM_LABELS.forEach(function (pair) {
      var cap = el("tr");
      var c0 = el("td", "src", pair[0].toUpperCase());
      c0.colSpan = 3; c0.style.color = "var(--byko-label)";
      c0.style.fontWeight = "400"; c0.style.paddingTop = "10px";
      cap.appendChild(c0); tbody.appendChild(cap);
      ASKING.forEach(function (row) {
        var tr = el("tr");
        tr.appendChild(el("td", "src", row[0]));
        tr.appendChild(el("td", "asks", row[1]));
        tr.appendChild(cellDash("now"));
        tbody.appendChild(tr);
      });
    });

    ARM_LABELS.forEach(function (pair) {
      var t = $("trades-" + pair[0]);
      if (!t) return;
      var tb = t.querySelector("tbody");
      tb.textContent = "";
      var tr = el("tr");
      for (var i = 0; i < 10; i++) tr.appendChild(cellDash(i < 3 ? "l" : "mono"));
      tb.appendChild(tr);
    });

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
  /* Fixed decimals, not significant digits: a column of prices should line up.
     toPrecision gave $0.0002543 beside $0.003345 and the digits never met. */
  function price(v) {
    if (v === null || v === undefined || v === "") return "—";
    var x = Number(v);
    return isNaN(x) ? String(v) : "$" + x.toFixed(8);
  }

  function renderRules(data) {
    var box = $("rules"); box.textContent = "";
    var s = data.rules.strategy, v = data.rules.venue;
    var bits = [
      ["declared", data.rules.declared_at],
      ["interval", s.interval_minutes[0] + "–" + s.interval_minutes[1] + "m"],
      ["size", "$" + s.trade_usdc[0] + "–$" + s.trade_usdc[1]],
      ["pivot", "$" + s.pivot_usdc],
      ["slip", (s.slippage_bps / 100) + "%"],
      ["hash", data.rules.hash_ok ? "verified" : "MISMATCH"],
      ["switch", data.market_open ? "open" : "closed"],
    ];
    bits.forEach(function (b) {
      var span = el("span");
      span.appendChild(document.createTextNode(b[0] + " "));
      span.appendChild(el("b", null, b[1]));
      box.appendChild(span);
    });
    if (data.rules.git_commit) {
      var a = el("span");
      a.appendChild(document.createTextNode("commit "));
      a.appendChild(el("b", null, data.rules.git_commit.slice(0, 8)));
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
      /* The live chain read. "Burned" is the honest word: LP tokens at an
         address with no key, which nobody can withdraw. Calling the keeper's
         share "locked" would report LUKO as maximally safe while 100% of its
         LP sits in a founder wallet. */
      if (m.lp_locked != null) row("LP burned", m.lp_locked + "%", true);
      var keeper = m.lp_holder ? String(m.lp_holder).split(":") : null;
      if (keeper && keeper.length === 2) row("held by founder", keeper[1] + "%", true);
      box.appendChild(dl);
      if (arm.measured === false) {
        box.appendChild(el("div", "st",
          "Not measured: price and LP are read from the chain, nothing is asked of any classifier, so the market fields stay empty rather than guessed."));
      }
      if (KEEPER_ARMS.indexOf(arm.id) >= 0) {
        box.appendChild(objection(arm.id,
          keeper && keeper.length === 2 ? keeper[1] : null,
          keeper && keeper.length === 2 ? keeper[0] : null));
      }
      wrap.appendChild(box);
    });
  }

  /* Arms whose liquidity is NOT burned. The sentence below never changes — it
     is a standing disclosure, not a reading — so it is printed the moment the
     page opens and only the two figures inside it wait for the chain. */
  var KEEPER_ARMS = ["luko"];

  function objection(armId, pct, addr) {
    var box = el("div", "warn");
    box.appendChild(document.createTextNode(
      "The strongest objection to this arm, stated by us: " + armId.toUpperCase() +
      "'s liquidity is NOT burned. "));
    if (pct === null) box.appendChild(dash()); else box.appendChild(document.createTextNode(pct + "%"));
    box.appendChild(document.createTextNode(" of its LP tokens sit in "));
    if (addr === null) box.appendChild(dash());
    else box.appendChild(document.createTextNode(addr.slice(0, 10) + "…"));
    box.appendChild(document.createTextNode(
      ", a founder wallet, and can be withdrawn at any moment — unlike BYKO's, which is 100% at " +
      "0x…dEaD and gone forever. Both figures are read live so anyone can watch that it stays untouched."));
    return box;
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
      if (a.measured === false) return;   /* said in words below, not as dashes */
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

    /* Name the arms nobody is asking about, so an empty row is never mistaken
       for a measurement that came back empty. */
    var un = data.arms.filter(function (a) { return a.measured === false; });
    var noteBox = $("unmeasured");
    noteBox.textContent = "";
    if (un.length) {
      noteBox.appendChild(document.createTextNode(
        un.map(function (a) { return a.id.toUpperCase(); }).join(", ") +
        (un.length > 1 ? " are" : " is") +
        " not measured. Only the arm carrying the flag we are trying to clear is put to the classifiers; the other trades in the background and is read from the chain alone. Nothing was asked about it, so nothing is reported — the row is absent rather than empty."));
    }
  }

  /* The next fire time is known; nothing else about that trade is. Its size is
     drawn when the alarm goes off and its side depends on the balance at that
     moment, so the row shows the two facts we have — which arm, and when — and
     leaves the rest as the same running dash used for any value still in
     flight. A waiting row is a promise about the schedule, not about a trade. */
  function waitingRows(data, tbody) {
    (data.arms || []).forEach(function (a) {
      if (a.halted || !a.next_fire_at) return;
      var tr = el("tr");
      tr.appendChild(el("td", "l mono", "—"));
      tr.appendChild(el("td", "l mono", String(a.next_fire_at).replace("T", " ").slice(0, 19)));
      for (var i = 0; i < 6; i++) tr.appendChild(cellDash(i === 0 ? "l" : "mono"));
      var stat = el("td", "l");
      stat.appendChild(el("span", "pill", "waiting"));
      tr.appendChild(stat);
      tr.appendChild(el("td", "l mono", "—"));
      tbody.appendChild(tr);
    });
  }

  function renderTrades(data) {
    /* One table per arm: a single mixed ledger made the reader check the arm
       column on every row to know which token a number belonged to. */
    (data.arms || []).forEach(function (a) { renderArmTrades(data, a.id); });
  }

  function renderArmTrades(data, armId) {
    var table = $("trades-" + armId);
    if (!table) return;
    var tbody = table.querySelector("tbody");
    tbody.textContent = "";
    var rows = (data.trades || []).filter(function (t) { return t.arm === armId; });
    var counter = $("trades-n-" + armId);
    if (counter) counter.textContent = rows.length + " done";
    var arm = (data.arms || []).filter(function (a) { return a.id === armId; })[0];
    if (arm) waitingRows({ arms: [arm] }, tbody);
    if (!rows.length) {
      var tr = el("tr");
      var td = el("td", "l"); td.colSpan = 10;
      td.appendChild(el("span", "empty", data.market_open
        ? "No trades yet — the first alarm has not fired."
        : "No trades yet. The parameters are pre-registered; trading begins only when the kill switch opens."));
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

  /* These wallets existed before the worker did and traded on their own. The
     ledger below covers the worker's trades only, so a pool chart can legally
     show a trade this table does not — and a reader who spots that deserves to
     have been told first, not to catch us. */
  function renderLedgerScope(data) {
    var box = $("scope");
    if (!box) return;
    box.textContent = "";
    var started = data.arms
      .filter(function (a) { return a.started_at; })
      .map(function (a) { return a.id.toUpperCase() + " from " + a.started_at + " UTC"; });
    if (!started.length) {
      box.appendChild(document.createTextNode(
        "The ledger records the worker's own trades. It is empty until the worker makes one."));
      return;
    }
    box.appendChild(document.createTextNode(
      "This ledger records the worker's trades only — " + started.join(", ") +
      ". Both wallets are ordinary addresses that existed and traded before the worker was armed, so a pool chart will show earlier trades from them that are not listed here. LUKO Buyer, for one, bought $1.29 of LUKO on 18 August, the day before any of this started. Those were not the worker and are not claimed as its work."));
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
    renderRules(data); renderArms(data); renderChecks(data); renderTrades(data); renderLedgerScope(data); renderEvents(data);
  }

  function load() {
    $("meta").textContent = "reading the worker…";
    renderSkeleton();
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
