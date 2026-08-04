/* Progressive enhancement for adding BYKO with wallet_watchAsset.
   Providers are discovered via EIP-6963 with window.ethereum as a legacy
   fallback. The site never requests accounts and remains usable without JS. */
(function () {
  "use strict";

  var BYKO_ADDRESS = "0x078bB16e24c8931fc007928c370422e5e38F4372";
  var BASE_CHAIN_ID = "0x2105";
  var BASE_CHAIN_PARAMS = {
    chainId: BASE_CHAIN_ID,
    chainName: "Base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://mainnet.base.org"],
    blockExplorerUrls: ["https://basescan.org"]
  };
  var BYKO_TOKEN = {
    address: BYKO_ADDRESS,
    symbol: "BYKO",
    decimals: 18,
    image: new URL("assets/coin-512.png", document.baseURI).href
  };

  var button = document.getElementById("add-byko");
  var dialog = document.getElementById("wallet-dialog");
  var dialogBody = document.getElementById("wallet-dialog-body");
  var closeButton = document.getElementById("wallet-dialog-close");
  if (!button || !dialog || !dialogBody || !closeButton) return;
  if (typeof dialog.showModal !== "function") return;

  var providers = [];
  var busy = false;

  window.addEventListener("eip6963:announceProvider", function (event) {
    var detail = event && event.detail;
    if (!detail || !detail.info || !detail.provider || typeof detail.provider.request !== "function") return;
    for (var i = 0; i < providers.length; i++) {
      if (providers[i].info.uuid === detail.info.uuid) return;
      if (providers[i].info.rdns && providers[i].info.rdns === detail.info.rdns) return;
    }
    providers.push(detail);
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  button.hidden = false;

  function openDialog() {
    if (!dialog.open) dialog.showModal();
  }

  function clearBody() {
    while (dialogBody.firstChild) dialogBody.removeChild(dialogBody.firstChild);
  }

  function addMessage(text) {
    var message = document.createElement("p");
    message.className = "wallet-message";
    message.textContent = text;
    dialogBody.appendChild(message);
  }

  function copyAddress(copyButton) {
    function copied() {
      copyButton.textContent = "Copied";
      setTimeout(function () { copyButton.textContent = "Copy"; }, 1500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(BYKO_ADDRESS).then(copied, function () {});
      return;
    }
    var input = document.createElement("textarea");
    input.value = BYKO_ADDRESS;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    try { if (document.execCommand("copy")) copied(); } catch (error) {}
    document.body.removeChild(input);
  }

  function addContractFallback() {
    var address = document.createElement("code");
    address.className = "wallet-address";
    address.textContent = BYKO_ADDRESS;
    dialogBody.appendChild(address);

    var actions = document.createElement("div");
    actions.className = "wallet-actions";
    var copy = document.createElement("button");
    copy.type = "button";
    copy.className = "btn btn-ghost";
    copy.textContent = "Copy";
    copy.addEventListener("click", function () { copyAddress(copy); });
    actions.appendChild(copy);
    dialogBody.appendChild(actions);
  }

  function addMetaMaskLink() {
    var actions = dialogBody.querySelector(".wallet-actions");
    if (!actions) return;
    var link = document.createElement("a");
    link.className = "btn btn-ghost";
    link.href = "https://metamask.app.link/dapp/" + location.host + location.pathname;
    link.rel = "noopener";
    link.textContent = "Open in MetaMask →";
    actions.appendChild(link);
  }

  function showResult(text) {
    clearBody();
    addMessage(text);
    openDialog();
  }

  function showFallback() {
    clearBody();
    addMessage("BYKO could not be added. You can add it manually with the contract address.");
    addContractFallback();
    openDialog();
  }

  function showNoWallet() {
    clearBody();
    addMessage("No compatible wallet was found. Use the contract address or open this page in MetaMask.");
    addContractFallback();
    addMetaMaskLink();
    openDialog();
  }

  function showWalletChoice() {
    clearBody();
    addMessage("Choose a wallet:");
    providers.forEach(function (entry) {
      var option = document.createElement("button");
      option.type = "button";
      option.className = "wallet-option";
      if (typeof entry.info.icon === "string" && /^data:image\/(png|jpeg|webp|gif);/i.test(entry.info.icon)) {
        var icon = document.createElement("img");
        icon.src = entry.info.icon;
        icon.alt = "";
        option.appendChild(icon);
      }
      var name = document.createElement("span");
      name.textContent = String(entry.info.name || "Wallet");
      option.appendChild(name);
      option.addEventListener("click", function () {
        clearBody();
        addMessage("Waiting for wallet…");
        runAdd(entry.provider);
      });
      dialogBody.appendChild(option);
    });
    openDialog();
  }

  function addToken(provider) {
    return provider.request({ method: "eth_chainId" }).then(function (chainId) {
      if (String(chainId).toLowerCase() === BASE_CHAIN_ID) return;
      return provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BASE_CHAIN_ID }]
      }).catch(function (error) {
        if (error && error.code === 4902) {
          return provider.request({
            method: "wallet_addEthereumChain",
            params: [BASE_CHAIN_PARAMS]
          });
        }
        throw error;
      });
    }).then(function () {
      return provider.request({
        method: "wallet_watchAsset",
        params: { type: "ERC20", options: BYKO_TOKEN }
      });
    });
  }

  function runAdd(provider) {
    if (busy) return;
    busy = true;
    button.disabled = true;
    addToken(provider).then(function (added) {
      showResult(added ? "BYKO added." : "BYKO was not added.");
    }, function (error) {
      if (error && error.code === 4001) {
        showResult("BYKO was not added.");
      } else {
        showFallback();
      }
    }).finally(function () {
      busy = false;
      button.disabled = false;
    });
  }

  button.addEventListener("click", function () {
    if (busy) return;
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    if (providers.length > 1) {
      showWalletChoice();
    } else if (providers.length === 1) {
      runAdd(providers[0].provider);
    } else if (window.ethereum && typeof window.ethereum.request === "function") {
      runAdd(window.ethereum);
    } else {
      showNoWallet();
    }
  });

  closeButton.addEventListener("click", function () { dialog.close(); });
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) dialog.close();
  });
})();
