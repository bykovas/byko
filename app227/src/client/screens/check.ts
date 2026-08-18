import { buildButton, buildPlainHeader, navigate } from "../chrome";
import { append, element } from "../dom";
import { castAnswer, getState } from "../state";
import { buildShell, buildSource } from "./shared";

const SEAL_DELAY_MS = 400;

function sealAfterSelection(button: HTMLButtonElement): void {
  button.classList.add("selected");
  button.setAttribute("aria-pressed", "true");
  window.setTimeout(() => {
    /* still on this screen — the hash may already have been rewritten to
       #/sealed by a day that closed while the selection was showing */
    if (!button.isConnected) return;
    if (location.hash === "#/sealed") dispatchEvent(new Event("hashchange"));
    else navigate("sealed");
  }, SEAL_DELAY_MS);
}

export function check(): HTMLElement {
  const { check: claim, checks, checkIndex } = getState();
  /* which fact of the day this is — never the yes-count: consensus shown
     before the answer would nudge the answer */
  const header = buildPlainHeader(
    `check #${String(claim.number).padStart(3, "0")}`,
    `fact ${checkIndex + 1} of ${checks.length} today`,
  );
  const mid = element("div", "mid top");
  append(mid, element("div", "lab", `claim · diary ${claim.entry}`), element("div", "claim", claim.text));

  const sources = element("div", "sources");
  append(sources, buildSource(claim.sources[0], 0), buildSource(claim.sources[1], 1, true));
  mid.append(sources, element("p", "q", claim.question));

  const answers = element("div", "ans");
  const yes = element("button", "a", "Yes");
  const no = element("button", "a", "No — and I'll say why");
  const cannotVerify = element("button", "a", "Can't verify");
  yes.type = no.type = cannotVerify.type = "button";

  let answering = false;
  const answerButtons = [yes, no, cannotVerify];
  const choose = (button: HTMLButtonElement): boolean => {
    if (answering) return false;
    answering = true;
    for (const sibling of answerButtons) {
      if (sibling !== button) sibling.disabled = true;
    }
    button.classList.add("selected");
    button.setAttribute("aria-pressed", "true");
    return true;
  };

  yes.addEventListener("click", () => {
    if (!choose(yes)) return;
    castAnswer("yes", null);
    sealAfterSelection(yes);
  });
  cannotVerify.addEventListener("click", () => {
    if (!choose(cannotVerify)) return;
    castAnswer("cant", null);
    sealAfterSelection(cannotVerify);
  });
  no.addEventListener("click", () => {
    if (!choose(no)) return;

    // PROVISIONAL: argument input, awaiting owner design review.
    const argument = element("div", "argument");
    const input = element("textarea", "argument-text");
    input.setAttribute("aria-label", "No — and I'll say why");
    /* not once: the empty-value guard must not consume the only listener */
    const send = buildButton("Send", "default", (button) => {
      const argument = input.value.trim();
      if (!argument) return;
      button.disabled = true;
      castAnswer("no", argument);
      if (button.isConnected && location.hash === "#/check") navigate("sealed");
    }, false);
    send.className = "argument-send";
    send.disabled = true;
    input.addEventListener("input", () => {
      send.disabled = input.value.trim().length === 0;
    });
    append(argument, input, send);
    answers.append(argument);
    input.focus();
  });

  append(answers, yes, no, cannotVerify);
  mid.append(answers);
  return buildShell("check", "doc", header, mid, element("div", "spacer"));
}
