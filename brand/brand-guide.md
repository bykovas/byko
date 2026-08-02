# BYKO — brand guide

BYKO is a crypto coin. It is a sub-brand of **bykovas.lt** (Denisas Bykovas, system architect) and inherits that design language: dark, precise, engineered. The joke is that there is no joke — a coin site that looks like national payments infrastructure, not a memecoin. Everything below is normative; do not invent outside it.

This file is self-contained. Sibling assets live in `assets/` next to it.

## The mark
`|>` — the bar and the point. Two strokes.
The bar is the person. The point is the direction. Reads as an unwritten D (Denisas).

### Construction
Canvas 96×96. Stem: x=24, y 14–82. Point: (40,20) → (70,48) → (40,76).
Stroke 13 (13.5% of height), butt caps, miter joins. Clear space: half glyph height on all sides.
Inside a circle or rounded square the glyph occupies 65% of the container.

Inline SVG (gradient, for dark backgrounds — the canonical form):

```html
<svg viewBox="0 0 96 96" width="48" height="48" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="byko-g" x1="0" y1="0" x2="96" y2="0" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#7CCBFF"/><stop offset="1" stop-color="#FFB088"/>
  </linearGradient></defs>
  <g fill="none" stroke="url(#byko-g)" stroke-width="13" stroke-linecap="butt" stroke-linejoin="miter">
    <path d="M24 14 V82"/><path d="M40 20 L70 48 L40 76"/>
  </g>
</svg>
```

On light backgrounds: same paths, solid `stroke="#0B0D10"`, no gradient. Never any other recolor.
Below 24px render use the favicon cut: identical geometry, `stroke-width="17"`.

### Asset files
- `assets/coin-1024.png` — THE COIN: blue `#7CCBFF` circle, black glyph. Use for token imagery, exchange listings, "price" rows, social avatars.
- `assets/logo-dark-512.png` — app icon: `#0B0D10` rounded square (radius ≈22%), gradient glyph. Use for app-icon contexts and dark tiles.
- `assets/logo-mark.svg` — gradient glyph, transparent bg (primary mark on dark).
- `assets/logo-mark-light.svg` — `#0B0D10` glyph for light backgrounds.
- `assets/logo-mark-favicon.svg` — stroke-17 favicon cut.

### Mark rules
- Do not rotate, mirror, outline or add effects. Flat only, no shadows, no glows on the mark.
- Minimum size 16px. Below 24px use the favicon cut.
- Do not draw the glyph freehand — paste the SVG above or use the files.
- 1 BYKO = 1 BYKO.

## Color
Dark only. No light theme.

```css
:root{
  /* surfaces — depth by stepping, never by shadow */
  --bg:#0B0D10;        /* page */
  --bg-2:#11141A;      /* card */
  --bg-3:#171B22;      /* raised / hover */
  /* hairlines — the structure of every layout */
  --line:rgba(255,255,255,.08);
  --line-2:rgba(255,255,255,.14);  /* emphasis / hover */
  /* text */
  --text:#E8EAEE;
  --text-2:rgba(232,234,238,.72);
  --muted:rgba(232,234,238,.45);
  /* accents — sparingly */
  --accent:#7CCBFF;        /* cool blue: links, kickers, primary hover */
  --accent-2:#FFB088;      /* warm peach: highlight numbers only */
  --ok:#7CE3A6;            /* green: live / running, always with soft glow dot */
  --grad:linear-gradient(90deg,#7CCBFF,#FFB088); /* text-clip on 1–3 words max, and the mark */
}
```

- The gradient appears ONLY as text-clip on 1–3 words in a heading, and in the mark. Never on backgrounds, buttons, or borders.
- No drop shadows anywhere. Depth = surface step + hairline. Only permitted glows: the green status dot and the coin render.
- Peach is for highlight metrics ("757k+", "$0.00"), not for UI chrome.

## Type
Inter + JetBrains Mono, Google Fonts:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

- **Inter** 400/500/600 for everything. Display weight is 600 — never 700+.
- **JetBrains Mono** 400/500 for ALL meta: kickers, labels, tickers, amounts, addresses, timestamps, chips, captions.
- Wordmark: `BYKO`, Inter 600, tracking −0.02em, always all-caps as spelled.
- Scale: display 56/44px @600, tracking −.025em, line-height 1.03 · h2 28px @600, −.02em · lede 18px `--text-2` · body 15px/1.55 400 · mono meta 12px · mono label 11px UPPERCASE tracking .12–.16em.
- Numbers and token amounts are ALWAYS mono: `1 BYKO`, `0x7c…b088`, `21,000,000`.

```css
body{margin:0;background:var(--bg);color:var(--text);font:400 15px/1.55 Inter,sans-serif;-webkit-font-smoothing:antialiased}
.label{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.kicker{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--accent);display:inline-flex;align-items:center;gap:8px}
.kicker::before{content:"";width:18px;height:1px;background:var(--accent)}
.b{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent} /* gradient words */
```

