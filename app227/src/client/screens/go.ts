import { buildAnchor, buildFooter } from "../chrome";
import { buildIntro, buildShell } from "./shared";

export function go(): HTMLElement {
  return buildShell(
    "go",
    "ink",
    buildAnchor("go · 04/04"),
    buildIntro({
      ghost: "284",
      ghostStyle: { left: "0", top: "40px", fontSize: "190px" },
      headline: "Everything here is public.",
      headlineSize: "50px",
      subline: "Method, contract, transfers, checks, verdicts.",
      tiny: "byko.bykovas.lt",
    }),
    buildFooter({ label: "Start", route: "check", progress: 4, variant: "key" }),
  );
}
