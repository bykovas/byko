import "./app.css";

import { screens } from "./screens/index";
import { startEnrichment, subscribe } from "./state";
import { buildTape, type ScreenName } from "./tape";

const screenNames = new Set<ScreenName>(Object.keys(screens) as ScreenName[]);
const root = document.getElementById("app");

function routeName(): ScreenName {
  const candidate = location.hash.replace(/^#\//, "") as ScreenName;
  if (screenNames.has(candidate)) return candidate;

  history.replaceState(null, "", `${location.pathname}${location.search}#/why`);
  return "why";
}

function render(): void {
  const screen = screens[routeName()];
  if (root) root.replaceChildren(screen());
}

addEventListener("hashchange", render);
render();

subscribe((kind) => {
  if (!root?.firstElementChild) return;
  const name = routeName();
  if (kind === "chain") {
    root.querySelector(".tape")?.replaceWith(buildTape(name));
    return;
  }

  if ((name === "check" || name === "sealed") && !root.querySelector(".argument, .selected")) {
    render();
  }
});

startEnrichment();

/* Farcaster container: hide the splash once the first screen is painted.
   Outside the container this resolves into nothing — fire and forget. */
import("@farcaster/miniapp-sdk")
  .then(({ sdk }) => sdk.actions.ready())
  .catch(() => {});
