import { buildAnchor, buildFooter } from "../chrome";
import { markVisited } from "../state";
import { buildIntro, buildShell } from "./shared";

export function go(): HTMLElement {
  /* the pitch has been seen to the end — next visit skips the onboarding */
  markVisited();
  return buildShell(
    "go",
    "ink",
    buildAnchor("go · 04/04"),
    buildIntro({
      ghost: "284",
      ghostStyle: { left: "0", top: "40px", fontSize: "190px" },
      /* owner rewrite 18 Aug 2026 — reads right for new and returning users */
      headline: "Remember — everything here is public.",
      headlineSize: "50px",
      subline: "Method, contract, transfers, checks, verdicts.",
      tiny: "byko.bykovas.lt",
    }),
    buildFooter({ label: "Start", route: "check", progress: 4, variant: "key" }),
  );
}
