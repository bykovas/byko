# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Communication

- Always reply to the user in Russian (Cyrillic).

## Git

- Commit and push directly to `main`. Do not create feature branches or PRs unless explicitly asked.

## Website conventions

- `website/` is a vanilla static site: no frameworks, no build step, one inline `<style>` block per page reusing the `:root` design tokens.
- **Cache busting (important):** whenever `website/*.js` (`market.js`, `wallet.js`, `card.js`) changes, bump the `?v=YYYYMMDD` query param on every `<script src="...">` tag that references the changed file (check all of `index.html`, `market.html`, `specification.html`). If the same date is already used, append a letter (`?v=20260811a`).
- Serverless endpoints live in `functions/` (Cloudflare Pages functions), e.g. `/api/holders`.
- **Diary content:** `website/content/diary.md` is the single source for published diary
  entries. After editing it, run `node scripts/render-diary.mjs` and commit the regenerated
  `website/diary.html` and `website/index.html` together with it. Never edit the HTML between
  the `<!-- diary:begin -->` / `<!-- diary:end -->` markers by hand.
- Design tokens, classes and page structure follow `brand/brand-guide.md` and the existing pages — reuse them, don't invent new ones.
