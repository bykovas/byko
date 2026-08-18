import { buildAnchor, buildFooter } from "../chrome";
import { buildIntro, buildProfilePlate, buildShell } from "./shared";

export function paid(): HTMLElement {
  return buildShell(
    "paid",
    "money",
    buildAnchor("paid · 03/04"),
    buildIntro({
      ghost: "227",
      ghostStyle: { right: "-8px", top: "24px", fontSize: "200px" },
      headline: "It's yours.",
      subline: "Nothing is owed back.",
      extra: buildProfilePlate(true),
    }),
    buildFooter({ label: "Next", route: "go", progress: 3, variant: "line" }),
  );
}
