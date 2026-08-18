import "./app.css";

import { screens } from "./screens/index";
import { dayClosed, hasVisited, startEnrichment, subscribe } from "./state";
import { buildTape, type ScreenName } from "./tape";

const screenNames = new Set<ScreenName>(Object.keys(screens) as ScreenName[]);
const root = document.getElementById("app");

/* Returning users skip the onboarding and land on the claim screen. */
const HOME: ScreenName = hasVisited() ? "claim" : "why";

function routeName(): ScreenName {
  const candidate = location.hash.replace(/^#\//, "") as ScreenName;
  if (screenNames.has(candidate)) return candidate;

  history.replaceState(null, "", `${location.pathname}${location.search}#/${HOME}`);
  return HOME;
}

/* Once both facts are answered the check screen has nothing left to ask —
   the day's closing page takes its place. Pure: the hash is only rewritten
   when the screen is actually drawn, never from a subscription that a
   mid-answer guard may skip. */
function resolved(): ScreenName {
  const name = routeName();
  return name === "check" && dayClosed() ? "sealed" : name;
}

function render(): void {
  const name = resolved();
  if (name === "sealed" && location.hash !== "#/sealed") {
    history.replaceState(null, "", `${location.pathname}${location.search}#/sealed`);
  }
  const screen = screens[name];
  if (root) root.replaceChildren(screen());
  if (name === "go") promptAddOnce();
}

/* One install prompt per visit, and only once the onboarding pitch is done —
   the container rejects the call silently outside Farcaster. */
let addPrompted = false;
function promptAddOnce(): void {
  if (addPrompted) return;
  addPrompted = true;
  import("@farcaster/miniapp-sdk")
    .then(async ({ sdk }) => {
      if (await sdk.isInMiniApp()) await sdk.actions.addMiniApp();
    })
    .catch(() => {});
}

addEventListener("hashchange", render);
render();

subscribe((kind) => {
  if (!root?.firstElementChild) return;
  const name = resolved();
  if (kind === "chain") {
    root.querySelector(".tape")?.replaceWith(buildTape(name));
    return;
  }

  /* claim feed or Record updates redraw the data screens — never mid-answer */
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
