# Publish flow: Notion → repository → site → Facebook → X

This is the complete, self-contained instruction for the agent that publishes
diary entries. A fresh session in a rebuilt container, given the command
**"публикуй социалки"** (or "publish socials"), reads this file and performs
everything below with no further human explanation.

The container never posts to social networks itself. It writes to this
repository; GitHub Actions (`.github/workflows/publish-diary.yml`) does the
posting. Your job ends at a green CI run and an updated Notion status.

## 1. Source of truth

Notion database **"BYKO"**, data source
`collection://3ba36823-9b97-80ad-abae-000b77df3276`.

Field mapping — how a Notion card becomes a diary entry:

| Notion field | Where it goes | Rules |
|---|---|---|
| Title EN | `## {Title EN} — {date}` header in `website/content/diary.md`; also the title in `hours.md` / `dollars.md` lines | verbatim; after publication it is immutable because it defines the permanent `/d/{slug}` URL |
| Date (ISO, e.g. `2026-08-02`) | the header date | **you convert** to `2 August 2026` (English month, no leading zero required). Separator is the em dash `—` (U+2014) with a space on each side — an en dash or hyphen breaks the parser |
| FB POST | entry body (everything before the `---` field block) | already written and proofread by a human: do not rewrite, shorten, "improve" or derive anything from it. Must not contain a line that is exactly `---` — replace stray horizontal rules with an empty line |
| Teaser | `**Teaser:** …` line | required; verbatim |
| XCOM POST | `**X:** …` line | verbatim; max **250 characters**. Over the limit: **stop and report which card and by how many characters — never cut**. If the card has no XCOM POST, omit the `**X:**` line entirely (the entry then skips X); never write one yourself |
| image (hero) | `website/assets/diary/{slug}/{file}` + a `**Image:** ![alt](…)` field line | the optional lead picture: hero on the entry page, thumbnail in the list, and the right-hand panel baked into the OG card. **You cannot download it from Notion:** an uploaded file in the **image** column comes back from the MCP as an opaque `file://{…"source":"attachment:<id>.png"…}` reference, not a signed URL (`download-attachment` handles text only). Get the bytes from the human — they paste the image into chat, or it is already on their machine (the file uploaded to Notion; its name on Desktop/Downloads often equals the `<id>` in the ref, so you can find it with `find ~/Downloads ~/Desktop -name '<id>*'`). Commit it (PNG or JPEG) under `website/assets/diary/{slug}/` and write the field. No cropping needed — the entry page shows it whole, the list and OG card cover-crop via CSS/resvg. Alt text required. A title that will not fit beside the image fails the build; report it and ask for a shorter title rather than dropping the image silently |
| Proofs (screenshots) | `website/assets/diary/{slug}/{file}` + an `![alt](…)` line in the body | inline evidence, distinct from the hero above. Fetch the same way (signed URL) or take the files the human hands you. Alt text is required and becomes the caption. The line stands alone in its own paragraph and is stripped from the Facebook and X text, so screenshots stay on the site |
| Hours | a line in `website/content/hours.md` | `- {Title EN} — {hours} h` |
| USD | a line in `website/content/dollars.md` | `- {Title EN} — ${amount}` |
| Body, Summary | nowhere | working fields; never published, never edited by you |

Entry format in `diary.md` (new entries at the **top**, after the format
comment; newest first):

```markdown
## {Title EN} — {D Month YYYY}

{FB POST text. Paragraphs separated by blank lines. Inline markup that
survives: **bold**, `code`, [text](https://url), "- " list lines.}

---
**Teaser:** {Teaser}
**X:** {XCOM POST}
**Image:** ![{alt}](/assets/diary/{slug}/{file})
```

The `**Image:**` line is present only when the card's **image** column has a
file; omit it otherwise.

## 2. The command: "публикуй социалки"

### 2.0 Select cards

Take the cards whose status is **"Publish approved"** — nothing else.
Cards in any other status are not touched, not read into the site, not
counted as publishable. If there are none, say so and stop.

Order the selected cards by Date ascending (oldest first) and process them
**one at a time**: one card = one commit = one push = one CI run. Never batch
several cards into one commit.

### 2.1 Per-card cycle

For each card, in order:

1. **Write the entry** into `website/content/diary.md` (top of the file),
   converting fields per the table above. Validate before proceeding:
   date converted correctly, em dash separator, no `---` line inside the
   body, Teaser present, X text ≤ 250 chars or the line omitted.
2. **Recompute the tallies and counters — from the WHOLE database, not just
   this card** (see section 3). Rewrite `website/content/hours.md` and
   `website/content/dollars.md` completely from all non-Archived cards that
   have Hours / USD set. Update
   `website/content/experiment/counters.json` if the stat-bar composition
   changes (see 3.1).
3. **Render the site**:
   ```bash
   node scripts/render-diary.mjs
   ```
   This regenerates `website/diary.html`, the generator-owned
   `website/d/{slug}.html` page for every entry, `website/data/diary-og.json`
   for entry-specific 1200×630 cards, and a versioned static X image at
   `website/assets/og/diary/{slug}-{hash}.png`. Facebook/Open Graph keeps the
   dynamic `/api/og` image; `twitter:image` uses the visually identical static
   PNG because X did not reliably fetch the Worker response. It also regenerates
   `website/index.html`, the diary JSON-LD, `website/sitemap.xml` and the header
   nav, and syncs hours/dollars values into `counters.json`. If it fails, fix
   the entry format — do not commit.
