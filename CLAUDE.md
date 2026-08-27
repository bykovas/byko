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
- The design system lives in `website/assets/byko.css` — tokens, page furniture and every shared component. Pages link it and keep only their own composition in one inline `<style>` block. Values come from the handoff; do not invent new tokens.
- **Cache busting (important):** whenever `website/assets/byko.css` or a `website/*.js` file (`market.js`, `wallet.js`, `card.js`) changes, bump the `?v=YYYYMMDD` query param on every tag that references it — across `index.html`, `diary.html`, `experiment.html`, `market.html`, `specification.html`, `404.html`, `w.html` and `scripts/templates/diary-entry.html`. If the same date is already used, append a letter (`?v=20260811a`).
- Three rules of the system that are easy to break: blue marks a value read from the chain live and nothing else; no opacity for text, no shadows, no radius outside controls; mono is for data only — never labels, nav or kickers.
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
the versioned static X cards in `assets/og/diary/`,
index.html, sitemap.xml, and the header nav on all pages). Never edit the
HTML between `<!-- diary:begin/end -->`, `<!-- counters:begin/end -->`,
`<!-- nav:begin/end -->` or `<!-- jsonld:begin/end -->` markers by hand —
the generator owns those regions.

Entry format (new entries at the top, newest first):

```markdown
## {Title} — {D Month YYYY}

Body: paragraphs separated by blank lines; **bold**, `code`,
[text](https://url), "- " list lines, and image lines. Nothing else. No
line may be exactly "---" inside the body.

An image is a line of its own: ![alt](/assets/diary/{slug}/{file}). The
file is a PNG or JPEG committed under website/assets/diary/{slug}/, the
alt text is required (it is also the caption), and the renderer reads the
real pixel size into width/height. Image lines are stripped from the
Facebook and X text, so screenshots live on the site only.

---
**Teaser:** required — the home-page card text.
**X:** optional — standalone X post text, max 250 chars; never derived
from the body. Without it the entry skips X.
**Image:** optional hero — `![alt](/assets/diary/{slug}/{file})`, same file
rules as a body image. It is the lead on the entry page, the thumbnail in the
diary list, and the right-hand panel baked into the social (OG) card. One per
entry, separate from inline body screenshots. Source is the Notion **image**
column, but you cannot download it from the API: an uploaded file comes back
as an opaque `file://{…attachment:<id>.png…}` reference, not a signed URL
(the same limitation as Proofs). Get the actual bytes from the human — they
paste the image into chat, or it is already on disk (it was uploaded to
Notion from somewhere; the filename on their Desktop/Downloads often matches
the `<id>` in the ref). Commit it under `website/assets/diary/{slug}/` and
write this line. A title that will not fit beside the image fails the build;
shorten it or drop the image.
```

Hard format rules: date is `D Month YYYY` (English month; convert from ISO
when writing); the header separator is the spaced em dash ` — ` (U+2014) —
an en dash or hyphen breaks the parse; commit only complete entries (header
+ field block); edits to existing entries never re-post to social; never
force-push (it destroys the publish workflow's diff baseline).

## Founder wallets

- `website/data/founder-wallets.json` is the single source: address, role and
  class. `functions/api/tally.js` fetches it (and refuses to answer if it
  cannot, rather than counting the author's own wallets as votes),
  `scripts/compute-tally.mjs` reads it from disk, and the home page renders
  the register from whatever the tally reports — no second list anywhere.
- Adding or removing a wallet is a one-file change, **plus** a bump of
  `CHECKPOINT_KEY` in `functions/api/tally.js`: the stored checkpoint was
  folded with the previous list and would keep the old exclusions.

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
