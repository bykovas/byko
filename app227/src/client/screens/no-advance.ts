import { buildAnchor, buildFooter } from "../chrome";
import { buildIntro, buildShell } from "./shared";

export function noAdvance(): HTMLElement {
  return buildShell(
    "no-advance",
    "ink",
    buildAnchor("take it · 03/04"),
    buildIntro({ headline: "No advance this time." }),
    buildFooter({ label: "Next", route: "go", progress: 3 }),
  );
}
