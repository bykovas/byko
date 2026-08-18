import { buildCoin } from "../chrome";
import type { CheckSource } from "../data";
import { append, element } from "../dom";
import { getState } from "../state";
import { buildTape, type ScreenName } from "../tape";

export type Ground = "ink" | "money" | "doc";

export function buildShell(
  screen: ScreenName,
  ground: Ground,
  ...children: (HTMLElement | null | undefined)[]
): HTMLElement {
  const classes = ["scr"];
  if (ground !== "ink") classes.push(ground);
  if (screen === "check") classes.push("check-screen");

  const shell = element("main", classes.join(" "));
  shell.dataset.screen = screen;
  append(shell, buildTape(screen), ...children);
  return shell;
}

export interface IntroOptions {
  ghost?: string;
  ghostStyle?: Partial<CSSStyleDeclaration>;
  /* 3C: the 128px coin above the headline on the money screens */
  coin?: boolean;
  headline: string;
  headlineHtml?: string[];
  headlineSize?: string;
  subline?: string;
  tiny?: string;
  extra?: HTMLElement;
}

export function buildIntro(options: IntroOptions): HTMLElement {
  const mid = element("div", "mid");
  if (options.ghost) {
    const ghost = element("div", "ghost", options.ghost);
    Object.assign(ghost.style, options.ghostStyle);
    ghost.setAttribute("aria-hidden", "true");
    mid.append(ghost);
  }

  const content = element("div", "z");
  if (options.coin) content.append(buildCoin("coin"));
  const headline = element("div", "big");
  if (options.headlineSize) headline.style.fontSize = options.headlineSize;
  if (options.headlineHtml) {
    options.headlineHtml.forEach((line, index) => {
      if (index > 0) headline.append(document.createElement("br"));
      headline.append(document.createTextNode(line));
    });
  } else {
    headline.textContent = options.headline;
  }
  content.append(headline);
  if (options.subline) content.append(element("p", "say", options.subline));
  if (options.tiny) content.append(element("p", "tiny", options.tiny));
  if (options.extra) content.append(options.extra);
  mid.append(content);
  return mid;
}

/* Fixture destination — the owner's own verified wallet; the real one comes
   from the authed profile the moment /api/auth answers. */
const FIXTURE_ADDRESS = "0x2F66caB27aD9A62561Df741caD01F908Ca7295b9";

export function buildProfilePlate(sent = false): HTMLElement {
  const { me } = getState();
  const plate = element("div", "plate");

  /* 3C: no avatar — one coin per screen. Handle left, the amount right. */
  const head = element("div", "prow");
  append(
    head,
    element("div", "hn", me?.handle ?? "@bykocoin"),
    element("span", "v live", sent ? "227 BYKO sent" : "227 BYKO"),
  );

  /* the full destination address — verifiable to the last byte */
  const to = element("div", "to");
  append(
    to,
    element("span", "k", "to"),
    element("span", "addr", me?.address ?? FIXTURE_ADDRESS),
  );

  const tail = element("div", "vrow");
  if (sent) {
    const tx = getState().advanceTx;
    const label = tx ? `tx ${tx.slice(0, 6)}…${tx.slice(-4)} ↗` : "tx 0x72a4…91f ↗";
    const transaction = element("a", "r paid-link", label);
    if (tx) {
      transaction.href = `https://basescan.org/tx/${tx}`;
      transaction.target = "_blank";
      transaction.rel = "noopener noreferrer";
    } else {
      transaction.href = "#";
      transaction.addEventListener("click", (event) => event.preventDefault());
    }
    tail.append(transaction);
  } else {
    tail.append(element("span", "r", "read from your profile"));
  }

  append(plate, head, to, tail);
  return plate;
}

export function buildSource(source: CheckSource, index: 0 | 1, last = false): HTMLElement {
  const row = element("div", last ? "src last" : "src");
  const description = element("div");
  append(
    description,
    element("div", "n", `source 0${index + 1}`),
    element("div", "t", source.label),
    element("div", source.live ? "d live" : "d", source.detail),
  );

  const link = element("a", "o", "OPEN →");
  link.href = source.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute("aria-label", `OPEN → · ${source.label}`);
  append(row, description, link);
  return row;
}
