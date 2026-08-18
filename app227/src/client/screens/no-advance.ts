import { buildAnchor, buildFooter } from "../chrome";
import { buildIntro, buildShell } from "./shared";

export function noAdvance(): HTMLElement {
  return buildShell(
    "no-advance",
    "ink",
    buildAnchor("take it · 03/04"),
    buildIntro({
      headline: "No advance this time.",
      subline: "Nothing was sent. If that looks wrong, cast @bykocoin with your wallet address.",
      tiny: "Out of advances for today? Try tomorrow.",
    }),
    buildFooter({ label: "Next", route: "go", progress: 3 }),
  );
}