4. **One commit, push to main** (`git add website/` — the generator may
   touch any page):
   ```bash
   git add website/
   git commit -m "diary: {Title EN}"
   git push
   ```
   Never force-push: the publishing workflow detects new entries from the
   push diff, a force-push destroys its baseline.
5. **Wait for the workflow** (it polls the live site for the new entry,
   then posts to Facebook and X):
   ```bash
   gh run list --workflow=publish-diary.yml --limit 1   # find the run for your commit
   gh run watch <run-id> --exit-status
   ```
   - **Success** → set the card's status in Notion to **"Published"**.
     Then continue with the next card.
   - **Failure** → do NOT change the card's status, do NOT retry, do NOT
     re-run the workflow. Stop the whole cycle (remaining cards stay
     "Publish approved") and show the human the run log — it states exactly
     what was posted, what failed and what was not attempted
     (`gh run view <run-id> --log`).

### 2.2 What you never do

- Never post to Facebook or X directly from the container — CI does it.
- Never touch cards in statuses other than "Publish approved".
- Never edit Body, Summary or any other working field in Notion.
- Never set "Published" before the CI run is green.
- Never rewrite, shorten or cross-derive FB POST and XCOM POST texts.
- Never invent numbers: every figure on the site comes from Notion data
  or from the chain.

## 3. Counters and the stat bar

`website/content/hours.md` and `dollars.md` hold one line per card that has
the respective field, across **all non-Archived cards** — they are rebuilt
in full at every publish, not appended to. `render-diary.mjs` sums them into
the Hours / Dollars cells of the stat bar and keeps `counters.json` values in
sync automatically. These files never trigger social posting (the workflow
watches `diary.md` only).

The other counters (currently listing rejections, wallet flags, support
rounds, paid listings) have no dedicated Notion fields: you derive them from
the cards' content — Title, Category, Body — by counting what they describe,
across all non-Archived cards.

### 3.1 Stat-bar composition

The composition is not fixed, but not arbitrary either:

- If, since the last publish, something substantively new appeared that the
  current counters do not show — replace the **least interesting** counter
  with it.
- If nothing new appeared — keep the composition, recompute values only.

Mechanics: the stat bar renders entirely from
`website/content/experiment/counters.json` — its `counters` array defines
composition, order, values, kinds (`spent` → blue, `result` → peach) and the
definitions shown on `/experiment`. To change the composition you edit this
one file: replace the counter object (id, value, label, kind, asOf, counts,
excludes). A number on the home page without its definition on `/experiment`
is an invalid state — the shared file makes it structurally impossible, as
long as you write real `counts`/`excludes` definitions for any counter you
introduce. Set `asOf` to the date the number was last true.

## 4. Final report

After the cycle (or the stop on first failure), report:

- per card: **title · commit hash · CI result · new Notion status**;
- separately: **what changed in the stat bar and why** — new values from the
  sums, any composition change and the reasoning under the 3.1 rule;
- if stopped on failure: what was published before the stop, what failed,
  what remains in "Publish approved".

## 5. Reference: what the CI workflow does (for reading its logs)

- Triggers only on pushes to `main` touching `website/content/diary.md`.
- Detects new entries from the push diff; edits to existing entries never
  re-post.
- Creates one share URL per entry in the form
  `https://byko.bykovas.lt/d/{slug}?v={unix-timestamp}`. The timestamp is the
  publishing commit's UTC Unix time, so it is fresh for a new entry but stable
  across workflow retries and identical in the Facebook and X links. It gives
  X a URL it has not cached; the page's `canonical` and `og:url` remain the
  clean `https://byko.bykovas.lt/d/{slug}`, so the cache buster does not create
  duplicate SEO identities.
- Polls that exact cache-busted URL (up to 3 min) until it returns a direct 200
  with the expected clean canonical/slug marker, then checks that its
  entry-specific, versioned, static `twitter:image` returns a direct 200 PNG
  with an actual IHDR size of 1200×630. This warms both fresh cache keys before
  either social post is sent. `og:image` remains the dynamic card used by
  Facebook; both URLs render the same design and entry title.
- Re-verifies page and image immediately before each post, and forces a
  Facebook crawl through the Graph API, checking what came back: the crawlers
  keep whatever they fetch first, and a card crawled during the deploy window
  stays a "404" or an imageless box forever.
- Honours `[skip-facebook]` / `[skip-x]` in the publishing commit message.
  Use it for a re-share where only one network needs the post again — the
  other one's post is fine and must not be duplicated.
- Posts the body to the Facebook page, then the `**X:**` text with the entry
  link to X; several entries go oldest-first, 45 s apart; stops on the first
  error with a published/failed/remaining log.
- A re-run after a partial failure skips the posts that already went out.
- Secrets live in the GitHub environment `PROD`; a typical failure is an
  expired Facebook page token — the log says so, and a human refreshes it.
