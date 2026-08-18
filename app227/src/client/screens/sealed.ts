import { buildAnchor, buildFooter, navigate } from "../chrome";
import { append, element } from "../dom";
import { advanceCheck, getState } from "../state";
import { buildShell } from "./shared";

function readerSlot(index: number, handle: string): HTMLElement {
  const slot = element("div", "slotbox");
  append(slot, element("div", "k", `READER ${index}`), element("div", "w", handle));
  return slot;
}

export function sealed(): HTMLElement {
  const { check: claim } = getState();
  const mid = element("div", "mid top");
  append(mid, element("div", "lab", `claim · diary ${claim.entry}`), element("div", "claim", claim.text));

  const readers = element("div", "seal");
  append(readers, readerSlot(1, "@ted"), readerSlot(2, "@linda"), readerSlot(3, "@denis"));
  mid.append(readers);
  mid.append(element("p", "say", "Three readers said yes. The claim is now printed with your handle under it on the site."));

  const line = element("div", "src last");
  const description = element("div");
  append(
    description,
    element("div", "n", "your line"),
    element("div", "t", `byko.bykovas.lt/${claim.entry}`),
    element("div", "d", "verified by @ted · @linda · @denis"),
  );
  const open = element("a", "o", "OPEN →");
  open.href = `https://byko.bykovas.lt/d/${claim.entry}`;
  open.target = "_blank";
  open.rel = "noopener noreferrer";
  open.setAttribute("aria-label", `OPEN → · byko.bykovas.lt/${claim.entry}`);
  append(line, description, open);
  mid.append(line, element("p", "tiny", "Next claim opens tomorrow. Check #039 · diary e20."));

  return buildShell(
    "sealed",
    "doc",
    buildAnchor("check #038 · closed"),
    mid,
    buildFooter({
      label: "Next claim",
      /* second fact of the day if there is one; otherwise the same claim
         until the sealed screen learns to say "come back tomorrow" */
      onClick() {
        advanceCheck();
        navigate("check");
      },
    }),
  );
}
