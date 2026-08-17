# BYKO — Specification

Version 1.3 · 2026-08-17

This document describes the BYKO token and the systems around it. Where this
document and the deployed contract disagree, the contract prevails — the
contract is the specification; this is its description. The document is
versioned in this repository; every change is a commit and therefore traceable.

## 1. Token

| | |
|---|---|
| Name | BYKO |
| Symbol | `BYKO` |
| Standard | ERC-20 (OpenZeppelin Contracts 5.4.0, unmodified) |
| Decimals | 18 |
| Total supply | `790,227 BYKO` = `790_227 × 10^18` base units, fixed |
| Network | Base (OP-stack L2 on Ethereum) |
| Chain ID | 8453 |
| Contract | `0x078bB16e24c8931fc007928c370422e5e38F4372` |

The entire supply is minted once, in the constructor, to the deployer.
The contract adds a single public constant (`MAX_SUPPLY`) on top of the
inherited ERC-20 and nothing else. Source: [`contracts/BYKO.sol`](../contracts/BYKO.sol) — 21 lines.

## 2. Invariants

These hold for the lifetime of the chain and cannot be changed by anyone:

- **Supply is fixed.** No mint function exists after the constructor.
  No burn function is provided; tokens sent to the zero address via
  standard means are rejected by OpenZeppelin's checks.
- **Nobody is in charge.** No owner, no admin role, no pause switch,
  no allowlist or blocklist, no transfer tax, no fees.
- **The code is final.** No proxy, no upgrade path. What was deployed
  is what runs, forever.
- **The source is public.** Verified on BaseScan with an exact match
  against the deployed bytecode.

## 3. Deployment record

| | |
|---|---|
| Creation tx | `0xeac11a3210328c21d1c96bb1c7dafbfdcb2f4a51b510049fa3cdf232b64b9378` |
| Block | 49,430,937 |
| Date | 2 Aug 2026 |
| Deployer | `omenas.base.eth` |
| Compiler | solc v0.8.34, optimizer default |
| Verification | BaseScan — Source Code Verified, exact match |

## 4. Genesis distribution

The single mint was divided once:

| Allocation | Amount | Share |
|---|---|---|
| Liquidity pool | 740,227 BYKO | 93.7% |
| Founder | 50,000 BYKO | 6.3% |
| **Total** | **790,227 BYKO** | 100% |

Pool funding tx: `0xc1ea5195a255df6ad0439b106fcd575a3e98fc2d43b3a94adb7935f45b3337f2`.

## 5. Market

| | |
|---|---|
| Pool | BYKO/USDC on Aerodrome (Base) |
| Pool address | `0x02dd4285ad38ea93d021ca854016a839b0b2a6ca` |
| Genesis ratio | 740,227 BYKO : 74.0227 USDC |
| USDC contract | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (6 decimals) |

The website reads price and reserves directly from the chain
(`balanceOf(pool)` on both tokens); no third-party price APIs are involved.

**The liquidity position is permanently burned.** LP tokens were sent to
`0x…dEaD` on 7 Aug 2026 — burned, not locked: nothing is recoverable by
anyone, including the founder, ever. The two transactions:

| Burn | Tx |
|---|---|
| 3.07% of LP supply | `0x176dbc759894fa605c78e95bc7b61f0254005358fed20ee70ef85b0c657d5476` |
| remaining 96.93% — final | `0xe47921b2208c15c8b2f95f07be37aa70269b46c7a38f7363817af8258da584c6` |

Live proof: the pool token's holder list on BaseScan shows `0x…dEaD` at 100%.
Nothing else in this section is a promise of liquidity or price.

## 6. Donation cards

A voluntary donation of BYKO can be recorded as a numbered certificate —
a donation card.

- **Donation address:** `0x42873C60bC22424dBB4518DF7bE8b7F9eF4ac1D6`.
  Any BYKO `Transfer` to this address in a successful transaction at or
  after block **49,614,625** is eligible; earlier transfers are not.
