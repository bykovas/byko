import { buildCoin } from "../chrome";
import type { CheckSource } from "../data";
import { append, element } from "../dom";
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

export function buildProfilePlate(sent = false): HTMLElement {
  const plate = element("div", "plate");
  /* 3C: no avatar — one coin per screen. Handle left, wallet right. */
  const profile = element("div", "prow");
  append(
    profile,
    element("div", "hn", "@bykocoin"),
    /* the Farcaster-verified wallet the advances will actually come from */
    element("div", "ad", "0x2f66…95b9"),
  );

  const value = element("div", "vrow");
  value.append(element("span", "v live", sent ? "227 BYKO sent" : "227 BYKO"));
  if (sent) {
    const transaction = element("a", "r paid-link", "tx 0x72a4…91f ↗");
    transaction.href = "#";
    transaction.addEventListener("click", (event) => event.preventDefault());
    value.append(transaction);
  } else {
    value.append(element("span", "r", "read from your profile"));
  }

  append(plate, profile, value);
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
