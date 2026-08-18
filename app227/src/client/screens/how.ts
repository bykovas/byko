import { buildAnchor, buildFooter } from "../chrome";
import { buildIntro, buildShell } from "./shared";

export function how(): HTMLElement {
  return buildShell(
    "how",
    "ink",
    buildAnchor("how · 02/04"),
    buildIntro({
      ghost: "1",
      ghostStyle: { left: "14px", top: "24px", fontSize: "320px" },
      headline: "",
      headlineHtml: ["One claim.", "One check.", "One minute."],
      subline: "Read the claim. Open the evidence. Say what you found.",
    }),
    buildFooter({ label: "Next", route: "claim", progress: 2 }),
  );
}
