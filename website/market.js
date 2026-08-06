/* Progressive enhancement for market and holder data read directly from Base. */
(function () {
  "use strict";

  var BYKO = "0x078bB16e24c8931fc007928c370422e5e38F4372";
  var USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  var POOL = "0x02dd4285ad38ea93d021ca854016a839b0b2a6ca";
  var RPC = "https://mainnet.base.org";
  var GENESIS_BYKO = 740227;
  var GENESIS_USDC = 74.0227;
  var latestBlock = null;
  var holdersUpdated = null;
  var tierOrder = ["whale", "shark", "dolphin", "fish", "crab", "shrimp"];

  if (typeof BigInt !== "function" || typeof fetch !== "function") return;

  function byId(id) {
    return document.getElementById(id);
  }

  function balanceOfData(address) {
    return "0x70a08231" + address.slice(2).toLowerCase().padStart(64, "0");
  }

  function requestMarket() {
    return fetch(RPC, {
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
    var marketUpdated = byId("market-updated");
    var poolBar = document.querySelector(".pool-bar");
    var indexPrice = byId("index-price");

    if (!isFinite(price) || price <= 0) throw new Error("price");
    latestBlock = data.block;
    if (marketPrice) marketPrice.textContent = (price * 100).toFixed(4);
    if (priceSub) priceSub.textContent = "1 BYKO = " + price.toFixed(6) + " USDC";
    if (marketByko) marketByko.textContent = data.byko.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    if (marketUsdc) marketUsdc.textContent = data.usdc.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    if (marketUpdated) marketUpdated.textContent = "updated " + utcTime(new Date());
    if (poolBar) poolBar.style.setProperty("--split", displaySplit.toFixed(1) + "%");
    if (indexPrice) indexPrice.textContent = "1 BYKO = " + price.toFixed(6) + " USDC";
    updateHoldersMeta();
  }

  function loadMarket(retry) {
    requestMarket().then(renderMarket).catch(function () {
      if (retry) loadMarket(false);
    });
  }

  function renderHolders(data) {
    var i;
    var cumulative = 0;
    var tier;
    var row;
    var segment;
    var share;
    var count = byId("holders-count");
    var center = document.querySelector(".donut-center b");

    if (!data || !data.tiers || typeof data.holders !== "number" || !data.updated) return;
    holdersUpdated = new Date(data.updated);
    if (isNaN(holdersUpdated.getTime())) return;
    if (center) center.textContent = data.holders.toLocaleString("en-US");
    if (count) count.textContent = "holders / " + data.holders.toLocaleString("en-US");
    for (i = 0; i < tierOrder.length; i++) {
      tier = tierOrder[i];
      if (!data.tiers[tier]) continue;
      share = Number(data.tiers[tier].supply);
      if (!isFinite(share) || share < 0) share = 0;
      row = document.querySelector('.tier-row[data-tier="' + tier + '"]');
      segment = document.querySelector('.seg[data-tier="' + tier + '"]');
      if (row) {
        row.querySelector(".tier-holders").textContent = typeof data.tiers[tier].count === "number" ? data.tiers[tier].count.toLocaleString("en-US") : "—";
        row.querySelector(".tier-supply").textContent = share.toFixed(1) + "%";
      }
      if (segment) {
        segment.setAttribute("stroke-dasharray", share + " " + (100 - share));
        segment.setAttribute("stroke-dashoffset", 25 - cumulative);
      }
      cumulative += share;
    }
    updateHoldersMeta();
  }

  function loadHolders() {
    if (!byId("holders-donut")) return;
    fetch("/api/holders").then(function (response) {
      if (!response.ok) throw new Error("holders");
      return response.json();
    }).then(renderHolders, function () {});
  }

  loadMarket(true);
  window.setInterval(function () { loadMarket(true); }, 30000);
  loadHolders();
}());
