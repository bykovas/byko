# Drafts — written, not published

Nothing in this directory is live. Diary entries are published only from
`website/content/diary.md`, and the publish workflow triggers on that file
alone, so a draft can sit here safely until it is approved.

Why the directory exists: a draft that lives only in a chat session or a
temp folder is one crash away from gone, and this project's whole method is
that the record survives the moment it was made in.

To publish a draft: paste its entry block at the top of
`website/content/diary.md`, run `node scripts/render-diary.mjs`, commit
everything it regenerated. That push posts it to Facebook and X.

| file | what it is | state |
| --- | --- | --- |
| `wash-trading-entry.md` | diary entry: Blockaid's two recommendations, one impossible, the other wash trading | awaiting approval |
| `wash-trading-notion-card.txt` | the same content as Notion card fields, for hand entry while the Notion connector is down | awaiting entry |
| `wash-trading-legal-questions.txt` | research prompt: MiCA Title VI scope, Lithuanian law, and the tax treatment of several hundred self-trades | awaiting answers |
