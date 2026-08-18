import { buildAnchor, buildFooter, navigate } from "../chrome";
import { getState, markClaimed } from "../state";
import { buildIntro, buildProfilePlate, buildShell } from "./shared";

export function claim(): HTMLElement {
  return buildShell(
    "claim",
    "money",
    buildAnchor("take it · 03/04"),
    buildIntro({
      ghost: "227",
      ghostStyle: { right: "-8px", top: "24px", fontSize: "200px" },
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
        window.setTimeout(() => {
          if (!button.isConnected || location.hash !== "#/claim") return;
          if (getState().noAdvance) {
            navigate("no-advance");
            return;
          }
          markClaimed();
          navigate("paid");
        }, 900);
      },
    }),
  );
}
