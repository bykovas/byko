import { append, element, svgElement } from "./dom";

export type ButtonVariant = "default" | "key" | "line";

export interface FooterOptions {
  label: string;
  route?: string;
  onClick?: (button: HTMLButtonElement) => void;
  progress?: 1 | 2 | 3 | 4;
  variant?: ButtonVariant;
  follow?: boolean;
}

export function navigate(route: string): void {
  location.hash = `#/${route}`;
}

export function buildMark(className = "disc"): HTMLElement {
  const disc = element("span", className);
  const svg = svgElement("svg", { viewBox: "0 0 96 96", "aria-hidden": "true" });
  const group = svgElement("g", {
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "13",
  });
  group.append(
    svgElement("path", { d: "M24 14 V82" }),
    svgElement("path", { d: "M40 20 L70 48 L40 76" }),
  );
  svg.append(group);
  disc.append(svg);
  return disc;
}

export function buildAnchor(status: string): HTMLElement {
  const anchor = element("header", "anchor");
  const left = element("span", "lft");
  append(left, buildMark(), element("span", "wm", "227 · byko check"));
  append(anchor, left, element("span", "st", status));
  return anchor;
}

export function buildPlainHeader(): HTMLElement {
  const header = element("header", "plainhead");
  append(header, element("span", undefined, "check #038"), element("span", undefined, "2 of 3 readers"));
  return header;
}

export function buildButton(
  label: string,
  variant: ButtonVariant = "default",
  onClick?: (button: HTMLButtonElement) => void,
  once = true,
): HTMLButtonElement {
  const className = variant === "default" ? "btn" : `btn ${variant}`;
  const button = element("button", className);
  button.type = "button";
  append(button, element("span", undefined, label), element("span", undefined, "→"));
  if (onClick) button.addEventListener("click", () => onClick(button), { once });
  return button;
}

function buildProgress(current: 1 | 2 | 3 | 4): HTMLElement {
  const cells = element("div", "cells");
  cells.setAttribute("aria-hidden", "true");
  for (let step = 1; step <= 4; step += 1) {
    const cell = element("i", step === current ? "on" : undefined);
    cell.setAttribute("aria-hidden", "true");
    cells.append(cell);
  }
  return cells;
}

export function buildFollow(): HTMLElement {
  const follow = element("div", "follow");
  append(follow, element("span", undefined, "FOLLOW"), element("span", undefined, "X · FB · GIT · BYKOVAS.LT"));
  return follow;
}

export function buildFooter(options: FooterOptions): HTMLElement {
  const footer = element("footer", "foot");
  const onClick = options.onClick ?? (() => navigate(options.route ?? "why"));
  footer.append(buildButton(options.label, options.variant, onClick));
  if (options.progress) footer.append(buildProgress(options.progress));
  if (options.follow !== false) footer.append(buildFollow());
  return footer;
}
