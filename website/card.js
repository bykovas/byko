/* Progressive enhancement for the card request form. */
(function () {
  "use strict";

  var form = document.getElementById("card-form");
  var email = document.getElementById("card-email");
  var status = document.getElementById("card-status");
  var submit;

  if (!form || !email || !status || typeof fetch !== "function") return;
  submit = form.querySelector(".btn");
  if (!submit) return;

  function showStatus(className, text) {
    status.className = className;
    status.textContent = text;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    submit.disabled = true;
    status.className = "";
    status.textContent = "";
    fetch("/api/card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.value })
    }).then(function (response) {
      if (response.status === 429) throw new Error("rate");
      if (!response.ok) throw new Error("send");
      return response.json();
    }).then(function (data) {
      if (!data || !data.ok) throw new Error("send");
      form.reset();
      showStatus("is-ok", "card requested. check your mail.");
    }, function (error) {
      showStatus("is-err", error && error.message === "rate" ? "too many requests. try later." : "could not send. try again.");
    }).then(function () {
      submit.disabled = false;
    });
  });
}());
