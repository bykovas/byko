<!--
  BYKO claims — machine-checkable facts served to the app227 mini-app.
  Hand-written here; emitted to website/data/claims.json by:

    node scripts/emit-claims.mjs

  and validated by scripts/test-claims.mjs, which CI runs alongside the
  diary tests on every publish. Commit the regenerated JSON together with
  this file — the test fails if they disagree.

  Entry format (one claim):

  ## {id} — {type}

  {text — the claim itself, one paragraph, at most 140 characters}

  ---
  **Entry:** {slug of the diary entry this claim comes from}
  **Frozen-at-block:** {Base block number — REQUIRED for type B}
  **Source:** [{label}](https://absolute-url)
  **Source:** [{label}](https://absolute-url)
  **Opens-at:** {YYYY-MM-DD}

  Rules the validator enforces:
  - id: lowercase [a-z0-9-], unique, immutable once published — an id that
    has appeared in claims.json may never be renamed or dropped;
  - type: A, B or C (semantics per the app architecture; B is chain state
    read at a block, so Frozen-at-block is required for it);
  - type D — correspondence, letters, institutional refusals — is banned
    from this file by design: private mail is not a machine-checkable
    source. The diary quotes it; claims do not;
  - exactly two sources, both absolute https URLs;
  - Entry must name a published diary slug (website/data/diary-og.json);
  - text at most 140 characters.

  Example (inside this comment on purpose — not a live claim):

  ## lp-burned — A

  100% of BYKO LP tokens sit at 0x…dEaD; the pool position cannot be
  withdrawn by anyone.

  ---
  **Entry:** burning-the-liquidity-and-the-first-flag-that-moved
  **Source:** [burn tx 2, final](https://basescan.org/tx/0xe47921...)
  **Source:** [LP holder list](https://basescan.org/token/0x02dd...)
  **Opens-at:** 2026-08-20

  No live claims yet: the file starts empty and fills when app227 ships.
-->
