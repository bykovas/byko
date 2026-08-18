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

  Type semantics (the app architecture, §4.0):
  - A — a timeless on-chain fact: a transaction, contract code, a creation
    event. The link answers the same today and in a year; no frozen block.
  - B — chain state at a moment in time: balances, shares, holder lists —
    anything that drifts with every block. Frozen-at-block is REQUIRED:
    without a pinned block there is no honest yes/no.
  - C — a fact about public documents: what the site, the spec, the repo
    or a third-party scanner page says. Verified by reading a public URL;
    a claim about text, not about the chain — self-corrections included.

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

  First wave: 12 claims, two per day, second opens after the first.
-->

## genesis-mint — A

BYKO 0x078b…4372 was deployed on Base in block 49,430,937, tx 0xeac11a…b9378, minting the fixed supply of 790,227 tokens once.

---
**Entry:** genesis-one-block-one-number-no-promises
**Source:** [BaseScan — creation tx](https://basescan.org/tx/0xeac11a3210328c21d1c96bb1c7dafbfdcb2f4a51b510049fa3cdf232b64b9378)
**Source:** [Diary — Genesis](https://byko.bykovas.lt/d/genesis-one-block-one-number-no-promises)
**Opens-at:** 2026-08-18

## goplus-clean — C

GoPlus token_security for BYKO on Base (8453) returns is_honeypot 0, is_open_source 1, is_mintable 0, is_proxy 0.

---
**Entry:** flagged-what-the-scanners-actually-measure
**Source:** [GoPlus API](https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses=0x078bB16e24c8931fc007928c370422e5e38F4372)
**Source:** [Diary — Flagged](https://byko.bykovas.lt/d/flagged-what-the-scanners-actually-measure)
**Opens-at:** 2026-08-18

## deployer-signed — A

The signer of basescan.org/verifySig/95926 is the same address that created BYKO contract 0x078bB16e24c8931fc007928c370422e5e38F4372.

---
**Entry:** signed-by-the-deployer
**Source:** [Basescan verifySig 95926](https://basescan.org/verifySig/95926)
**Source:** [Contract page, Creator field](https://basescan.org/address/0x078bB16e24c8931fc007928c370422e5e38F4372)
**Opens-at:** 2026-08-19

## audit-correction — C

The 3 Aug entry 'Twenty holders and a $1.35 sell' opens with a correction: the holders were DEX routers, the sell never happened.

---
**Entry:** on-chain-audit-100-transactions-three-debunked-facts
**Source:** [Diary — corrected entry](https://byko.bykovas.lt/d/twenty-holders-and-a-1-35-sell)
**Source:** [Diary — the audit](https://byko.bykovas.lt/d/on-chain-audit-100-transactions-three-debunked-facts)
**Opens-at:** 2026-08-19

## lp-burned-100 — B

Address 0x…dEaD holds 100% of the supply of BYKO/USDC pool LP token 0x02dd42…b2a6ca on Base.

---
**Entry:** burning-the-liquidity-and-the-first-flag-that-moved
**Frozen-at-block:** 50131808
**Source:** [BaseScan — LP holders](https://basescan.org/token/0x02dd4285ad38ea93d021ca854016a839b0b2a6ca#balances)
**Source:** [Spec §5](https://github.com/bykovas/byko/blob/main/docs/specification.md)
**Opens-at:** 2026-08-20

## contract-21-lines — A

The verified BYKO source is 21 lines: unmodified OpenZeppelin ERC-20 plus one MAX_SUPPLY constant — no mint, owner or proxy.

---
**Entry:** genesis-one-block-one-number-no-promises
**Source:** [BaseScan — verified source](https://basescan.org/address/0x078bB16e24c8931fc007928c370422e5e38F4372#code)
**Source:** [GitHub — BYKO.sol](https://github.com/bykovas/byko/blob/main/contracts/BYKO.sol)
**Opens-at:** 2026-08-20

## spec-locked-vs-burned — C

The spec changelog: v1.1 (7 Aug) called the burned LP 'permanently locked'; v1.2 (12 Aug) corrected it to burned, not locked.

---
**Entry:** burning-the-liquidity-and-the-first-flag-that-moved
**Source:** [Spec §9 — version table](https://github.com/bykovas/byko/blob/main/docs/specification.md)
**Source:** [GitHub — spec history](https://github.com/bykovas/byko/commits/main/docs/specification.md)
**Opens-at:** 2026-08-21

## tally-one-vote — B

The published tally counts exactly one vote for: 0x30fd…efbf, holding 45,860.23 BYKO — about 5.8% of the 790,227 supply.

---
**Entry:** the-first-real-vote-for-legitimacy
**Frozen-at-block:** 50104223
**Source:** [tally.json](https://byko.bykovas.lt/data/tally.json)
**Source:** [Basescan — voter balance](https://basescan.org/token/0x078bB16e24c8931fc007928c370422e5e38F4372?a=0x30fd96c5ae61f0fb3d97e6159ab023710163efbf)
**Opens-at:** 2026-08-21

## invoice-wallet-256k — B

The disclosed invoice wallet 0xe8fC8769934f9461F7adF6F440ff3883E28021Eb held exactly 256,000 BYKO on 17 Aug 2026.

---
**Entry:** base-app-stopped-calling-it-a-scam
**Frozen-at-block:** 50131808
**Source:** [Basescan — wallet filter](https://basescan.org/token/0x078bB16e24c8931fc007928c370422e5e38F4372?a=0xe8fC8769934f9461F7adF6F440ff3883E28021Eb)
**Source:** [tally.json — 'trading, invoices' role](https://byko.bykovas.lt/data/tally.json)
**Opens-at:** 2026-08-22

## no-sell-aug-4 — A

The BYKO pool recorded no sells on 4 Aug 2026; the $1.35 sell in the 3 Aug diary entry does not exist on-chain.

---
**Entry:** on-chain-audit-100-transactions-three-debunked-facts
**Source:** [Diary — the audit](https://byko.bykovas.lt/d/on-chain-audit-100-transactions-three-debunked-facts)
**Source:** [Basescan — the pool](https://basescan.org/address/0x02dd4285ad38ea93d021ca854016a839b0b2a6ca)
**Opens-at:** 2026-08-22

## spend-corrected — C

On 16 Aug 2026 the published spend total was corrected from $85 to $123.29 — $74.02 pooled and burned plus $49.27 of the author's buys.

---
**Entry:** every-buy-but-one-was-mine
**Source:** [Diary — the correction](https://byko.bykovas.lt/d/every-buy-but-one-was-mine)
**Source:** [Diary — next entry repeats $123.29](https://byko.bykovas.lt/d/the-site-is-leaving-the-dark)
**Opens-at:** 2026-08-23

## basename-registered — A

The basename bykocoin.base.eth, announced as BYKO's handle on 12 Aug 2026, is a registered Basename on Base.

---
**Entry:** bykocoin-now-official
**Source:** [base.org/name/bykocoin](https://www.base.org/name/bykocoin)
**Source:** [Diary — Bykocoin](https://byko.bykovas.lt/d/bykocoin-now-official)
**Opens-at:** 2026-08-23
