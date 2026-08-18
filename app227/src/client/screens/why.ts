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
      /* owner-approved rewrite of the byko.html line, 18 Aug 2026 */
      headline: "The founder pays you first. Then asks you to verify a fact — if you want.",
      subline: "He publishes claims about his own project. Somebody has to check them against the chain.",
    }),
    buildFooter({ label: "Next", route: "how", progress: 1 }),
  );
}
