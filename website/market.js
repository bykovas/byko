/* Progressive enhancement for market and holder data read directly from Base. */
(function () {
  "use strict";

  var BYKO = "0x078bB16e24c8931fc007928c370422e5e38F4372";
  var USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  var POOL = "0x02dd4285ad38ea93d021ca854016a839b0b2a6ca";
  var RPC_URLS = ["https://mainnet.base.org", "https://base.drpc.org"];
  /* Denominations and the ECB rate: fetching a quote per amount used to mean
     one getAmountsOut RPC per row in every visitor's browser, against public
     endpoints that already answer this project "over rate limit". The worker
     measures the pool's reserves and the ECB rate once and serves them with the
     time they were taken; the browser then computes each euro amount from those
     two numbers with the router's own constant-product formula (the 0.3% fee
     included) — verified identical to getAmountsOut to the whole BYKO — so a
     free-form converter costs nothing extra and every row agrees with it. The
     pool price above is still read straight from the chain in the browser, as
     the lede promises. */
  var POOL_API = "https://byko-market.bykovas.lt/api/pool";
  var EUR_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 250, 400, 500, 750, 1000, 1500];
  var RATES_CACHE_KEY = "byko-rates-v4";
  var RATES_MAX_AGE = 3 * 60 * 1000;
  var rates = null;
  var GENESIS_BYKO = 740227;
  var GENESIS_USDC = 74.0227;
  var POOL_HALVINGS = 6;   /* halvings per side; axis spans 1.6%…6400% of genesis */
  var latestBlock = null;
  var holdersUpdated = null;
  var tierOrder = ["whale", "shark", "dolphin", "fish", "crab", "shrimp"];
  var donutMode = "holders"; /* "holders" | "supply" — holders is the default view */
  var tiersCache = null;

  if (typeof BigInt !== "function" || typeof fetch !== "function") return;

  function byId(id) {
    return document.getElementById(id);
  }

  function hideLoading(id) {
    var badge = byId(id);
    if (badge) badge.hidden = true;
  }

  function balanceOfData(address) {
    return "0x70a08231" + address.slice(2).toLowerCase().padStart(64, "0");
  }

  function requestMarket(rpcIndex) {
    var url = RPC_URLS[rpcIndex || 0];
    if (!url) return Promise.reject(new Error("rpc"));
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: BYKO, data: balanceOfData(POOL) }, "latest"] },
        { jsonrpc: "2.0", id: 2, method: "eth_call", params: [{ to: USDC, data: balanceOfData(POOL) }, "latest"] },
        { jsonrpc: "2.0", id: 3, method: "eth_blockNumber", params: [] }
      ])
    }).then(function (response) {
      if (!response.ok) throw new Error("rpc");
      return response.json();
    }).then(function (items) {
      var values = {};
      var i;
      if (!items || !items.length) throw new Error("rpc");
      for (i = 0; i < items.length; i++) {
        if (items[i].error || !items[i].result || items[i].result === "0x") throw new Error("rpc");
        values[items[i].id] = items[i].result;
      }
      if (!values[1] || !values[2] || !values[3]) throw new Error("rpc");
      return {
        byko: Number(BigInt(values[1])) / 1e18,
        usdc: Number(BigInt(values[2])) / 1e6,
        block: parseInt(values[3], 16)
      };
    }).catch(function (error) {
      if ((rpcIndex || 0) + 1 < RPC_URLS.length) return requestMarket((rpcIndex || 0) + 1);
      throw error;
    });
  }

  function utcTime(date) {
    return date.toISOString().slice(11, 16) + " UTC";
  }

  /* The block number renders as soon as the RPC answers, even while the
     holders API is unavailable — the chain part must not depend on it. */
  function updateHoldersMeta() {
    var meta = byId("holders-updated");
    if (!meta || latestBlock === null) return;
    meta.textContent = "updated " + (holdersUpdated ? utcTime(holdersUpdated) : "—") +
      " · block " + latestBlock.toLocaleString("en-US");
  }

  function renderMarket(data) {
    var price = data.usdc / data.byko;
    /* The pool holds a constant product, so bykoRel and usdcRel are exact
       reciprocals — one number places the edge. log2 keeps every halving of a
       reserve the same distance, which is what stops a large buy from
       collapsing the bar: at $2,500 bought the edge sits at 7.3% instead of
       the 0.08% a linear split would give. Genesis stays pinned at 50%. */
    function poolEdge(rel) {
      var steps = Math.log(rel) / Math.LN2;
      return {
        pos: Math.max(0, Math.min(100, 50 + 50 * (steps / POOL_HALVINGS))),
        offScale: Math.abs(steps) > POOL_HALVINGS
      };
    }
    var bykoPct = data.byko / GENESIS_BYKO * 100;
    var usdcPct = data.usdc / GENESIS_USDC * 100;
    var marketPrice = byId("market-price");
    var priceSub = byId("price-sub");
    var marketByko = byId("market-byko");
    var marketUsdc = byId("market-usdc");
    var marketUpdated = byId("market-updated");
    var bykoLabel = byId("market-byko-label");
    var usdcLabel = byId("market-usdc-label");
    var poolBar = document.querySelector(".pool-bar");
    var indexPrice = byId("index-price");
    /* the hero readout carries the bare figure; its unit lives in the label */
    var indexPriceFigure = byId("index-price-figure");

    if (!isFinite(price) || price <= 0) throw new Error("price");
    latestBlock = data.block;
    if (marketPrice) marketPrice.textContent = (price * 100).toFixed(4);
    if (priceSub) priceSub.textContent = "1 BYKO = " + price.toFixed(6) + " USDC";

    var bykoRel = data.byko / GENESIS_BYKO;
    var edge = poolEdge(bykoRel);
    if (poolBar) {
      poolBar.style.setProperty("--split", edge.pos.toFixed(2) + "%");
      poolBar.setAttribute("data-off-scale", edge.offScale ? "true" : "false");
    }
    /* The figure keeps the bare number; the percentage moves to the label line
       (mono is data only; a label is not data). */
    if (marketByko) marketByko.textContent = "~" + Math.round(data.byko).toLocaleString("en-US");
    if (marketUsdc) marketUsdc.textContent = "~" + Math.round(data.usdc).toLocaleString("en-US");
    if (bykoLabel) bykoLabel.textContent = "BYKO in pool · " + Math.round(bykoPct) + "% of genesis" +
      (edge.offScale ? " · off scale" : "");
    if (usdcLabel) usdcLabel.textContent = Math.round(usdcPct) + "% of genesis · USDC in pool";
    if (marketUpdated) marketUpdated.textContent = "updated " + utcTime(new Date());
    if (indexPrice) indexPrice.textContent = "1 BYKO = " + price.toFixed(6) + " USDC";
    if (indexPriceFigure) indexPriceFigure.textContent = price.toFixed(6);
    hideLoading("price-loading");
    updateHoldersMeta();
  }

  function loadMarket(retry) {
    requestMarket().then(function (data) {
      renderMarket(data);
    }).catch(function () {
      if (retry) loadMarket(false);
    });
  }

  /* ---------- denominations: what a euro buys ---------- */

  function readCache() {
    try {
      var raw = window.localStorage.getItem(RATES_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) { return null; }
  }

  function writeCache(value) {
    try { window.localStorage.setItem(RATES_CACHE_KEY, JSON.stringify(value)); } catch (error) { /* private mode */ }
  }

  /* Whole BYKO, thousands separated by a thin space. */
  function fmtInt(n) {
    return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u2009");
  }

  /* Free text, not <input type=number>: the spinners were noise at 40px and the
     comma decimal is what a European keyboard actually produces. */
  function parseEur(raw) {
    var n = parseFloat(String(raw == null ? "" : raw).replace(",", ".").replace(/\s/g, ""));
    return isFinite(n) && n > 0 ? n : null;
  }

  /* USDC in, BYKO out \u2014 the pool's constant product with the 0.3% fee, the same
     arithmetic getAmountsOut runs (checked equal to the whole BYKO). One helper
     feeds both the fixed rows and the converter, so they can never disagree. */
  function bykoOut(usdc) {
    if (!rates || !(rates.reserveByko > 0) || !(rates.reserveUsdc > 0) || !(usdc > 0)) return null;
    var inWithFee = usdc * 0.997;
    return rates.reserveByko * inWithFee / (rates.reserveUsdc + inWithFee);
  }
  function bykoForEur(eur) {
    if (!rates || !rates.eur || !(rates.eur.rate > 0)) return null;
    return bykoOut(eur * rates.eur.rate);
  }

  /* One quote list, emitted twice -- the second copy aria-hidden, since it is
     the same data. Both the tape and the calculator read through bykoForEur,
     which is what keeps them from ever disagreeing. */
  function quoteHtml(eur) {
    var byko = bykoForEur(eur);
    return '<span class="q"><span class="eur">' + eur.toLocaleString("de-DE") + " €</span>" +
      "<b>" + (byko != null ? fmtInt(byko) : "—") + "</b>" +
      '<span class="unit">byko</span></span>';
  }

  function renderTape() {
    var track = byId("rates-track");
    var tape = byId("rates-tape");
    var html = "";
    var i;
    if (!track) return;
    for (i = 0; i < EUR_STEPS.length; i++) html += quoteHtml(EUR_STEPS[i]);
    /* Two copies: translateX(-50%) then lands on the start of the second and the
       loop has no seam. The duplicate is decorative -- the label carries the data. */
    track.innerHTML = html + html.replace(/<span class="q">/g, '<span class="q" aria-hidden="true">');
    if (tape) {
      tape.setAttribute("aria-label", "Euro denominations quoted in BYKO: " +
        EUR_STEPS.map(function (e) {
          var b = bykoForEur(e);
          return e + " euro buys " + (b != null ? fmtInt(b) : "no quote yet") + " BYKO";
        }).join(", "));
    }
  }

  /* The calculator: a free-form euro amount, quoted the same way as the tape.
     The per-euro line is the price impact made visible -- it falls as the
     amount rises, the one thing the block asserts in prose and otherwise never
     shows. */
  function updateConvert() {
    var input = byId("convert-eur");
    var out = byId("convert-byko");
    var eff = byId("convert-eff");
    var eur, byko;
    if (!input || !out) return;
    eur = parseEur(input.value);
    byko = eur != null ? bykoForEur(eur) : null;
    out.textContent = byko != null ? fmtInt(byko) : "—";
    if (eff) {
      eff.textContent = byko != null
        ? fmtInt(byko / eur) + " BYKO per € at this size"
        : "each size gets its own rate — larger orders get worse ones";
    }
  }

  function renderRates() {
    var note = byId("rates-note");
    renderTape();
    updateConvert();
    if (!note) return;
    if (!rates || !rates.eur) { note.textContent = "asking the pool\u2026"; return; }
    note.textContent =
      "1 EUR = " + rates.eur.rate.toFixed(4) + " USD \u00B7 " +
      (rates.eur.live ? "ECB reference rate, " + rates.eur.date
                      : "hand-set fallback, the rate feed did not answer") +
      " \u00B7 1 USDC treated as 1 USD \u00B7 computed from the pool's reserves with the router's constant product, 0.3% fee and price impact included" +
      (rates.block ? " \u00B7 block " + rates.block.toLocaleString("en-US") : "") +
      " \u00B7 measured " + utcTime(new Date(rates.at)) +
      (rates.stale ? " \u00B7 the recompute failed, this is the last reading that succeeded" : "") +
      " \u00B7 rounded down to whole BYKO";
  }

  function loadRates() {
    var cached = readCache();
    if (cached && cached.reserveByko && cached.reserveUsdc && cached.eur) {
      rates = cached;
      renderRates();
      if (Date.now() - Date.parse(cached.at) < RATES_MAX_AGE) return;
    }
    fetch(POOL_API).then(function (response) {
      if (!response.ok) throw new Error("pool");
      return response.json();
    }).then(function (d) {
      if (!d || !d.reserve_token || !d.reserve_usdc || !d.eur) throw new Error("pool");
      rates = {
        at: d.measured_at, block: d.block, eur: d.eur,
        reserveByko: Number(d.reserve_token) / 1e18,
        reserveUsdc: Number(d.reserve_usdc) / 1e6,
        stale: Boolean(d.stale)
      };
      writeCache(rates);
      renderRates();
    }).catch(function () {
      /* Absence stays visible: whatever is on screen keeps its own timestamp,
         and an empty grid keeps its dashes. */
      if (!rates) renderRates();
    });
  }

  function computeArcs(mode) {
    var i;
    var tier;
    var info;
    var supply;
    var entry;
    var entries = [];
    var total = 0;
    var scale;
    var largest = null;
    var boost = 0;
    var MIN_ARC = 1.5; /* a populated tier is never thinner than this */

    if (!tiersCache) return entries;
    for (i = 0; i < tierOrder.length; i++) {
      tier = tierOrder[i];
      info = tiersCache[tier];
      if (!info) continue;
      supply = Number(info.supply);
      if (!isFinite(supply) || supply < 0) supply = 0;
      entry = {
        tier: tier,
        count: typeof info.count === "number" ? info.count : 0
      };
      entry.value = mode === "holders" ? entry.count : supply;
      entries.push(entry);
      total += entry.value;
    }
    /* Supply shares already arrive as percentages; holder counts need
       normalising to the populated total. */
    scale = mode === "holders" ? (total > 0 ? 100 / total : 0) : 1;
    for (i = 0; i < entries.length; i++) entries[i].arc = entries[i].value * scale;
    /* A dominant tier squeezes other populated tiers into invisible 0-width
       arcs (whales can hold ~100% of supply). Give those tiers a minimum
       visible arc and take the difference out of the largest one — the
       table keeps the exact numbers. */
    for (i = 0; i < entries.length; i++) {
      if (largest === null || entries[i].arc > largest.arc) largest = entries[i];
    }
    for (i = 0; i < entries.length; i++) {
      entry = entries[i];
      if (entry !== largest && entry.count > 0 && entry.arc < MIN_ARC) {
        boost += MIN_ARC - entry.arc;
        entry.arc = MIN_ARC;
      }
    }
    if (largest && boost > 0) largest.arc = Math.max(0, largest.arc - boost);
    return entries;
  }

  function renderDonut() {
    var i;
    var cumulative = 0;
    var segment;
    var entries = computeArcs(donutMode);
    var svg = document.querySelector("#holders-donut .donut-wrap svg");

    for (i = 0; i < entries.length; i++) {
      segment = document.querySelector('.seg[data-tier="' + entries[i].tier + '"]');
      if (segment) {
        segment.setAttribute("stroke-dasharray", entries[i].arc + " " + (100 - entries[i].arc));
        segment.setAttribute("stroke-dashoffset", 25 - cumulative);
      }
      cumulative += entries[i].arc;
    }
    if (svg) svg.setAttribute("aria-label", donutMode === "holders" ? "Holders by tier" : "Supply by holder tier");
  }

  function initDonutMode() {
    var buttons = document.querySelectorAll(".mode-btn");
    var i;

    function onModeClick() {
      var mode = this.getAttribute("data-mode");
      var all = document.querySelectorAll(".mode-btn");
      var j;
      if (mode === donutMode) return;
      donutMode = mode;
      for (j = 0; j < all.length; j++) all[j].classList.toggle("is-active", all[j] === this);
      renderDonut();
    }

    for (i = 0; i < buttons.length; i++) buttons[i].addEventListener("click", onModeClick);
  }

  function renderHolders(data) {
    var i;
    var tier;
    var row;
    var share;
    var count = byId("holders-count");
    var center = document.querySelector(".donut-center b");

    if (!data || !data.tiers || typeof data.holders !== "number" || !data.updated) return;
    holdersUpdated = new Date(data.updated);
    if (isNaN(holdersUpdated.getTime())) return;
    hideLoading("holders-loading");
    if (center) center.textContent = data.holders.toLocaleString("en-US");
    if (count) count.textContent = "holders / " + data.holders.toLocaleString("en-US");
    for (i = 0; i < tierOrder.length; i++) {
      tier = tierOrder[i];
      if (!data.tiers[tier]) continue;
      share = Number(data.tiers[tier].supply);
      if (!isFinite(share) || share < 0) share = 0;
      row = document.querySelector('.tier-row[data-tier="' + tier + '"]');
      if (row) {
        row.querySelector(".tier-holders").textContent = typeof data.tiers[tier].count === "number" ? data.tiers[tier].count.toLocaleString("en-US") : "—";
        /* a real but tiny share must not read as zero */
        row.querySelector(".tier-supply").textContent =
          (share > 0 && share < 0.1 ? share.toFixed(2) : share.toFixed(1)) + "%";
      }
    }
    tiersCache = data.tiers;
    renderExcluded(data.excluded, data.circulating);
    renderDonut();
    updateHoldersMeta();
  }

  /* The pair contract and the burn address are not holdings, but dropping
     them without a word would be hiding 61% of the supply. */
  function renderExcluded(excluded, circulating) {
    var note = byId("holders-excluded");
    var parts = [];
    if (!note) return;
    if (!excluded) { note.hidden = true; return; }
    if (excluded.pool && excluded.pool.balance > 0) {
      parts.push("pool " + Math.round(excluded.pool.balance).toLocaleString("en-US") +
        " BYKO · " + excluded.pool.pct.toFixed(1) + "% of supply — LP burned, withdrawable by nobody");
    }
    if (excluded.burned && excluded.burned.balance > 0) {
      parts.push("burned " + Math.round(excluded.burned.balance).toLocaleString("en-US") +
        " BYKO · " + excluded.burned.pct.toFixed(1) + "%");
    }
    if (!parts.length) { note.hidden = true; return; }
    note.textContent = "not counted as holders: " + parts.join(" · ") +
      (typeof circulating === "number"
        ? " · shares above are of circulating " + Math.round(circulating).toLocaleString("en-US") + " BYKO"
        : "");
    note.hidden = false;
  }

  /* The endpoint rebuilds its balance checkpoint over several requests when
     it has fallen behind; while it does, it answers {syncing:true} instead
     of publishing a mid-history state as current. Keep asking rather than
     leaving the donut empty. */
  function loadHolders(attempt) {
    var tries = attempt || 0;
    var meta;
    if (!byId("holders-donut")) return;
    /* The worker keeps an hourly copy; the Pages function that rebuilds the
       index from Transfer logs on every request stays as the fallback. */
    fetch("https://byko-market.bykovas.lt/api/holders").then(function (response) {
      if (!response.ok) throw new Error("holders");
      return response.json();
    }).then(function (body) {
      return body && body.value ? body.value : body;
    }).catch(function () {
      return fetch("/api/holders").then(function (response) {
        if (!response.ok) throw new Error("holders");
        return response.json();
      });
    }).then(function (data) {
      if (data && data.syncing) {
        hideLoading("holders-loading");
        meta = byId("holders-updated");
        if (meta) meta.textContent = "rebuilding the holder index · " +
          data.behind.toLocaleString("en-US") + " blocks behind";
        if (tries < 5) window.setTimeout(function () { loadHolders(tries + 1); }, 4000);
        return;
      }
      renderHolders(data);
    }, function () {
      hideLoading("holders-loading"); /* no data coming — stop pretending */
    });
  }

  /* The chart badge lives over the DEXTools iframe corner until it loads. */
  function watchChart() {
    var frame = byId("dextools-widget");
    if (!frame) return;
    frame.addEventListener("load", function () { hideLoading("chart-loading"); });
    window.setTimeout(function () { hideLoading("chart-loading"); }, 20000);
  }

  /* +10 / +50 / +100 / +500 add to the current amount; clear empties it. One
     listener on the row, delegated to the button that was clicked. */
  function initCalc() {
    var input = byId("convert-eur");
    var steps = document.querySelector(".calc .steps");
    if (input) input.addEventListener("input", updateConvert);
    if (!steps) return;
    steps.addEventListener("click", function (event) {
      var button = event.target.closest("button");
      var add;
      if (!button || !input) return;
      if (button.hasAttribute("data-clear")) {
        input.value = "";
      } else {
        add = parseFloat(button.getAttribute("data-add"));
        if (!isFinite(add)) return;
        input.value = String((parseEur(input.value) || 0) + add);
      }
      updateConvert();
      input.focus();
    });
  }

  loadMarket(true);
  window.setInterval(function () { loadMarket(true); }, 30000);
  loadRates();
  window.setInterval(loadRates, 180000);
  initCalc();
  initDonutMode();
  loadHolders();
  watchChart();
}());
