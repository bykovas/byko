import { apiAdvance } from "../api";
import { buildAnchor, buildFooter, navigate } from "../chrome";
import { getState, markClaimed } from "../state";
import { buildIntro, buildProfilePlate, buildShell } from "./shared";

const BEAT_MS = 900;
const delay = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/* the hero coin comes alive while the treasury signs; the button just waits */
function startRolling(): void {
  document.querySelector(".scr .coin")?.classList.add("rolling");
}

export function claim(): HTMLElement {
  return buildShell(
    "claim",
    "money",
    buildAnchor("take it · 03/04"),
    buildIntro({
      ghost: "227",
      ghostStyle: { right: "-8px", bottom: "6px", fontSize: "200px" },
      coin: true,
      headline: "Take it now.",
      subline: "Before anything is asked of you.",
      extra: buildProfilePlate(),
    }),
    buildFooter({
      label: "Claim",
      progress: 3,
      variant: "key",
      onClick(button) {
        button.disabled = true;
        startRolling();
        /* the demo detour never touches the network */
        if (getState().noAdvance) {
          void delay(BEAT_MS).then(() => {
            if (button.isConnected && location.hash === "#/claim") navigate("no-advance");
          });
          return;
        }
        /* ask the treasury; hold the beat either way so the moment reads */
        void Promise.all([apiAdvance(), delay(BEAT_MS)]).then(([outcome]) => {
          if (!button.isConnected || location.hash !== "#/claim") return;
          if (outcome.advanced && outcome.tx_hash) {
            markClaimed(outcome.tx_hash, outcome.tx_url ?? null);
            navigate("paid");
            return;
          }
          if (outcome.reason === "offline") {
            /* the anonymous site preview only — the prototype beat lives on
               there; every authed path now answers with the truth */
            markClaimed();
            navigate("paid");
            return;
          }
          /* refusals and unknowns: limits, closed faucet, or an authed call
             that failed mid-flight — never a false "paid" */
          navigate("no-advance");
        });
      },
    }),
  );
}
