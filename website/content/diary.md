<!--
  BYKO diary — the single source for all published diary content.
  Published entries only, newest first. After editing, run from the repo root:

    node scripts/render-diary.mjs

  and commit the regenerated pages together with this file.

  Entry format:

  ## {Title} — {DD Month YYYY}

  Long-form body. Paragraphs separated by blank lines. Inline markup:
  **bold**, `code`, [text](https://url). Lines starting with "- " form lists.

  ---
  **Teaser:** one or two short sentences for the home-page card. Required.
  **X:** short post text for X, max 250 characters — the entry link is appended
  automatically. Optional: an entry without it goes to the site and Facebook
  but not to X. The X text is authored independently of the body; neither is
  ever derived from the other.

  New entries at the top. Pushing a new entry to main triggers
  .github/workflows/publish-diary.yml, which posts it to Facebook and X.
-->
