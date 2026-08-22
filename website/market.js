/* Progressive enhancement for market and holder data read directly from Base. */
(function () {
  "use strict";

  var BYKO = "0x078bB16e24c8931fc007928c370422e5e38F4372";
  var USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  var POOL = "0x02dd4285ad38ea93d021ca854016a839b0b2a6ca";
  var RPC_URLS = ["https://mainnet.base.org", "https://base.drpc.org"];
  /* Aerodrome's router and the factory its Route struct wants. The quote for
     each euro denomination is getAmountsOut against these — not the spot price
     multiplied out — so the 0.3% fee and the price impact are already in the
     number the page prints. */
  var ROUTER = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43";
  var FACTORY = "0x420DD381b31aEf6683db6B902084cB0FFECe40Da";
  var QUOTE_SELECTOR = "0x5509a1ac"; /* getAmountsOut(uint256,(address,address,bool,address)[]) */
  var EUR_STEPS = [1, 5, 10, 20, 50, 100, 200, 500, 1000];
  var EUR_FALLBACK = 1.17;   /* hand-set; the note says when it is in force */
  var RATES_CACHE_KEY = "byko-rates-v2";
  var RATES_MAX_AGE = 5 * 60 * 1000;   /* nine extra eth_calls are not worth
                                          repeating on the 30 s price tick */
  var EUR_MAX_AGE = 12 * 60 * 60 * 1000; /* the ECB publishes once a day */
  var lastPrice = null;
  var eurUsd = null, eurLive = false, eurDate = "";
  var rates = null;          /* { at, block, source, rows: [[eur, byko]] } */
  var GENESIS_BYKO = 740227;
  var GENESIS_USDC = 74.0227;
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
    var bykoRelative = data.byko / GENESIS_BYKO;
    var usdcRelative = data.usdc / GENESIS_USDC;
    var split = bykoRelative / (bykoRelative + usdcRelative) * 100;
    var displaySplit = Math.max(8, Math.min(92, split));
    var marketPrice = byId("market-price");
    var priceSub = byId("price-sub");
    var marketByko = byId("market-byko");
    var marketUsdc = byId("market-usdc");
    var bykoLabel = byId("market-byko-label");
    var usdcLabel = byId("market-usdc-label");
    var bykoDelta = (data.byko / GENESIS_BYKO - 1) * 100;
    var usdcDelta = data.usdc - GENESIS_USDC;
    var marketUpdated = byId("market-updated");
    var poolBar = document.querySelector(".pool-bar");
    var indexPrice = byId("index-price");
    /* the hero readout carries the bare figure; its unit lives in the label */
    var indexPriceFigure = byId("index-price-figure");

    if (!isFinite(price) || price <= 0) throw new Error("price");
    lastPrice = price;
    latestBlock = data.block;
    if (marketPrice) marketPrice.textContent = (price * 100).toFixed(4);
    if (priceSub) priceSub.textContent = "1 BYKO = " + price.toFixed(6) + " USDC";
    /* Whole numbers with a leading ~: four decimals overflow the bar on a
       phone, and the exact reserves are one click away on BaseScan. */
    if (marketByko) marketByko.textContent = "~" + Math.round(data.byko).toLocaleString("en-US");
    if (marketUsdc) marketUsdc.textContent = "~" + Math.round(data.usdc).toLocaleString("en-US");
    if (bykoLabel) bykoLabel.textContent = "BYKO in pool (~" + (bykoDelta >= 0 ? "+" : "") + Math.round(bykoDelta) + "%)";
    if (usdcLabel) usdcLabel.textContent = "USDC in pool (~" + (usdcDelta >= 0 ? "+" : "") + Math.round(usdcDelta) + " USDC)";
    if (marketUpdated) marketUpdated.textContent = "updated " + utcTime(new Date());
    if (poolBar) poolBar.style.setProperty("--split", displaySplit.toFixed(1) + "%");
    if (indexPrice) indexPrice.textContent = "1 BYKO = " + price.toFixed(6) + " USDC";
    if (indexPriceFigure) indexPriceFigure.textContent = price.toFixed(6);
    hideLoading("price-loading");
    updateHoldersMeta();
  }

  function loadMarket(retry) {
    requestMarket().then(function (data) {
      renderMarket(data);
      loadRates();
    }).catch(function () {
      if (retry) loadMarket(false);
    });
  }

  /* ---------- denominations: what a euro buys ---------- */

  function pad64(hex) {
    return String(hex).replace(/^0x/, "").toLowerCase().padStart(64, "0");
  }

  /* getAmountsOut(amountIn, [Route{from,to,stable,factory}]). The head is the
     amount and the offset to the array; the Route tuple is static, so its four
     words sit inline after the array length. */
  function quoteData(usdcUnits) {
    return QUOTE_SELECTOR +
      pad64(usdcUnits.toString(16)) +
      pad64("40") +
      pad64("1") +
      pad64(USDC.slice(2)) +
      pad64(BYKO.slice(2)) +
      pad64("0") +
      pad64(FACTORY.slice(2));
  }

  /* amounts[1] of a two-element uint256[]: offset, length, in, out. */
  function decodeQuote(hex) {
    var body = String(hex).replace(/^0x/, "");
    if (body.length < 256) throw new Error("quote");
    return BigInt("0x" + body.slice(192, 256));
  }

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

  /* Three, not nine. DRPC's free plan refuses a batch of more than three and
     reports the refusal INSIDE an HTTP 200, one error object per element — so
     a nine-call batch comes back looking like a successful response full of
     nothing. Ask in threes and check every element: a refusal must never reach
     the page dressed as a number. */
  var QUOTE_BATCH = 3;

  function requestChunk(url, from) {
    var batch = [];
    var i;
    for (i = from; i < Math.min(from + QUOTE_BATCH, EUR_STEPS.length); i++) {
      batch.push({
        jsonrpc: "2.0", id: i + 1, method: "eth_call",
        params: [{ to: ROUTER, data: quoteData(BigInt(Math.round(EUR_STEPS[i] * eurUsd * 1e6))) }, "latest"]
      });
    }
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch)
    }).then(function (response) {
      if (!response.ok) throw new Error("rpc");
      return response.json();
    }).then(function (items) {
      var out = [];
      var j;
      if (!items || items.length !== batch.length) throw new Error("rpc");
      for (j = 0; j < items.length; j++) {
        if (items[j].error || !items[j].result || items[j].result === "0x") throw new Error("rpc");
      }
      items.sort(function (a, b) { return a.id - b.id; });
      for (j = 0; j < items.length; j++) {
        out.push([EUR_STEPS[items[j].id - 1], Number(decodeQuote(items[j].result)) / 1e18]);
      }
      return out;
    });
  }

  function requestQuotes(rpcIndex) {
    var url = RPC_URLS[rpcIndex || 0];
    var rows = [];
    if (!url || !eurUsd) return Promise.reject(new Error("rpc"));
    /* sequential, so a node that is merely rate-limited is not hammered */
    return [0, QUOTE_BATCH, QUOTE_BATCH * 2].reduce(function (chain, from) {
      return chain.then(function () {
        return requestChunk(url, from).then(function (part) { rows = rows.concat(part); });
      });
    }, Promise.resolve()).then(function () {
      if (rows.length !== EUR_STEPS.length) throw new Error("rpc");
      return rows;
    }).catch(function (error) {
      if ((rpcIndex || 0) + 1 < RPC_URLS.length) return requestQuotes((rpcIndex || 0) + 1);
      throw error;
    });
  }

  function renderRates() {
    var grid = byId("rates-grid");
    var note = byId("rates-note");
    var html = "";
    var rows = rates && rates.rows;
    var i;
    var taken;
    if (!grid) return;
    for (i = 0; i < EUR_STEPS.length; i++) {
      html += '<div><span class="eur">' + EUR_STEPS[i].toLocaleString("de-DE") + "\u2009\u20AC</span>" +
        '<b class="byko">' + (rows && rows[i] ? fmtInt(rows[i][1]) : "\u2014") + "</b></div>";
    }
    grid.innerHTML = html;
    if (!note) return;
    if (!rows) {
      note.textContent = eurUsd
        ? "quoting the router\u2026"
        : "waiting for the EUR/USD reference rate";
      return;
    }
    taken = new Date(rates.at);
    note.textContent =
      "1 EUR = " + rates.eurUsd.toFixed(4) + " USD \u00B7 " +
      (rates.eurLive ? "ECB reference rate, " + rates.eurDate
                     : "hand-set fallback, the rate feed did not answer") +
      " \u00B7 1 USDC treated as 1 USD \u00B7 " +
      (rates.source === "router"
        ? "quoted from Aerodrome's router, fee and price impact included"
        : "the router did not answer \u2014 these are the spot price multiplied out, so they ignore price impact and read better than a real swap would") +
      (rates.block ? " \u00B7 block " + rates.block.toLocaleString("en-US") : "") +
      " \u00B7 updated " + utcTime(taken) +
      " \u00B7 rounded down to whole BYKO";
  }

  function loadRates() {
    var now = Date.now();
    if (!eurUsd) return;
    if (rates && rates.at && now - Date.parse(rates.at) < RATES_MAX_AGE) return;
    requestQuotes().then(function (rows) {
      rates = { at: new Date(now).toISOString(), block: latestBlock, source: "router",
        eurUsd: eurUsd, eurLive: eurLive, eurDate: eurDate, rows: rows };
      writeCache(rates);
      renderRates();
    }).catch(function () {
      /* Absence has to stay visible: fall back to the spot price, and say in
         the note that these figures ignore what a real order would cost. */
      var rows = [];
      var i;
      if (!lastPrice) return;
      for (i = 0; i < EUR_STEPS.length; i++) {
        rows.push([EUR_STEPS[i], EUR_STEPS[i] * eurUsd / lastPrice]);
      }
      rates = { at: new Date(now).toISOString(), block: latestBlock, source: "spot",
        eurUsd: eurUsd, eurLive: eurLive, eurDate: eurDate, rows: rows };
      writeCache(rates);
      renderRates();
    });
  }

  function loadEur() {
    var cached = readCache();
    /* Show the last known table straight away, stamped with when it was taken,
       rather than nine dashes while the network decides. */
    if (cached && cached.rows && cached.rows.length === EUR_STEPS.length) {
      rates = cached;
      eurUsd = cached.eurUsd; eurLive = cached.eurLive; eurDate = cached.eurDate;
      renderRates();
    }
    if (cached && cached.eurLive && Date.now() - Date.parse(cached.at) < EUR_MAX_AGE) {
      loadRates();
      return;
    }
    fetch("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD").then(function (r) {
      if (!r.ok) throw new Error("eur");
      return r.json();
    }).then(function (d) {
      var rate = d && d.rates && Number(d.rates.USD);
      if (!isFinite(rate) || rate <= 0) throw new Error("eur");
      eurUsd = rate; eurLive = true; eurDate = d.date;
      rates = null;
      loadRates();
    }).catch(function () {
      eurUsd = EUR_FALLBACK; eurLive = false; eurDate = "";
      rates = null;
      loadRates();
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
    fetch("/api/holders").then(function (response) {
      if (!response.ok) throw new Error("holders");
      return response.json();
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

  loadMarket(true);
  window.setInterval(function () { loadMarket(true); }, 30000);
  loadEur();
  initDonutMode();
  loadHolders();
  watchChart();
}());