Example heading: `<h1>One bar. One point. <span class="b">One BYKO.</span></h1>`

## Voice & copy
- First person or plain declarative. Short sentences with weight. Sentence case everywhere; UPPERCASE only on 11px mono labels.
- Confidence via specificity: real numbers, named systems. Never "to the moon", never hype adjectives, never exclamation marks, never emoji.
- Dry understatement is the register: "A coin that does nothing, reliably." · "No roadmap. The point is the direction." · "Audited by reading the code."
- Crypto meta written like engineering annotations: "Supply / fixed", "Chain / TBD", "Status / running". Middle dots join facts: "21M supply · 0% tax · 100% |>".
- Section kickers look like annotations: "Tokenomics / 02".
- Disclaimers are written straight, small, mono, not hidden.

## Layout & backgrounds
- Max width 1120px, 32px page padding, 80px vertical section rhythm.
- Grids with `gap`; data rows are full-width, divided by 1px hairlines (`border-top:1px solid var(--line)`), 4-column stat bands.
- Blueprint grid background on hero/page top — faint 64px grid, radially masked:

```css
.grid-bg{position:relative}
.grid-bg::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.5;
  background:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);
  background-size:64px 64px;
  -webkit-mask-image:radial-gradient(120% 70% at 50% 0%,#000 0%,transparent 70%);
  mask-image:radial-gradient(120% 70% at 50% 0%,#000 0%,transparent 70%)}
```

- Radii: chips 5px · buttons 8px · panels 12px · cards 14px · hero containers 18px · tags/pills 99px.
- Transparency + blur only for a fixed header: `background:rgba(11,13,16,.8);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)`.

## Components (copy these, don't reinvent)

```css
.card{background:var(--bg-2);border:1px solid var(--line);border-radius:14px;padding:24px;transition:.15s}
.card:hover{background:var(--bg-3);border-color:var(--line-2)}

.btn{display:inline-flex;align-items:center;gap:8px;padding:12px 20px;border-radius:8px;font:500 14px Inter,sans-serif;
  background:var(--text);color:var(--bg);border:1px solid transparent;cursor:pointer;transition:.15s;text-decoration:none}
.btn:hover{background:var(--accent)}
.btn .arr{transition:.15s}.btn:hover .arr{transform:translateX(2px)}
.btn-ghost{background:transparent;color:var(--text);border-color:var(--line-2)}
.btn-ghost:hover{background:var(--bg-3);border-color:rgba(255,255,255,.25)}

.chip{font-family:'JetBrains Mono',monospace;font-size:12px;padding:5px 10px;border-radius:5px;
  background:var(--bg-3);border:1px solid var(--line);color:var(--text-2)}

.status{display:inline-flex;align-items:center;gap:8px;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--ok);
  padding:6px 12px;border:1px solid var(--line);border-radius:99px}
.status::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--ok);box-shadow:0 0 10px var(--ok)}

.stats{display:grid;grid-template-columns:repeat(4,1fr)}
.stat{padding:20px 24px;border-left:1px solid var(--line)}
.stat:first-child{border-left:0}
.stat b{display:block;font:600 26px/1.1 Inter,sans-serif;letter-spacing:-.02em}
.stat b.hot{color:var(--accent-2)}
.stat span{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
```

```html
<a class="btn" href="#">Get BYKO <span class="arr">→</span></a>
<a class="btn btn-ghost" href="#">Read the contract</a>
<span class="status">running</span>
<span class="chip">ERC-20</span>
<div class="stats">
  <div class="stat"><b>21,000,000</b><span>Fixed supply</span></div>
  <div class="stat"><b class="hot">0%</b><span>Tax</span></div>
  <div class="stat"><b>1 : 1</b><span>BYKO per BYKO</span></div>
  <div class="stat"><b>2026</b><span>Since</span></div>
</div>
```

## Interaction
- Hover: border brightens (`--line` → `--line-2`), surface steps up one level, arrows nudge 2px right. Primary button inverts to accent blue.
- All transitions `.15s ease`. No bounces, no springs, no scroll-jacking, no parallax.
- Hierarchy by de-emphasis: secondary rows at opacity .78–.86, restored on hover.

## Iconography
**No icon set.** Typographic marks only: `→` actions, `↓` downloads, `·` separators, `—` dashes, 6px CSS status dots, the `|>` mark itself. Never icon fonts, never emoji, never hand-drawn SVG art. The only imagery is the coin/mark renders in `assets/`.

## Don't
- No light theme. No purple, no neon, no bluish-purple gradients, no glassmorphism cards, no 3D coins spinning.
- No shadows, no rounded-corner-with-colored-left-border cards.
- No hype copy, rockets, or emoji. No Comic-anything.
- Don't restyle the mark, don't set the wordmark in mono, don't gradient more than 3 words.
