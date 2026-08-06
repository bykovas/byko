/* BYKO donation card flow.
   The form on the page opens a dialog: donation amount, inscription and mail.
   Donate straight from a wallet (EIP-6963 / window.ethereum) or paste the tx
   hash of a donation already made; /api/card verifies it on Base and returns
   the filled card SVG plus a permanent link. Page stays usable without JS. */
(function () {
  "use strict";

  var DONATION_ADDRESS = "0x42873C60bC22424dBB4518DF7bE8b7F9eF4ac1D6"; /* keep in sync with functions/api/card.js */

  var BYKO_ADDRESS = "0x078bB16e24c8931fc007928c370422e5e38F4372";
  var BASE_CHAIN_ID = "0x2105";
  var TRANSFER_SELECTOR = "0xa9059cbb";
  var INSCRIPTION_MAX = 300;

  var form = document.getElementById("card-form");
  var formEmail = document.getElementById("card-email");
  var formStatus = document.getElementById("card-status");
  var dialog = document.getElementById("card-dialog");
  var closeButton = document.getElementById("card-dialog-close");
  var dialogForm = document.getElementById("card-dialog-form");
  var amountInput = document.getElementById("card-amount");
  var inscriptionInput = document.getElementById("card-inscription");
  var inscriptionCount = document.getElementById("card-inscription-count");
  var emailInput = document.getElementById("card-dialog-email");
  var donateButton = document.getElementById("card-donate");
  var haveTxButton = document.getElementById("card-have-tx");
  var txField = document.getElementById("card-tx-field");
  var txInput = document.getElementById("card-tx");
  var verifyButton = document.getElementById("card-verify");
  var status = document.getElementById("card-dialog-status");
  var result = document.getElementById("card-result");
  var cardImage = document.getElementById("card-image");
  var permalink = document.getElementById("card-permalink");
  var copyLink = document.getElementById("card-copy-link");
  var busy = false;
  var providers = [];

  if (!form || !dialog || typeof fetch !== "function") return;
  if (typeof dialog.showModal !== "function") return;

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

  function showStatus(className, text) {
    status.className = className;
    status.textContent = text;
  }

  function clearStatus() {
    status.className = "";
    status.textContent = "";
  }

  function setBusy(value) {
    busy = value;
    donateButton.disabled = value;
    verifyButton.disabled = value;
  }

  function validEmail(value) {
    return typeof value === "string" && value.length > 0 && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  /* "123.45" → wei BigInt, or null */
  function parseAmount(value) {
    var match = /^(\d+)(?:\.(\d{1,18}))?$/.exec(String(value).trim());
    if (!match) return null;
    var whole = BigInt(match[1]);
    var frac = match[2] ? BigInt(match[2].padEnd(18, "0")) : 0n;
    var wei = whole * 1000000000000000000n + frac;
    return wei > 0n ? wei : null;
  }

  function errorText(code) {
    if (code === "config") return "donations are not configured yet. try later.";
    if (code === "tx") return "that does not look like a tx hash.";
    if (code === "email") return "that does not look like a mail address.";
    if (code === "rate") return "too many requests. try later.";
    if (code === "tx_not_found") return "tx not found on Base. wait for confirmation and retry.";
    if (code === "tx_failed") return "that tx failed on-chain.";
    if (code === "no_byko_donation") return "no BYKO transfer to the donation address in that tx.";
    return "could not issue the card. try again.";
  }

  function showCard(data) {
    dialogForm.style.display = "none";
    showStatus("is-ok", "card " + data.serial + " issued" + (data.mailed === false ? " · mail failed, save the link" : " · link sent by mail"));
    cardImage.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(data.svg);
    permalink.textContent = data.url;
    permalink.href = data.url;
    result.style.display = "block";
  }

  function submitCard(txHash) {
    showStatus("", "");
    showStatus("is-ok", "verifying on Base…");
    setBusy(true);
    fetch("/api/card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        txHash: txHash,
        email: emailInput.value.trim(),
        inscription: inscriptionInput.value
      })
    }).then(function (response) {
      return response.json().then(function (data) { return { ok: response.ok, data: data }; });
    }).then(function (outcome) {
      if (!outcome.ok || !outcome.data || !outcome.data.ok) {
        showStatus("is-err", errorText(outcome.data && outcome.data.error));
        return;
      }
      showCard(outcome.data);
    }, function () {
      showStatus("is-err", "network error. the donation is safe — retry with the tx hash.");
    }).then(function () {
      setBusy(false);
    });
  }

  function pickProvider() {
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    if (providers.length > 0) return providers[0].provider;
    if (window.ethereum && typeof window.ethereum.request === "function") return window.ethereum;
    return null;
  }

  function ensureBase(provider) {
    return provider.request({ method: "eth_chainId" }).then(function (chainId) {
      if (String(chainId).toLowerCase() === BASE_CHAIN_ID) return;
      return provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BASE_CHAIN_ID }] });
    });
  }

  function donate() {
    var wei = parseAmount(amountInput.value);
    var provider;
    if (!validInputs(wei)) return;
    provider = pickProvider();
    if (!provider) {
      showStatus("is-err", "no wallet found. donate from any wallet, then use “I already donated” with the tx hash.");
      return;
    }
    setBusy(true);
    showStatus("is-ok", "waiting for wallet…");
    provider.request({ method: "eth_requestAccounts" }).then(function (accounts) {
      if (!accounts || !accounts[0]) throw { code: 4001 };
      return ensureBase(provider).then(function () {
        var data = TRANSFER_SELECTOR +
          DONATION_ADDRESS.slice(2).toLowerCase().padStart(64, "0") +
          wei.toString(16).padStart(64, "0");
        return provider.request({
          method: "eth_sendTransaction",
          params: [{ from: accounts[0], to: BYKO_ADDRESS, data: data }]
        });
      });
    }).then(function (txHash) {
      setBusy(false);
      txInput.value = txHash;
      submitCard(txHash);
    }, function (error) {
      setBusy(false);
      if (error && error.code === 4001) {
        showStatus("is-err", "cancelled in the wallet.");
      } else {
        showStatus("is-err", "wallet error. you can donate manually and paste the tx hash.");
      }
    });
  }

  function validInputs(wei) {
    if (!DONATION_ADDRESS) {
      showStatus("is-err", errorText("config"));
      return false;
    }
    if (wei === null && !txField.hidden) {
      /* amount is only needed for the wallet path; manual path skips it */
    } else if (wei === null) {
      showStatus("is-err", "enter the donation amount in BYKO.");
      return false;
    }
    if (!validEmail(emailInput.value.trim())) {
      showStatus("is-err", errorText("email"));
      return false;
    }
    return true;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    formStatus.className = "";
    formStatus.textContent = "";
    emailInput.value = formEmail.value;
    dialogForm.style.display = "";
    result.style.display = "none";
    clearStatus();
    if (!dialog.open) {
      dialog.showModal();
      dialog.focus({ preventScroll: true });
    }
  });

  inscriptionInput.addEventListener("input", function () {
    inscriptionCount.textContent = inscriptionInput.value.length + " / " + INSCRIPTION_MAX;
  });

  donateButton.addEventListener("click", function () {
    if (busy) return;
    donate();
  });

  haveTxButton.addEventListener("click", function () {
    txField.hidden = !txField.hidden;
    if (!txField.hidden) txInput.focus();
  });

  verifyButton.addEventListener("click", function () {
    var txHash = txInput.value.trim().toLowerCase();
    if (busy) return;
    if (!DONATION_ADDRESS) {
      showStatus("is-err", errorText("config"));
      return;
    }
    if (!/^0x[0-9a-f]{64}$/.test(txHash)) {
      showStatus("is-err", errorText("tx"));
      return;
    }
    if (!validEmail(emailInput.value.trim())) {
      showStatus("is-err", errorText("email"));
      return;
    }
    submitCard(txHash);
  });

  copyLink.addEventListener("click", function () {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(permalink.href).then(function () {
        copyLink.textContent = "copied";
        setTimeout(function () { copyLink.textContent = "copy"; }, 1500);
      }, function () {});
    }
  });

  closeButton.addEventListener("click", function () { dialog.close(); });
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) dialog.close();
  });
}());
