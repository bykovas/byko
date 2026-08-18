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

/* The real coin: assets/coin.svg composition — full-bleed circle, the mark
   nearly edge to edge with its canonical offset — in the app's tokens. */
export function buildCoin(className = "coin"): HTMLElement {
  const wrap = element("span", className);
  const svg = svgElement("svg", { viewBox: "0 0 32 32", "aria-hidden": "true" });
  svg.append(svgElement("circle", { cx: "16", cy: "16", r: "16", fill: "var(--coin)" }));
  const group = svgElement("g", {
    transform: "translate(2.1875 1.25) scale(.3125)",
    fill: "none",
    stroke: "var(--ink)",
    "stroke-width": "13",
    "stroke-linecap": "butt",
    "stroke-linejoin": "miter",
  });
  group.append(
    svgElement("path", { d: "M24 14V82" }),
    svgElement("path", { d: "M40 20L70 48 40 76" }),
  );
  svg.append(group);
  wrap.append(svg);
  return wrap;
}

/* The coin's 1:1 outline — the trace it leaves when it rolls away. Every
   shape is drawn twice: a slightly wider layer in the coin's colour, then
   the exact original geometry knocked out in the ground colour. The outline
   is therefore always true to the real coin, no hand-traced polygons.
   Butt caps outline nothing by themselves, so the outer strokes are extended
   by the outline thickness at each end (precomputed below). */
export function buildCoinOutline(className = "coin-outline"): HTMLElement {
  const wrap = element("span", className);
  const svg = svgElement("svg", { viewBox: "0 0 32 32", "aria-hidden": "true" });
  /* circle: ring of 1.5 (32-box units) */
  svg.append(svgElement("circle", { cx: "16", cy: "16", r: "16", fill: "var(--coin)" }));
  svg.append(svgElement("circle", { cx: "16", cy: "16", r: "14.5", fill: "var(--deep)" }));
  /* mark: outline 4.8 group-units (= 1.5 in the 32-box) around stroke 13 */
  const outer = svgElement("g", {
    transform: "translate(2.1875 1.25) scale(.3125)",
    fill: "none",
    stroke: "var(--coin)",
    "stroke-width": "22.6",
    "stroke-linecap": "butt",
    "stroke-linejoin": "miter",
  });
  outer.append(
    svgElement("path", { d: "M24 9.2V86.8" }),
    svgElement("path", { d: "M36.49 16.73L70 48 36.49 79.27" }),
  );
  const inner = svgElement("g", {
    transform: "translate(2.1875 1.25) scale(.3125)",
    fill: "none",
    stroke: "var(--deep)",
    "stroke-width": "13",
    "stroke-linecap": "butt",
    "stroke-linejoin": "miter",
  });
  inner.append(
    svgElement("path", { d: "M24 14V82" }),
    svgElement("path", { d: "M40 20L70 48 40 76" }),
  );
  svg.append(outer, inner);
  wrap.append(svg);
  return wrap;
}

export function buildAnchor(status: string): HTMLElement {
  const anchor = element("header", "anchor");
  const left = element("span", "lft");
  append(left, buildMark(), element("span", "wm", "227 · byko check"));
  append(anchor, left, element("span", "st", status));
  return anchor;
}

export function buildPlainHeader(left: string, right: string): HTMLElement {
  const header = element("header", "plainhead");
  append(header, element("span", undefined, left), element("span", undefined, right));
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

/* Hand-drawn 24px stroke glyphs in the system's own weight — no brand kits. */
const FOLLOW_LINKS: { label: string; href: string; paths: string[] }[] = [
  { label: "X", href: "https://x.com/BYKOCOIN", paths: ["M5 4 L19 20", "M19 4 L5 20"] },
  { label: "Telegram", href: "https://t.me/bykocoin", paths: ["M21 4 L3 11 L10 13.5 L12.5 20 L21 4 Z", "M10 13.5 L21 4"] },
  { label: "Facebook", href: "https://www.facebook.com/profile.php?id=61592828503907", paths: ["M14.5 4 H13 C10.8 4 10 5.4 10 7.5 V20", "M7.5 10.5 H13.5"] },
  { label: "GitHub", href: "https://github.com/bykovas/byko", paths: ["M7 7 a2.2 2.2 0 1 0 0-.01", "M17 7 a2.2 2.2 0 1 0 0-.01", "M12 19 a2.2 2.2 0 1 0 0-.01", "M7 9.2 V10 C7 12 9 13 12 13 C15 13 17 12 17 10 V9.2", "M12 13 V16.8"] },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/bykovas/", paths: ["M4.75 4.75 H19.25 V19.25 H4.75 Z", "M8.5 11 V16", "M8.5 8 V8.01", "M12.5 16 V12.5 C12.5 10.5 16 10.5 16 12.5 V16"] },
  { label: "byko.bykovas.lt", href: "https://byko.bykovas.lt", paths: ["M6.5 4.5 V19.5", "M10.5 6 L17.5 12 L10.5 18"] },
];

export function buildFollow(): HTMLElement {
  const follow = element("div", "follow");
  const links = element("span", "flinks");
  for (const item of FOLLOW_LINKS) {
    const link = element("a", "fico");
    link.href = item.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", item.label);
    const svg = svgElement("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" });
    const group = svgElement("g", { fill: "none", stroke: "currentColor", "stroke-width": "1.8" });
    for (const d of item.paths) group.append(svgElement("path", { d }));
    svg.append(group);
    link.append(svg);
    links.append(link);
  }
  const site = element("a", "fsite", "BYKOVAS.LT");
  site.href = "https://bykovas.lt";
  site.target = "_blank";
  site.rel = "noopener noreferrer";
  links.append(site);
  append(follow, element("span", undefined, "FOLLOW"), links);
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