- **Issuance:** the card service verifies the transaction receipt on Base,
  reads the transferred amount (the nominal) and the block timestamp
  (the date), and issues a serial in the form `BK 0000001`. Issuance is
  idempotent per transaction hash: one tx, one card, forever.
- **Contents:** serial, nominal, date, transaction hash, an optional
  inscription supplied by the donor (≤ 300 characters), and a bearer
  contact. On the public page the bearer contact is masked.
- **Permanence:** each card is permanently available at
  `/card/{serial}` on the project site as an SVG. One notification
  letter is sent to the bearer per card.
- A card confers no rights, no yield and no claim on anything.
  It records that a donation happened. That is all it does.

## 7. Settlement in BYKO

The author accepts BYKO in payment for his own professional work. This
section describes that arrangement precisely, because it is the one place
where the token meets something outside the chain.

Two levels, deliberately kept apart:

- **The token.** Unchanged by this section. The contract has no built-in
  functionality, holders acquire no rights, and the issuer owes nobody
  anything. Nothing here is enforced by, or recorded in, the contract.
- **One person's decision.** The author, and only the author, has chosen to
  accept the token in settlement of his own invoices. It binds no other
  party, present or future.

The mechanics:

- **Base currency is the euro.** Work is priced in EUR. No price list is
  ever denominated in BYKO.
- **Rate at the invoice date.** The amount of BYKO is derived from the
  market rate on the date of the invoice: the reserve ratio of the
  BYKO/USDC pool on Base at one specific block, read from the chain the
  same way the project site reads the price. The block number is stated on
  the invoice, so the conversion is reproducible by anyone afterwards.
- **No fixed rate.** No rate is ever announced, guaranteed, or held. There
  is no aggregator and no third-party quote in the path.
- **Tokens received are kept.** Accepting them creates no commitment to
  convert, sell, or support the price.
- **Scope and refusal.** Which engagements are accepted, and whether a
  given invoice is settled in BYKO at all, remains the author's decision.
  No obligation to accept any particular volume arises.
- **No floor.** Because the price is denominated in euro, a lower token
  price means only that an invoice takes more tokens. This arrangement
  puts no floor under the price of BYKO and is not intended to.

## 8. Public read APIs

Provided by the project site, best-effort, no SLA:

- `GET /api/holders` — holder count and supply distribution across
  BaseScan-style tiers (whale ≥ 10% of supply, then decades down:
  shark 1–10%, dolphin 0.1–1%, fish 0.01–0.1%, crab 0.001–0.01%,
  shrimp < 0.001%), computed from on-chain `Transfer` logs.
- `GET /card/{serial}` — the donation card SVG.

These endpoints read chain state and never write to it.

## 9. Versioning

This specification lives at `docs/specification.md` in the
[bykovas/byko](https://github.com/bykovas/byko) repository. Changes are made
by commit only, so the full history of every revision is public. The PDF at
`website/ext/docs/specification.pdf` is generated from this file by
`docs/make-specification-pdf.py`, versioned alongside; the markdown stays
authoritative among project documents — after the contract.

| Version | Date | Change |
|---|---|---|
| 1.3 | 2026-08-17 | Settlement in BYKO added (§7); the disclaimer now separates the token from one person's decision to accept it |
| 1.2 | 2026-08-12 | Wording: liquidity is burned, not locked |
| 1.1 | 2026-08-07 | LP burn recorded: pool liquidity permanently locked |
| 1.0 | 2026-08-06 | Initial specification |

## Disclaimer

BYKO is a token with no built-in functionality, no yield and no promises,
and it gives its holder no rights. It does not represent equity, debt or any
claim on anything. That one person accepts it in payment for his own work
(§7) is his decision alone: it grants holders nothing and obliges nobody
else. Nothing in this document is financial advice. Verify the contract on
BaseScan before interacting. 1 BYKO = 1 BYKO.
