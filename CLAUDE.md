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

## Diary: single source, three channels

`website/content/diary.md` is the single source for published diary entries.
One correctly formatted entry, committed and pushed, ends up in three places
automatically:

1. **Site** — you render it before committing: `node scripts/render-diary.mjs`
   writes all entries into `website/diary.html` and the three most recent as
   cards into `website/index.html`, between `<!-- diary:begin -->` /
   `<!-- diary:end -->` markers. Never edit the HTML between those markers by
   hand. Commit the regenerated pages together with the markdown.
2. **Facebook** — `.github/workflows/publish-diary.yml` triggers on the push
   (paths-filtered to `diary.md` only), waits until the new entry's anchor is
   actually served on https://byko.bykovas.lt/diary.html, then posts the
   long-form body (as plain text) to the Facebook page.
3. **X** — the same workflow posts the `**X:**` field with a link to the entry.

### Entry format (hand-writable, nothing exotic)

New entries go at the **top** of the file, after the format comment. Newest first.

```markdown
## Seven rejections, zero reasons — 14 August 2026

Long-form body. Paragraphs separated by blank lines. Inline markup:
**bold**, `code`, [text](https://url). Lines starting with "- " form lists.
Nothing else is supported — no headings inside the body, no images, no HTML.

- lists are fine
- like this

---
**Teaser:** One or two short sentences for the home-page card. Required.
**X:** Standalone post text for X, max 250 characters. Optional.
```

Where each part goes:

| Part | /diary page | Home card | Facebook | X |
|---|---|---|---|---|
| `## Title — date` | heading + date | heading + date | first lines of the post | — |
| body (before `---`) | full, with markup | — | full, converted to plain text | — |
| `**Teaser:**` | — | card text | — | — |
| `**X:**` | — | — | — | post text + entry link |

### Hard rules

- Header format is exactly `## {Title} — {DD Month YYYY}` — English month
  name, spaced em dash (` — `). A malformed date makes the entry invalid.
- `**Teaser:**` is **required** — `render-diary.mjs` fails loudly without it.
- `**X:**` is **optional**: an entry without it goes to the site and Facebook
  but is not posted to X. The body and the X text are authored independently —
  never derive, shorten or copy one from the other. If the source (Notion)
  provides no X text, omit the field; do not write one yourself.
- `**X:**` max **250 characters** (the entry link is appended automatically
  and consumes the rest of the limit). Over the limit the workflow fails
  before posting anything — it never truncates silently.
- The `---` field block is what marks an entry as complete. Never commit a
  half-written entry (header without the block): it renders nowhere and
  publishes nothing, but it pollutes the diff baseline.
- Editing an already-published entry is safe: edits never re-post to social —
  only entries whose header line did not exist before the push are published.
- Several new entries in one push are fine: they publish oldest-first,
  45 seconds apart.

### Publish workflow behaviour (so you can read its logs)

- Trigger: push to `main` touching `website/content/diary.md`. Nothing else
  triggers it; pushes to other files never post.
- Secrets live in the GitHub environment `PROD` (`FB_BYKO_PAGE_ACCESS_TOKEN`,
  `XCOM_BYKO_API_KEY`, `XCOM_BYKO_API_SECRET`, `XCOM_BYKO_ACCESS_TOKEN`,
  `XCOM_BYKO_ACCESS_SECRET`). Logs print presence only, never values.
- Before the first post it polls the live diary page (up to 3 minutes) until
  every new entry's anchor is served — so the linked page exists when the
  post lands. Timeout fails the run with nothing published.
- It stops on the first error and logs exactly what was published, what
  failed, and what was not attempted. A re-run after a partial failure skips
  the posts that already went out (progress lives in actions/cache, never in
  the repository).
- A likely failure is an expired Facebook page token — the run says so
  explicitly and posts nothing; the token has to be refreshed by a human.

### Publishing checklist

```bash
# 1. add the entry to the top of website/content/diary.md
# 2. render the site
node scripts/render-diary.mjs
# 3. one commit with the markdown and both regenerated pages
git add website/content/diary.md website/diary.html website/index.html
git commit -m "diary: {short entry title}"
git push
# 4. done — CF Pages deploys, the workflow waits for the deploy, then posts
#    to Facebook and X. Check the run in GitHub Actions if in doubt.
```

## Counters data (hours / dollars)

Two companion files hold the per-entry tallies behind the Experiment stat bar
on the home page. They do **not** trigger social publishing and are not part
of `diary.md`:

- `website/content/hours.md` — one line per diary entry that logs hours:
  ```markdown
  - Contract and genesis — 6.5 h
  - Seven rejections, zero reasons — 12 h
  ```
- `website/content/dollars.md` — one line per entry that logs spend:
  ```markdown
  - Pool funding — $74.02
  - Micro-buys, gas, domain — $10.90
  ```

Line format: `- {title} — {number}` with the same spaced em dash; titles are
free-form. The stat-bar generator that consumes these files is not built yet —
until it exists, the numbers in `index.html`'s Experiment band and in
`website/content/experiment/counters.json` are maintained by hand and must be
updated together with these files, in the same commit, so the two never
disagree.
