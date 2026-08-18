import { apiAdvance } from "../api";
import { buildAnchor, buildFooter, navigate } from "../chrome";
import { getState, markClaimed } from "../state";
import { buildIntro, buildProfilePlate, buildShell } from "./shared";

const BEAT_MS = 900;
const delay = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

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
        /* ask the treasury; hold the beat either way so the moment reads */
        void Promise.all([apiAdvance(), delay(BEAT_MS)]).then(([outcome]) => {
          if (!button.isConnected || location.hash !== "#/claim") return;
          if (getState().noAdvance) {
            navigate("no-advance");
            return;
          }
          if (outcome.advanced && outcome.tx_hash) {
            markClaimed(outcome.tx_hash);
            navigate("paid");
            return;
          }
          if (outcome.reason === "not-open" || outcome.reason === "offline") {
            /* faucet not live yet — the prototype beat, as before */
            markClaimed();
            navigate("paid");
            return;
          }
          /* a real refusal: limits or a closed faucet */
          navigate("no-advance");
        });
      },
    }),
  );
}
