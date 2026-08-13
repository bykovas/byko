# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Communication

- Always reply to the user in Russian (Cyrillic).

## Git

- Commit and push directly to `main`. Do not create feature branches or PRs unless explicitly asked.
- **Never force-push.** The social-publishing workflow decides what is new from
  the push diff (`event.before`..`sha`); a force-push destroys that baseline and
  the run refuses to publish.

## Website conventions

- `website/` is a vanilla static site: no frameworks, no build step, one inline `<style>` block per page reusing the `:root` design tokens.
- **Cache busting (important):** whenever `website/*.js` (`market.js`, `wallet.js`, `card.js`) changes, bump the `?v=YYYYMMDD` query param on every `<script src="...">` tag that references the changed file (check all of `index.html`, `market.html`, `specification.html`). If the same date is already used, append a letter (`?v=20260811a`).
- Serverless endpoints live in `functions/` (Cloudflare Pages functions), e.g. `/api/holders`.
- Design tokens, classes and page structure follow `brand/brand-guide.md` and the existing pages — reuse them, don't invent new ones.
- Deploys: Cloudflare Pages serves `website/` as-is on every push to `main`. There is no CI build of the site; generators run locally and their output is committed.

## Diary and social publishing

**Full instruction for the publishing agent: [docs/publish-flow.md](docs/publish-flow.md).**
It is self-contained — source (Notion), field mapping, per-card cycle, CI
behaviour, statuses, the final report. What follows here is only the format.

`website/content/diary.md` is the single source for published diary entries.
After editing it, run `node scripts/render-diary.mjs` and commit everything it
regenerated together with it (`git add website/` covers it: diary.html,
the generator-owned `d/{slug}.html` entry pages, `data/diary-og.json`,
index.html, sitemap.xml, and the header nav on all pages). Never edit the
HTML between `<!-- diary:begin/end -->`, `<!-- counters:begin/end -->`,
`<!-- nav:begin/end -->` or `<!-- jsonld:begin/end -->` markers by hand —
the generator owns those regions.

Entry format (new entries at the top, newest first):

```markdown
## {Title} — {D Month YYYY}

Body: paragraphs separated by blank lines; **bold**, `code`,
[text](https://url), "- " list lines. Nothing else. No line may be
exactly "---" inside the body.

---
**Teaser:** required — the home-page card text.
**X:** optional — standalone X post text, max 250 chars; never derived
from the body. Without it the entry skips X.
```

Hard format rules: date is `D Month YYYY` (English month; convert from ISO
when writing); the header separator is the spaced em dash ` — ` (U+2014) —
an en dash or hyphen breaks the parse; commit only complete entries (header
+ field block); edits to existing entries never re-post to social; never
force-push (it destroys the publish workflow's diff baseline).

## Counters data (hours / dollars / stat bar)

- `website/content/hours.md` and `dollars.md` — one line per diary entry
  with the respective tally: `- {title} — {number}` (spaced em dash). They
  are rebuilt in full from the whole Notion base at every publish and do
  **not** trigger social posting.
- The Experiment stat bar on the home page renders entirely from
  `website/content/experiment/counters.json` via `render-diary.mjs`:
  composition, order, labels, kinds and the `/experiment` definitions all
  live in that one file, and the hours/dollars values are overridden by the
  sums of the two tally files (missing files keep the current values —
  nothing is invented). Composition rules are in docs/publish-flow.md §3.1.
