/* Hash router over the seven stub screens. No styles, no SDK calls yet —
   the skeleton only proves the paths and the build. */
import { screens } from "./screens/index";

function render(): void {
  const name = location.hash.replace(/^#\//, "") || "start";
  const screen = screens[name] ?? screens["start"];
  const root = document.getElementById("app");
  if (root && screen) root.replaceChildren(screen());
}

addEventListener("hashchange", render);
render();
