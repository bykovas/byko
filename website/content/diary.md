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

## Twenty holders and a $1.35 sell — 3 August 2026

BYKO now has 20 holders. Not a typo, not a rounding of 20,000 — twenty addresses.

Most of them came from small rewards handed out to real people on Farcaster. Not an airdrop campaign, no quests, no wallet-farming: just tokens sent to individuals who were actually there. A Sablier-based airdrop was considered and dropped — roughly $2 per claim to distribute something worth a fraction of a cent is its own kind of joke.

I also bought BYKO out of my own pool, from a separate wallet, to see what happens. It works exactly as arithmetic says it should: in a pool this shallow, my own money moves my own price, and the fee goes to a pool whose LP tokens will end up burned. There is no clever trade here. It's a measurement.

One more data point, from 4 August: a sell of $1.35 didn't leave a scratch on the price. That's the entire depth of this market in one sentence — and the honest answer to anyone who asks what this token is worth.

---
**Teaser:** Twenty holders, a $1.35 sell that moved nothing, and the honest depth of a market this size.
**X:** BYKO has 20 holders. Twenty — not twenty thousand. Most came from small rewards to real people on Farcaster: no quests, no farming. A $1.35 sell on 4 Aug didn't scratch the price. That's the whole market, described honestly.

## Genesis: one block, one number, no promises — 2 August 2026

BYKO exists as of block 49430937 on Base.

Fixed supply: 790,227 tokens. That number is my birth date, not tokenomics — there is no model behind it, no emission schedule, nothing to explain. It was minted once, at deployment, and can never change: no mint function, no owner, no proxy, no transfer tax. Standard OpenZeppelin, compiled with solc 0.8.34, verified on BaseScan as an exact match. The source is public.

93.7% of the supply — 740,227 tokens — went straight into a BYKO/USDC pool on Aerodrome, together with 74.02 USDC. The remaining 6.3% stayed in my wallet.

The specification lives in the repository, not in a marketing deck: docs/specification.md in github.com/bykovas/byko. Every fact about this token is either verifiable on-chain or committed to git with a timestamp. The website reads the price straight from the pool contract — no third-party price API in the loop.

What happens next is the actual experiment: what it costs for a token with nothing to hide to stop looking like a scam.

---
**Teaser:** A token minted once, from a birth date, with 93.7% of supply going straight into the pool. Nothing left to promise.
**X:** BYKO is live on Base, block 49430937. Fixed supply 790,227 — my birth date, not tokenomics. Minted once: no mint function, no owner, no proxy, no tax. Verified on BaseScan. 93.7% went into the pool. Everything after this gets measured.
