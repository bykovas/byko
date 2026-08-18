import { buildAnchor, buildFooter } from "../chrome";
import { buildIntro, buildShell } from "./shared";

export function why(): HTMLElement {
  return buildShell(
    "why",
    "ink",
    buildAnchor("why · 01/04"),
    buildIntro({
      ghost: "37",
      ghostStyle: { left: "6px", top: "46px" },
      headline: "A stranger pays you first. Then asks if he's lying.",
      subline: "He publishes claims about his own project. Somebody has to check them against the chain.",
    }),
    buildFooter({ label: "Next", route: "how", progress: 1 }),
  );
}
