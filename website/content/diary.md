<!--
  BYKO diary — the single source for all published diary content.
  Published entries only, newest first. After editing, run from the repo root:

    node scripts/render-diary.mjs

  and commit the regenerated pages together with this file.

  Entry format:

  ## {Title} — {DD Month YYYY}

  Long-form body. Paragraphs separated by blank lines. Inline markup:
  **bold**, `code`, [text](https://url). Lines starting with "- " form lists.
  A line that is only "![alt](/assets/diary/{slug}/{file})" becomes a figure:
  alt text is required and doubles as the caption, the file must be a PNG or
  JPEG committed under website/assets/diary, and the line never reaches the
  Facebook or X text.

  ---
  **Teaser:** one or two short sentences for the home-page card. Required.
  **X:** short post text for X, max 250 characters — the entry link is appended
  automatically. Optional: an entry without it goes to the site and Facebook
  but not to X. The X text is authored independently of the body; neither is
  ever derived from the other.
  **Image:** optional hero picture, "![alt](/assets/diary/{slug}/{file})" —
  same rules as a body figure (same-origin, PNG or JPEG, alt required). It is
  the lead image on the entry page, a thumbnail in the diary list, and the
  right-hand panel of the social (OG) card. One per entry, and separate from
  any inline body screenshots. A title that will not fit beside the image
  fails the build — shorten it or drop the image.

  New entries at the top. Pushing a new entry to main triggers
  .github/workflows/publish-diary.yml, which posts it to Facebook and X.
-->

## EURR is the opposite control case BYKO needed — 27 August 2026

Revolut launched EURR, a euro stablecoin designed to hold €1.00 and issued by a regulated electronic-money institution. Holders have redemption rights at par, Revolut distributes it, and Revolut X admits it for trading.

For BYKO, the interesting part is not the stablecoin itself. It is the trust model.

BYKO tries to build trust from the bottom: fixed supply, immutable contract, public author, public wallets, public repository, published corrections, almost no promises.

EURR starts from the other end: regulated issuer, legal redemption, institutional distribution and a financial platform already prepared to recognize it.

Technically, both are still tokens on a blockchain. But one arrives with an institution attached to it before most users ever see the contract.

That makes EURR a useful control case for the BYKO experiment.

I can now measure something that was difficult to isolate before: legitimacy latency.

How long does a newly launched institutional token take to receive a correct name, icon, price and normal treatment across wallets, explorers, token lists and price services? And how does that compare with a token that supplies public on-chain evidence but has no licensed issuer, corporate structure or distribution agreement behind it?

This is not a criticism of Revolut. Their model makes sense for a financial product: redemption rights and an accountable issuer are stronger guarantees for a user than a clean Solidity contract.

The useful question for BYKO is what happens downstream. Wallets and data products often look like neutral windows into a blockchain. EURR gives a chance to measure how much of what they display is actually inherited institutional trust.

The experiment is straightforward: once the official EURR contract is public, record when the same wallets used in the BYKO study recognize it, price it and classify it. Repeat on a fixed schedule. No comparison of investment value, only infrastructure recognition.

If EURR is recognized almost immediately while BYKO continues to require manual submissions and appeals, the result becomes more precise: crypto infrastructure does not evaluate only the contract. It also inherits trust from whoever stands behind the contract.

One limitation matters. Revolut currently describes EURR as launching on Ethereum, while BYKO is on Base. A future EURR deployment on Base would make the control substantially cleaner.

---
**Teaser:** Revolut’s new EURR stablecoin is interesting to BYKO for one reason: it is a young token whose legitimacy comes pre-installed through a regulated issuer, redemption rights and distribution. That makes it a useful control case for measuring how infrastructure treats institutional trust versus on-chain transparency.
**X:** Revolut’s EURR gives BYKO a useful control case: a new token whose trust arrives through a regulated issuer, redemption rights and distribution. Now I can measure how fast infrastructure recognizes institutional trust versus on-chain transparency.
**Image:** ![Two BYKO coins — one satin silver, one matte black — resting on a black tray](/assets/diary/eurr-is-the-opposite-control-case-byko-needed/coins.png)

## The first yes cost the manifesto — 26 August 2026

Something new happened in this experiment's ledger of refusals: a yes.

On 7 August, BaseScan rejected LUKO's Token Info application with a template checklist of possible reasons — unclear project information, placeholders, broken links, opaque team details, an email address outside the project's domain — without saying which one applied. The technical points checked out: the links worked, the founder is named in the site footer with a LinkedIn, and hello@meetluko.eu is on the project's own domain.

What failed, as far as I can reconstruct it, was the language. The description said what LUKO is in the project's own words: "no utility", "deliberate absence". A human reads that as a concept. An automated review reads it as a project with nothing behind it — which is exactly what the words say, stated more honestly than a checklist can afford to accept.

On 10 August the application went in again with the description rewritten as plain facts — a fixed one-time supply, two symbolic founder holdings of 19% each, ownership means membership — and the sector set to Collectibles. On 20 August BaseScan asked for a separate confirmation of representation: a reply from the project-domain address, in the same email thread, using their required wording exactly. It went out at 21:14. At 08:26 the next morning: "The token has been queued for update."

That is the first approval any token in this experiment has received from anyone. It went to LUKO — the deliberately worse control token, the one whose liquidity is not burned and whose founder wallets hold half the supply. BYKO, the honest one, holds only rejections; I checked its page today and its info tab shows the same empty template as before.

The procedural lessons are unglamorous. Eliminate the template's reasons yourself, because nobody will name the real one. Write the description as facts, because concept reads as emptiness. Answer in the existing thread, from the domain address; the verified email in the profile does not replace the representation confirmation. Do not file duplicate applications.

One more fact, checked today: five days after "queued for update", the LUKO page on BaseScan still shows the generic template — no icon, no description, no links. The first yes exists so far only in an email thread. In this experiment, that counts as a result twice.

---
**Teaser:** The first approval in this experiment went to LUKO, the deliberately worse token — granted once its manifesto was rewritten into plain facts. Five days later, the approved info still is not on the page.
**X:** The first yes in this experiment went to the wrong token: BaseScan queued LUKO's info update once the manifesto was rewritten as plain facts. The deliberately worse token now holds the only approval. Five days on, the page still shows the template.

## MetaMask says its impersonator flag is a broader issue — 25 August 2026

MetaMask says its impersonator flag is a broader issue

MetaMask flagged BYKO as an “impersonator.” A week later, their own support says the flag is part of a broader issue they are tracking internally, with no timeframe for a fix.

The interesting part is not that BYKO was flagged. It is that the wallet presented a categorical warning to users while its own support now says the mechanism behind that warning has a broader problem.

For this experiment, that is a useful result: sometimes the token is not what needs verification. The verifier does.

---
**Teaser:** A week after BYKO was flagged as an impersonator, MetaMask said the flag is a broader issue they are tracking internally. There is no timeframe for a fix.
**X:** MetaMask flagged BYKO as an impersonator. A week later, MetaMask Support says the “impersonator” flag is a broader issue they are tracking internally. No timeframe for a fix. The wallet makes the claim; support says the claim mechanism has a problem.

## My own random was not random — 25 August 2026

On 23 August I noticed that my own ledger looked wrong. A log calling itself random printed trade sizes of 3.61, 3.57, 3.49 in a row. The experiment has two bot arms wash-trading the project's own tokens on Base: BYKO and LUKO, a deliberately worse control token. Every parameter is pre-registered in public rules.json; its canonical sha256 is stored in the trading database, and the worker refuses to trade unless its bundled copy hashes to that stored value. Any change therefore requires a visible commit and a deliberate hash update. The live page calls this wash trading because disclosure is the point.

The first problem was arithmetic. Sizes were drawn uniformly from $0.30–9.00 and then clamped to 2.5% of the pool's USDC side, about $3.60 with the pool near $144. (9.00 − 3.60) / 8.70 = 62%: almost two thirds of all draws landed above the cap and collapsed onto one point. The ledger matched that percentage exactly enough to be embarrassing: 77 of 124 confirmed trades, 62%, sat on the cap to the cent.

Meanwhile I had always published the size as "drawn from $0.30–3.61". That described a distribution the worker was not producing. In the fifth amendment, I moved the draw itself into the published effective range. No parameters changed. The mean trade fell from about $3.58 to about $1.95.

The money figure was wrong too. "USDC spent" was a gross buy counter that never credited a sell. The real net positions were BYKO $27.56, from buys $114.27 minus sells $86.72, against the $114.27 shown before; and LUKO $7.71, from buys $123.65 minus sells $115.94. The page now shows net with the breakdown.

The rhythm still looked manufactured. Reversal targets of 5–15% against cap-pinned sizes consumed a run in two or three trades. The $10 balance corridor enforced roughly the same count. A pure run process also cannot produce a lone contrarian trade because direction changes only at reversal. The ledger read b-b-b s-s-s b-b-b: a three-count metronome.

The sixth amendment made three pre-registered changes. The reversal target widened from 5–15% to 3–35%. The corridor widened from $10–20 to $10–30. A new published coin, contrarian_pct = 20, makes one fire in five trade against its own run. It is drawn at fire time by the same CSPRNG as every other figure, from odds published in advance, subordinate to the corridor, price-deviation guard and funding, and never touches the run's clock or target. Every contrarian trade writes a public event naming itself. The page now prints the odds beside the claim they weaken: by rule SELL · flips 20% · turns at 12.17%.

Two days later BYKO reads s b s b s s s b b s b s b b b b b s s s s b, with sizes from $0.33 to $3.51 across the whole range. LUKO reads s s s s s s s s b s b b b b b s b s s s b s: an eight-trade sell run, then variety. Eight contrarian trades have been logged so far.

The uncomfortable sentence is now in the rules file itself: the purpose of these changes is to make manufactured flow look less manufactured. That is what wash trading is for, it is what this experiment demonstrates in the open, and a demonstration that fools nobody demonstrates nothing.

---
**Teaser:** My trade-size generator was technically random but produced the same capped value 62% of the time, while the direction logic exposed a three-count rhythm. I changed both and recorded why the changes make manufactured flow look less manufactured.
**X:** My own random was not random. A pool cap collapsed 62% of trade-size draws onto one point; then the reversal logic printed a three-count rhythm. I changed both, publicly and in the rules. https://byko.bykovas.lt/self-trading

## The price chain ends at the one thing BYKO refuses to have — 21 August 2026

For 18 days, BYKO had no price in one wallet. Today that wallet finally named the sources behind the number it shows:

“For tokens on the TON blockchain, we show prices for those that are either whitelisted on DeDust or have more than $20,000 liquidity on STON.fi. For EVM chains, we currently have two providers: Changelly and Near Intents.”

That answer gives the first complete path I have been able to trace from a wallet screen to the condition required for a price.

The first detail is important: Changelly and Near Intents are not market-price aggregators. They are swap routes. So the wallet is not asking the Aerodrome pool, GeckoTerminal or DexScreener what BYKO trades for. It is asking whether one of its exchange partners is willing to quote the asset.

For Changelly, the next step is documented. A token normally needs to trade on one of its partner exchanges: Binance, Kucoin, HitBTC, OKX, Huobi or Changelly PRO. If it does not, Changelly offers a separate listing process.

Near Intents works differently. Its supported-token list comes from the live 1Click API, with roughly 115 tokens across 20 chains. There is no public listing form. A token appears when a solver is prepared to quote it.

So for BYKO the chain now looks like this:

wallet price ← Changelly or Near Intents ← tier-one exchange support ← market maker + audit + roadmap

The last step is where this stops being a cost problem.

BYKO has an identifiable author and a signed deployer identity. It does not have a corporate structure, a market maker or an audit from a recognized firm. Those can at least be described as things that could theoretically be bought or arranged.

The roadmap cannot.

The project states on its front page: “no promises, no roadmap, no yield.” That is not missing documentation. It is a design constraint.

A conventional exchange-listing path expects a product narrative, users and a roadmap explaining how the token captures value. BYKO was constructed to make none of those promises. Following the wallet's own price chain therefore ends at a requirement the project has explicitly excluded.

That is the finding: the missing wallet price is not simply downstream of a thin pool or an unpaid data provider. For this route, price visibility ultimately depends on becoming the kind of project BYKO was designed not to be.

---
**Teaser:** For the first time in 18 days, a wallet named the sources behind BYKO's missing price. Following that chain leads from swap providers to tier-one exchange listing, then to market makers, audits and a roadmap — the one thing BYKO explicitly refuses to have.
**X:** For 18 days BYKO had no wallet price. Today one wallet finally named its sources: Changelly and Near Intents. Following that chain leads to tier-one exchange listing, market makers, audits and a roadmap. BYKO has no roadmap by design.

## The wallet blames security providers. The provider says it is not them — 20 August 2026

Base App shows BYKO with a red banner: **Flagged as a scam. You may lose your funds.** Tap it and a full-screen sheet gives two reasons: *flagged as malicious by security providers*, and *not verified by a trusted source*. I screenshotted it on 19 August at 23:01, and then on LUKO — the deliberately worse control token, whose liquidity is not burned and whose founder holds half the supply — at 23:02. Identical banner, identical two reasons, on a token that cannot be rugged and a token that can.

So I wrote to the security provider and asked three questions: what does your API actually return for this contract, verbatim; is "scam" a rendering you endorse; and is there any route at all for a token that is permanently small.

Blockaid answered all three on 20 August.

- "This contract is under the Category of **Spam**, returning the verbatim reason code **unstable-price**." The rationale is thin liquidity in the Aerodrome pool. Their words for it: "extreme market depth risk".
- "**Blockaid is not returning Malicious/Scam for this token.**" The Coinbase wording is, verbatim, "Coinbase's own classification (different vendor/policy)". They suggested I take it up with Coinbase.
- Reassessment requires two things: "substantially deepen liquidity in the main trading pool so the asset is no longer thinly capitalized, and to sustain healthier two-sided trading activity to prevent price manipulation from micro-trades."

The first two answers together are the finding. A wallet tells its users that a token was flagged as malicious by security providers. The named security provider — the one MetaMask reads, which surfaces the same signal as the mild "Unstable Token Price" — says in writing that it is not calling this token malicious, and that the harsher word belongs to the wallet, not to them. The verdict is presented as the judgement of outside experts. The outside expert says it is not his.

One detail worth keeping. Blockaid cites the pool as "product reserves sit around $136 and DexScreener reports roughly $270". Both figures are correct and they describe the same pool: one side of it, and both sides added together. The number that triggers the automated verdict is therefore not a fixed quantity but a choice of convention, and nobody along the chain has to state which one they used.

I have to correct my own numbers too, and the correction is unflattering. This site counted Base App's scam flag as removed on 17 August. It came back. Under my own definition — a flag counts as removed only when the warning is gone from the screen — a removal that was reversed is not a removal. Flags removed goes from two to one, wallet flags from one to two, both dated today. Leaving it as it stood would have been the most flattering error available to me, which is exactly why it had to go first.

There is one more thing, and it is uncomfortable in a useful way. The second condition Blockaid names for reassessment is sustained two-sided trading, so that price is not dominated by micro-trades. Since 19 August this project runs a disclosed wash-trading worker that produces exactly that: small buys and sells against its own pool, on a random schedule, every parameter published and hashed before the first trade. It satisfies the second half of their test by construction. It cannot touch the first half — depth would need roughly fifty times a supply fixed forever at 790,227 — and it does not try to.

So the prediction made before the first trade stands unchanged, and now it is measured against their own sentences rather than my summary of them: the flag will not clear, because the condition that produced it is depth, and depth is the one thing here that cannot move.

Coinbase has not been asked yet. That petition goes out next, and it gets counted when it is filed, not when it is answered.

---
**Teaser:** Base App says BYKO was flagged as malicious by security providers. I asked the security provider. Blockaid, in writing: it is not returning Malicious or Scam for this token, and the wording is Coinbase's own.
**X:** Base App calls BYKO a scam and blames "security providers". So I asked the provider. Blockaid, in writing: "Blockaid is not returning Malicious/Scam for this token." Their verdict is Spam, code unstable-price. Thin liquidity, nothing more.

## The fee is paid in the token, and no one can ever collect it — 19 August 2026

I started wash trading to test whether a market classifier could be satisfied. Then I found something I had not accounted for: the experiment slowly removes BYKO from circulation.

Aerodrome charges 0.3% on the input token of every swap. I assumed those fees stayed in the pool and increased liquidity. They do not. The pool's k has stayed exactly the same through the swaps I checked. The fee is transferred out to a separate fee contract.

That matters because on a BYKO sale, the input token is BYKO.

So every sale sends 0.3% of the sold BYKO to the fee contract. Normally LP holders can collect those fees. BYKO has no LP holder: 100% of the LP tokens were sent to the dead address. Nobody can ever claim what accumulates there.

The fee contract already holds 98.49 BYKO from the pool's entire history. That is tiny. The worker changes the scale.

At its current parameters, fourteen days of simulated two-sided trading would move roughly 3,977 BYKO into that unreachable contract — about 0.50% of the entire fixed supply. Keep the same process running and 1% disappears from usable circulation in about 26 days; 10% in about 258.

totalSupply() would still say 790,227. The contract would still be telling the truth. But an increasing part of that number would belong to nobody and could never return to circulation.

Which creates a fairly absurd result: I started generating trades to see whether a classifier would consider the token more market-like, and the procedure itself slowly makes the token less economically alive.

There is also a useful control. The same effect does not apply to LUKO in the same way, because its LP tokens are held by a wallet that can collect the fees. Same trading procedure, different ownership of the LP, different economics.

So this is now part of the experiment too. Not just whether simulated activity changes how external systems classify BYKO, but what that simulation physically does to the asset while I am trying to improve its appearance.

**Added at publication, 20 August 2026.** The fee contract held 98.49 BYKO when this was written. A day later it holds 241.09 — 142.60 BYKO in roughly twenty-four hours, or 0.018% of supply per day. That is the paragraph above measured instead of projected, and it is running at about half the estimated pace. The estimate assumed a trade mix and a size range that have since been amended twice: a run now reverses at a percentage drawn from 5 to 15 rather than at a fixed balance, and every trade is capped at 2.5% of the pool's USDC side. Only sales pay the fee in BYKO, so the rate follows the ratio of sales to purchases, and both amendments changed that ratio. The real figure will be published from the ledger rather than re-projected here.

---
**Teaser:** Aerodrome takes 0.3% of every swap out of the pool, not into it. On a BYKO sale that 0.3% is BYKO, sent to a fee contract nobody can ever claim, because the LP was burned. The experiment eats its own token.
**X:** I started wash trading to test a market classifier. Then I found the experiment has a physical cost: every BYKO sale sends 0.3% of the sold tokens somewhere nobody can ever collect. At the current pace, 14 days removes about 0.5% of supply forever.

## Day 17: I asked everyone I could, and nobody came — 19 August 2026

Day 17. I asked everyone I could, and nobody came.

**Written on 18 August, before the airdrop, and published here unchanged except for this paragraph.** Everything below is about what happens when you ask people to come. Later the same day I stopped asking and sent 227 BYKO to 908 wallets that never asked for anything, so the holder count now reads 916 rather than the zero movement described here. Both facts stand: nobody arrived because they were invited, and nine hundred arrived because they were handed something. The entry measures invitation, and invitation returned zero.

Over two days I did everything a project with no budget can do. Posted in three Farcaster channels and pinned a giveaway: 227 BYKO to the first hundred people who comment, no address to paste, nothing to sign. Shipped a mini-app where readers fact-check my own token and get paid for it. Posted on X, LinkedIn, Facebook. Set up an account on Lens — which cost $2.50, two hours, and revealed that its largest crypto community has 244 members. Wrote personally to people who know me.

What came back: one quote from an AI agent with 739 followers, offering to analyse the retention data once there is any. Zero comments under the giveaway. Zero answers in the app. Three offers of paid promotion in my DMs — $100 for a pin, $150 for a week of "community management", and one suggestion to relaunch the whole thing on pump.fun "for a bag". All declined.

New holders: zero. Not a small number. Zero.

In sixteen days the token has had exactly one outside buyer, and that person knows me.

I don't think this means the channels were wrong. I think it means the thing I was measuring has an answer, and the answer is unflattering: without a budget and without hype, nobody comes. The diary gets read — the $123-and-three-refusals post gets quoted — but reading is free and holding is not, even when holding costs five cents. Attention doesn't convert to a wallet on its own.

That is a result. It's not the one I wanted, but the experiment was never about wanting.

So: a week of silence. No more posting, no eleventh platform. The giveaway stays open, the app stays open. I'll watch whether anyone arrives on their own — because if the number is still zero in a week, it stops being about channels.

Everything above is on-chain or on the site. The holder count reads live from the chain and will show the same zero movement whether or not I write about it.

---
**Teaser:** Two days, every channel I could reach, a giveaway, an app, personal messages. New holders: zero. Published because zero is a measurement too.
**X:** Day 17. I asked everyone I could — three Farcaster channels, X, LinkedIn, Lens, a giveaway, a mini-app, DMs to people who know me. New holders: 0. Not a small number. Zero. Published because that's the measurement.

## What does “lack of information” mean? — 19 August 2026

I wanted a control case for the phrase Basescan has used three times when rejecting BYKO: **“lack of information about the token/project.”** Today I found one.

This is IDOS, contract `0x8a6940912ab777eefd07499e0c39be62fb51d73d` on Base. Its Basescan Token Info page is fully populated: logo, website, CoinMarketCap, email, X and Telegram. I am not reporting it, calling it a scam, or asking Basescan to remove anything. I am using only what Basescan itself shows on the page, because that gives me something measurable to compare.

At 13:44 UTC on 19 August, the same page showed:

- 11,057 holders
- 1,000,000,000 IDOS maximum supply
- $0.289 displayed price
- $0.00 volume in 24 hours
- $0.00 circulating-supply market cap
- 0.00 IDOS circulating supply
- 0 transfers in 24 hours
- Token Reputation: **UNKNOWN**
- no submitted contract security audit

The source-code tab is also unusual. It is Vyper 0.3.10 and marked **Similar Match Source Code**, pointing to another deployed contract rather than an Exact Match verification. The ABI includes `divide_numbers(a,b)` and `calculate_exponent_modulus(a,b,c,threshold)`, plus `lastFrom`, `lastTo` and `sender`. The deployed bytecode shows an external call path during `transfer` and `transferFrom` when a storage slot is populated. Basescan also exposes UI-multiplier behavior for the token, meaning displayed token amounts can be scaled by an active multiplier.

Again: none of those facts make IDOS malicious. They are simply facts visible on the explorer.

Now put BYKO next to it.

BYKO is `0x078bB16e24c8931Fc007928c370422e5e38F4372`, deployed on Base on 2 August 2026. Its source is **Exact Match**, Solidity 0.8.34, OpenZeppelin 5.4.0, twenty-one lines, with the license declared. Supply was minted once at genesis and is fixed forever at 790,227. There is no mint function, owner, proxy, upgrade path, transfer fee, pause mechanism or external call.

Its LP is 100% burned to `0x…dEaD`. The deployer has a public signed message identifying the controlling person. That identity links back through the project's website and LinkedIn. The repository is public. The wallet register is public and machine-readable. The project has an email address on its own domain, X, Telegram, Facebook and Farcaster. The issuance is disclosed down to percentages, read from the chain an hour before publishing: 56.99% in the burned pool, 11.02% held by the author across thirteen published wallets, 32.00% in independent addresses. Yesterday that middle figure was 9.09%, and it rose for a reason this diary would rather state than have noticed: the self-trading experiment's own wallet is holding tokens it bought out of the pool. At these prices a four-dollar position is two percent of the supply. There are real pool trades. There is a public diary that includes corrections of the project's own false claims.

BYKO was submitted to Basescan on 4 August and rejected. Then rejected again on 5 August. Then again after another submission around 9–10 August, with the third rejection arriving on 11 August.

The rejection language has stayed generic: usually a lack of information about the token/project, sender email not matching the official domain, possible false information or misrepresentation of public entities, or a name/symbol susceptible to brand impersonation.

The useful part is not that one project passed and another failed. The useful part is that **“amount of public information” cannot explain the difference**. BYKO has more of it across every category I can actually count: exact source verification, deployer identity, wallet disclosure, repository, liquidity status, transaction history, issuance disclosure and project history.

So I am not opening a new application. I am replying in the existing thread with one question:

**Which specific piece of information is missing from BYKO?**

Not “what are your criteria?” Not “why did you approve them?” Not “please reconsider.” Just one falsifiable question. If the answer is a missing field, document or condition, I can supply it. If there is no such field, then “lack of information” is not the criterion that decided the application.

That distinction is the entire experiment.

---
**Teaser:** Basescan rejected BYKO three times for “lack of information.” Then I found an approved token page with Similar Match code, no submitted audit, zero 24h volume and zero circulating supply — while BYKO has Exact Match code, burned liquidity, a signed deployer, public wallets and a public repository.
**X:** Basescan approved full Token Info for IDOS: Similar Match code, no audit, zero 24h volume, zero circulating supply. BYKO: Exact Match, fixed supply, burned LP, public repo, signed deployer — rejected three times for “lack of information.”

## The only advice I can follow is to fake a market — 19 August 2026

I asked Blockaid to look at BYKO again. They answered properly — no template, no silence — and it is the most useful reply this project has received from anyone. Their words, published here in full and unedited:

- "We can confirm that the remaining signal you're seeing is not a malice flag. It's tied to market-condition heuristics, specifically the Spam / unstable-price pattern that activates when a token's trading environment is extremely thin."
- "Deepen liquidity in the primary trading pool, so the market is no longer thinly capitalized."
- "Sustain two-sided trading, so price is not dominated by tiny trades."
- "After liquidity and trading conditions improve, request a fresh rescan — this signal typically clears once the pool is no longer at illiquid levels."

Nothing below is a complaint about Blockaid. They named the mechanism instead of hiding behind a category, and they offered a rescan. This is what happens when you take good advice seriously and do the arithmetic.

**The first recommendation cannot be followed.** Not "is hard" — cannot. The pool holds 466,468 BYKO against $117 of USDC, which is what makes the price $0.00025 and the whole pool worth $235. Lifting it to a $2,000 pool would take 3.5 million BYKO. The entire supply, fixed forever at genesis, is 790,227. Reaching $20,000 — still small by any listing standard — would take about fifty times every token that will ever exist. No amount of my money fixes this, because the binding constraint is not money. The token's entire float is worth $198.

**The second contradicts itself at this depth.** I measured what a trade does to the price here:

- $1 moves it 1.7%
- $5 moves it 8.7%
- $10 moves it 17.8%
- $20 moves it 37%

Real trades in this pool have been $0.79 to $9.90, median about a dollar. So "not dominated by tiny trades" starts around $10 — and $10 is an eighteen percent jump, on a signal named *unstable price*. There is no trade size that satisfies both halves. Small enough to keep the price still is exactly the tiny trade they object to; large enough to matter is exactly the instability they flag. And the way out of that trap is the first recommendation, which is closed.

So the third can never be reached. Three recommendations, and the loop has no exit.

**Then I checked whether the flag reads volatility at all, and it does not.** BYKO's price moved **−0.62%** in the last day and 0% in the last six hours — steadier than almost anything that trades. Meanwhile MetaMask's own price service, asked for a BYKO price, returns **HTTP 500**. Ask it about USDC and it answers 0.999688. So "unstable price" does not mean *this price moves too much*; it means *we cannot derive a price we trust*. The operative variable is depth, exactly as their last line says. Which means the trading recommendation cannot clear the signal even if I follow it perfectly.

**And that leaves one thing I can actually do.** Sustain two-sided trading in a token nobody trades means my own wallets buying and selling against the pool on a schedule. That has a name and I am going to use it: **this is wash trading**. Trading with yourself to manufacture the appearance of a market. On regulated venues it is illegal, for good reasons. Here there is no exchange, no order book and no counterparty being deceived about who stands on the other side — and I am publishing the instruction that prompted it, the parameters, and every trade. None of that makes it something else. It makes it wash trading, disclosed.

**What will run.** Two wallets, both already listed in the public register on this site — no new addresses, because a sybil layer on top of wash trading would make the measurement worthless. Each draws a random delay between 5 and 180 minutes and a random size between $0.30 and $9.00, holds a $20 float, and buys when that float is above $10 and sells when it is below. That is the whole strategy: it has no view on price and will not be given one. Every parameter is committed to the repository before the first trade, hashed, and checked at runtime, so it cannot be quietly tuned mid-run. Every trade is published as it happens — time, side, size, price before and after, and the transaction hash.

**Two tokens, not one, and the second one is the uncomfortable half.** BYKO's liquidity is 100% burned; nobody can withdraw it, me included. LUKO's is not: 100% of its LP tokens sit in a wallet I control, and I could pull that pool at any moment. It has thirteen holders, a quarter of its supply with its creator, and almost no sells in its history. Running the same worker on both asks whether a classifier treats a structurally clean token differently from one carrying real red flags. I am stating the objection to the LUKO arm myself, because it is the strongest one available and someone should make it: this is a founder generating volume in a token whose liquidity he can remove. The page will show that LP holder and balance live, so anyone can watch that it stays untouched.

**Written before the first trade, so it cannot be adjusted afterwards.** The BYKO arm stops when MetaMask's price service returns a number instead of 500, or when Base App stops showing "scam" on two consecutive daily checks — two, because that flag already vanished and came back within eighteen hours once, and one observation is luck rather than measurement. Failing both, it stops at fourteen days. My prediction, on the record: it will not clear, because the condition Blockaid named is depth and the worker does not touch depth. Cost, about fifteen dollars in fees and gas.

If I am wrong and the flag clears, then a token that changed nothing about itself — same immutable contract, same burned liquidity, same fixed supply, same 919 holders — became clean by simulating a market it does not have. I would rather be right.

**One thing I found while building the instrument.** I went to check what each wallet reports about BYKO — Rabby, MetaMask, Base, Trust, Rainbow, Phantom, Zerion, Uniswap, OKX and the rest. Seventeen products, and behind them four sources: Blockaid, GoPlus, a couple of curated token lists, and the wallets' own price services. Most of them classify nothing at all; they display what someone else decided. A user opening four wallets and seeing the same warning four times feels confirmed by four independent judges. There is one judge and four windows.

---
**Teaser:** A security team told me exactly how to clear my token's last flag. One instruction needs fifty times my entire supply; the other, for a token nobody trades, means buying from myself. So that is what I am going to do — in public, under its real name, with every trade published.
**X:** A security team told me how to clear my token's last flag: deepen liquidity, sustain two-sided trading. The first needs 50x my supply. The second, for a token nobody trades, means buying from myself. So I will, in public, publishing every trade.

## Six cents did what 908 holders could not — 19 August 2026

Before sending I predicted two things: the holder count would go up, and the automatic classifiers would like the token less. The first came true within hours. The second has not happened yet, and something I did not predict happened instead.

By the end of the evening 908 wallets had each received 227 BYKO. Not the 227 I published a plan for — I sent four batches, all inside two hours. Calling that four waves would be theatre, so I will not: the plan changed mid-experiment. The entry that pre-registered it stands exactly as written, and this one amends it by addition rather than by editing, because a prediction you can revise afterwards is not a prediction.

The token went from 7 holders to 916.

**GoPlus noticed first.** Four minutes after the first batch it still said 8 holders. Three and a half hours later, before the second batch went out, it said 237. I know that number belongs to the first batch and to nothing else only because I took a reading in the ten minutes between them. That reading is the one thing that made the evening measurable, and I nearly skipped it as a formality.

Then the part nobody planned.

One recipient received its 227 BYKO at 20:10:15 and sold the lot into the pool at 20:13:23. Three minutes and eight seconds, for **$0.057**. It is not a person: the same wallet auto-dumps everything that lands in it, PEPETO and SXC and GENESIS in the hours before mine.

I first wrote that this was the first trade in the token's life. It was not, and the correction is at the bottom of this entry: the pool has seen 38 swaps since 2 August, and almost every one of them was me buying my own token with project wallets. What was true is narrower and stranger — it was the first trade after a two-and-a-half-day silence, and the first one where the seller was somebody who had been handed the tokens without asking.

**DexScreener listed the pair minutes later.** At 19:45 it did not list the token; the sale landed at 20:13:23; by 20:16 the pair was there. It had ignored BYKO through 908 holders, through liquidity whose LP tokens are 100% burned, through a verified contract and a published specification. What I cannot honestly claim is that the six cents *caused* the listing — 908 transfers had also just landed, and I have one observation, not an experiment.

Blockscout still reports zero holders. It has never indexed this token and today changed nothing.

**What about the other 907?** Every single one still holds exactly 227, untouched. I would like to read that as patience, or indifference, or consent. It is none of those. Base App, MetaMask and Rabby hide unknown tokens by default, and mine was flagged as malicious by security providers a day earlier. The recipients have not decided to keep the tokens. They have not seen them.

Which kills the comparison I was most curious about. I wanted to set people who came and asked to check a claim against people handed the same 227 without being asked — same amount, opposite consent. But the asked side is no better. The second person ever to use the app was a mini-app farmer who collected 405,313 EMERGE at 19:01, my 227 BYKO at 19:06, and minted 4,880 $MOON at 19:09. He answered both verification claims four seconds apart, both yes, no argument. He verified nothing. He tapped twice to keep the money.

So consent was never measured. On one side the tokens are invisible; on the other the verification is reflexive. That is not a failed experiment, it is a finding about what those two words are worth here.

One more thing, recorded because leaving it out would be a lie by omission. The cohort for the last two batches was built while the previous batch was still sending, so its "holds no BYKO" filter read balances that were seconds from changing: 119 of its 454 addresses had just been paid. It was checked before the send, thrown away and rebuilt. Nobody was paid twice. But it was close, and the only reason it was caught is that the check runs before the money and never after.

The evening cost 206,116 BYKO — about fifty-two dollars at pool price — and under a dollar of gas. Something got the token listed that eleven days of honest disclosure had not, and I can name the candidates but not the winner.

**Correction, 19 August 2026.** The first version of this entry said the bot's sale was the first trade in the token's history and that DexScreener had never had a trade to index. Both are false, and the reader who caught it was the person this diary is about. The pool has carried 38 swaps since 2 August — 33 buys and 5 sells, about $55 of volume — and nearly all of them were mine: project wallets buying my own token, which the counters page has always listed as $49.27 of buys and $5.57 returned by sells. The one outside buy was a neighbour's, for $9.90 on 14 August. I trusted a scanner's trade feed instead of reading the pool's own logs, which is exactly the mistake this study exists to document, made by the person documenting it. The title of this entry claims more than the evidence supports; it stays as published, because the URL is already in two social posts and quietly renaming a claim is worse than leaving it standing next to its correction.

---
**Teaser:** 908 wallets got 227 BYKO each and the token went from 7 holders to 916. What finally got it listed on DexScreener was none of that — it was one bot selling its share for less than six cents.
**X:** 908 wallets received 227 BYKO each. Holders went from 7 to 916. What finally got the token listed was not the holders — it was one bot dumping its 227 for six cents, the first trade in the token's life.

## 227 wallets that never asked — 18 August 2026

The next experiment is one I expect to lose.

I am going to send 227 BYKO to 227 wallets that never asked for anything. They are not friends, not followers, not a whitelist. They were picked mechanically: wallets that spent USDC at a decentralised exchange on Base within one day, that belong to people rather than to contracts, that have some history and some gas, and that hold no BYKO. Of the 712 buyers in that window, 453 were people's wallets, 284 of those were alive and empty of BYKO, and the 227 most recent ones were taken. Every filter with its before-and-after count is published as a file, so anyone can rebuild the same list from the same blocks.

Why do it. For two weeks this project has asked its question from one side: does an honest token get treated as honest? This asks from the other side. An airdrop is the most suspicious shape in this industry — tokens arriving in wallets that did nothing to receive them — and it is also the fastest way to turn one holder into many. Both are true at once, and nobody publishes what happens when you do it deliberately and measure it.

The prediction, written before the send so it cannot be adjusted afterwards: the holder count goes up, and the automatic classifiers like the token less. I have one data point in that direction already — a single transfer of my own token to a fresh wallet, and the scam warning came back within a day.

Here is what the machines say about BYKO an hour before the send, at block 50,142,957:

- Holders: 7 by my own count, read from transfer logs. GoPlus says 8. Blockscout says 0, because it does not index this token at all.
- Price: $0.000252, taken from the pool, which holds 466,015 BYKO against $117.58. There is no other price.
- Fully diluted value: $200. Trading volume in the last 24 hours: zero.
- GoPlus security flags: not a honeypot, source verified, not mintable, not a proxy, creator holds 0.027%, owner holds nothing.
- DexScreener does not list the token. It has never heard of the pool.
- Base App: flagged as malicious by security providers, as of this morning.

That is the baseline. Whatever those numbers look like in a week is the result — better, worse, or unchanged.

What gets measured: everything a machine can read, at three moments — before, twenty-four hours after, seven days after. And per wallet: who kept the tokens, who sent them straight to the pool, who never touched them. Whatever a scanner refuses to answer is recorded as unanswered, because silence is data too.

The part I am most curious about is the comparison. There are now two groups: people who came to the app and asked to check a claim, and people who were handed the same 227 without being asked anything. Same amount, opposite consent. If both groups behave identically, then this project's premise — that asking honestly matters — is worth less than I think.

Cost: about eight cents of gas. At stake: 51,529 tokens, roughly thirteen dollars, and whatever reputation an experiment can lose in a week.

---
**Teaser:** 227 strangers are about to receive 227 BYKO each without asking. The prediction and every baseline number — 7 holders, $0.000252, zero volume — are published before the transfers.
**X:** Next: 227 BYKO to 227 wallets that never asked, chosen mechanically from today's Base buyers. Prediction, written before the send: holder count goes up, classifiers like the token less. Measurements taken before, at 24h and at 7 days.

## The flag came back, and I know what I did — 18 August 2026

Yesterday evening Base App stopped calling BYKO a scam. Today the warning is back: flagged as malicious by security providers, not verified by a trusted source.

This time I know what happened in between, because almost nothing did. In eighteen hours the deployer wallet did two kinds of things, and both were me testing my own app: I sent myself 227 BYKO through the claim flow, and I sent ETH to cover gas.

The ETH transfer was not flagged. Nothing about ETH ever is.

So the candidate is the other one: my own token moving from the deployer wallet to an address that had never held it. To a classifier that shape has a name, and the name is not "a developer testing his own app". It is the opening move of an airdrop — a token nobody asked for starting to appear in wallets that did nothing to receive it.

What is strange is that nothing else changed. The contract is the same 21 lines it was at genesis. The liquidity is still burned. GoPlus, which reads the same chain, still returns the same four zeros it returned yesterday: not a honeypot, source verified, not mintable, not a proxy. The creator holds 0.027% of the supply. Seven wallets hold the token, eight by GoPlus's count. The pool holds 466,015 BYKO against $117. Trading volume in the last twenty-four hours: zero.

Nothing in those numbers moved. One transfer did.

I cannot prove this is the reason. Nobody says which provider flagged it, or why, and support has already stated in writing that they cannot remove the warning. What I can say is that the list of things I did contains exactly one candidate, and I put it there myself.

Which makes what comes next uncomfortable. The next experiment is precisely this pattern, on purpose and at scale: 227 wallets that never asked, 227 BYKO each. The prediction is written down before it runs.

So this entry is not a complaint. It is the control measurement. One transfer of my own token to one new wallet, and the flag returns within a day. Now we find out what 227 of them do.

---
**Teaser:** Eighteen hours after the scam warning disappeared, it was back. In between, the deployer did two things — sent ETH, and sent 227 BYKO to a fresh wallet. Only one of them looks like an airdrop.
**X:** The scam flag on BYKO is back after 18 hours. In between the deployer did two things: sent ETH, and sent 227 BYKO to a fresh address through my own app. The ETH was fine. Moving my own token to a new wallet was not.

## BYKO 227: fact-check my token, become part of it — 18 August 2026

I shipped a small app today. It cost nothing — $0, eleven hours, nine espressos — and it exists to check whether I'm telling the truth.

BYKO 227 is a mini-app inside Farcaster. Every day it shows two claims about my own token, taken straight from the public diary: the genesis transaction, the burned liquidity, what the scanners say, including the entries where I got things wrong. The reader's job is to spend a minute checking one claim against two open sources — BaseScan, the repository, the site itself — and answer: Yes, No with a reason, or Can't verify. The third answer weighs as much as the first two. "I couldn't check this" is a result, not a shrug.

Why this exists: for two weeks every fact about the experiment has been published by me. "I audited myself and I confirm I'm honest" is worth exactly nothing. So the audit goes to whoever wants it.

Every answer is recorded. The app knows you by your Farcaster account, keeps a daily count, shows how many people answered today and overall, and keeps a leaderboard — ranked by how many claims you checked, not by how many you got "right", because there are no right answers here, only checked ones. When three people independently say Yes to a claim, it is sealed, and their handles are printed under it on the site. Permanently.

Then the experiment gets sharper. For the first round I pay 227 BYKO up front — before asking anyone for anything. After that, the only reward goes to whoever catches me lying. Paying for confirmations would be buying approval; paying for a caught mistake is buying an audit.

Everything is public: the method, the contract, the transfers, every answer, every verdict. The running ledger is [here](/ledger) — every advance and every verdict, read live from the worker and verifiable on BaseScan.

Small catch: anyone who helps check the experiment becomes part of it — and a BYKO holder.

---
**Teaser:** A Farcaster mini-app where readers fact-check my own token: two claims a day, open sources, three Yes seal a fact and your handle goes on the site forever. $0, 11 hours, 9 espressos.
**X:** Shipped BYKO 227: a Farcaster mini-app where you fact-check my own token. Two claims a day, open sources, Yes / No / Can't verify. Three matching Yes seal a fact — your handle goes under it on the site, forever. Spent: $0, 11 hours, 9 espressos.

## Base App stopped calling it a scam — 17 August 2026

Base App just stopped calling BYKO a scam.

For sixteen days the Coinbase wallet hid the token from the portfolio entirely, with a warning that it was flagged. When I opened a support case, Coinbase answered in writing that the warnings come from third-party security providers, that support cannot remove them, and that they could not tell me which provider had flagged the token.

Today it shows a price. 256,000 BYKO, $64.57, in the total balance next to ETH and USDC. The token page has no warning at all — market cap, liquidity, holder count, trade history, Buy and Sell. Everything read straight from the pool, and every number matches the site.

What I did to make this happen: nothing. The support case was never answered. The Blockaid report was drafted and never sent. The formal complaint was never filed. One day the flag was there, the next day it was not, and nobody said why.

That makes two flags removed. MetaMask dropped "low locked liquidity" on 8 August, one day after the liquidity was burned — also without an appeal. Base App dropped "scam" today — also without one. The only institution I actually wrote to, three times, is the only one where nothing has moved.

So the measurement so far reads: letters don't help. Time and on-chain state apparently do. Whether it was the token's age, the burned liquidity, or a signal that finally reached their provider — I don't know, and I'd rather write that than guess.

Still standing: MetaMask's "unstable price", and three rejections from Basescan.

---
**Teaser:** Sixteen days after hiding BYKO as a scam, Base App shows it with a price and no warning. Nobody appealed, nobody replied, nobody said why.
**X:** Base App just stopped calling BYKO a scam. No email, no appeal, no reply to the support case — one day it was hidden from the portfolio, the next it shows a price, holders, liquidity, Buy and Sell. Second flag removed. Reason: not given.

## Two hundred and twenty-seven, to anyone who asks — 17 August 2026

For two weeks BYKO had almost no holders. That was the honest result of the experiment, and I published it. Now I want to change that number the only way that doesn't compromise the measurement: by giving the token away to people who ask for it.

227 BYKO to the first 100 people who ask. The genesis supply is 790,227 — my birthday, split in two. You're getting the second half. At today's price it is worth about six cents, so nobody should mistake this for an opportunity.

The rules are deliberately boring. Reply publicly with a wallet address. I send the tokens from bykocoin.base.eth, an address I have publicly verified as mine. There is no claim contract, no site to connect your wallet to, no approval to sign, no form to fill in. Nothing here can drain anything, because there is nothing to interact with.

One thing to expect: some wallets will show the balance as $0.00, and some will show a warning. That is the whole subject of this diary — a fixed-supply token with no owner, no mint and burned liquidity still looks like a scam to the infrastructure. You can check the price on GeckoTerminal and the contract on Basescan.

Why do it at all: a token with three holders cannot pass the criteria data providers and exchanges apply, and I have already refused to buy my way past them. Real holders are the one input I can obtain honestly.

Everything, including the full list of recipients, gets published afterwards.

---
**Teaser:** 227 BYKO to the first 100 people who ask for them — no claim contract, no wallet connection, just a transfer.
**X:** Giving away 227 BYKO to the first 100 people who reply with a wallet address. No claim contract, no wallet connection, no forms — just a transfer. Worth about $0.06. The point isn't the money, it's whether an honest token can find real holders.

## The site is leaving the dark — 17 August 2026

The site is leaving the dark.

Not for fashion. The old one was a dark developer-tool template — near-black background, a blue accent, a faint grid, glass header. Competent, and indistinguishable from a hundred other crypto pages. Worse than that: it read like a chronicle of something that had already ended.

Three things were quietly wrong with it. Body text sat at 72% opacity, captions at 45%, and the data rows were dimmed until you hovered them — the verifiable layer, the entire reason the site exists, was the faintest thing on the page. Small monospaced type had taken over: there was more of it than prose, which made every caption read like a terminal log or legal fine print. And the hierarchy was upside down — the largest thing on the page was the question, the second largest number was "1", the single vote in the referendum, and the findings came third.

The counters had the same problem. Four of the six measured damage: rejections, flags. A study that only counts what was done to it is not a study, it is a complaint.

The new direction is an instrument panel. BYKO has described itself as a measuring instrument from the beginning, so the page is now built like one: light, in print, with parameters, tolerances and provenance. Readings carry the resolution they were measured at. Every figure says where it came from — blue means read live from the chain and you can verify it yourself; plain means counted by hand from the log and you are taking my word for it. The colour is no longer decoration; it tells you which numbers are checkable without me.

One section is inverted against the rest: invoices settled in BYKO. It is the only part of the instrument that points forward instead of recording the past, so it looks different on purpose.

The numbers have not changed. $123.29 spent, 99.5 hours logged, $0 paid for legitimacy, three institutions petitioned, one holder who is not me. Same proofs, same transaction hashes, same public repository — every edit is still a commit. Only the reading of them got easier.

The typefaces are self-hosted rather than loaded from Google's servers, for the same reason the analytics went cookieless last week: a study about legitimacy should not quietly hand its readers' addresses to a third party.

---
**Teaser:** The site is leaving the dark — not for fashion, but because the old template read like a chronicle of a dead project instead of a study in progress.
**X:** BYKO's site is leaving the dark. Same numbers, same proofs — but the old dark-theme template read like a chronicle of a dead project, not a study in progress. New direction: an instrument panel, light, in print.

## BYKO now sits in exactly two wallets — 17 August 2026

BYKO now sits in exactly two wallets.

Until today it was scattered across nine addresses. Not for any reason worth defending — it happened the way these things happen, a few tokens moved here to test something, a few more moved there, and after two weeks the holdings looked like a map nobody could read, least of all me.

That matters more than it sounds. The disclosure section of this site lists every wallet the author controls, and a list of nine addresses with fractions in each is technically complete and practically useless. Anyone checking it has to add the numbers up themselves and trust that none were left out.

So the dust has been swept into one place. One wallet holds the tokens. A second, the deployer, holds the operational balance — it is the address that signs, that was verified on Farcaster, and that anything given away will be sent from. That is the whole map now.

What did not happen: nothing was bought, nothing was sold, and no amount changed hands with anyone. Every one of these transfers is a movement between two addresses that were already disclosed, and every one is on-chain with a hash. The total held by the author is exactly what it was this morning — 278,173 BYKO, 35.2% of supply.

One address was deliberately left alone: the single holder who is not me. It stays where it is.

This is housekeeping, not strategy. But an instrument whose own readings are hard to check is a bad instrument, and the wallet map was the last part of this study that took effort to verify.

---
**Teaser:** Nine addresses became two. Nothing was bought or sold — the wallet map is simply readable now, and every transfer that made it is on-chain.
**X:** BYKO now sits in exactly two wallets. Nine addresses, one instrument — the scattered dust is swept into one operational wallet, the holdings into another. Nothing sold, nothing bought, every transfer on-chain.

## Every buy but one was mine — 16 August 2026

The on-chain audit turned up one more number this diary hadn't published: $49.27.

That's the total of every buy ever made from the BYKO pool. Thirty-three transactions across two weeks, and all but one of them were mine, made from project wallets. In that time the price went from $0.000100 to $0.000252 — up 152%. That entire move was made with my own money. Four small sells returned $5.57.

So the chart on the site is real and verifiable, and almost meaningless as a price. It is a record of one person buying from himself in a pool a hundred dollars deep. In two weeks, exactly one purchase came from outside the project: $9.91, on 14 August.

The spend counter was wrong too. It read $85. The real figure is $123.29 — $74.02 put into the pool and burned along with the LP tokens, plus $49.27 of buys that never made it into the tally. The counter now shows the corrected number.

From today, the buying stops. An instrument that moves its own needle measures nothing. Whatever the price does next, it will not be me doing it.

Which brings this to the part I cannot do alone.

BYKO is not an investment and never will be. Fixed supply, no owner, no mint, liquidity permanently burned to a dead address — there is nothing to grow and nobody who can promise you anything. What it is, is a measurement: how much does it cost for a provably honest token to stop being treated as a scam?

Two weeks in, the answer so far reads: $123.29 spent, about 100 hours of work, three refusals from Basescan, one security flag removed, one wallet that still hides the token as a scam, and one person who bought in.

If you want to move this experiment, there are three ways, and two of them are free:

- Read the diary and tell me where I am wrong. Every correction so far came from auditing my own claims. Outside eyes are better than mine.
- Share it. Reach is the one thing this project will not buy.
- Or hold one BYKO. Not as an investment — as a data point. A second independent holder changes a number that no amount of writing can change.

All of it is verifiable on-chain. That is the entire point.

---
**Teaser:** Thirty-three buys moved BYKO's price 152%. All but one were mine, $49.27 in total — and the spend counter was wrong too: $85 is really $123.29.
**X:** 33 buys pushed BYKO's price up 152%. All but one were mine — $49.27 total. The spend counter was wrong too: $85 is really $123.29. From today I stop buying. An instrument shouldn't move its own needle.

## On-chain audit: 100 transactions, three debunked facts — 16 August 2026

This week, a full on-chain audit ran through BYKO's entire transaction history: 100 Transfer events since deploy, every one classified — mints, LP adds, buys, sells, LP removals, plain transfers. The reconciled balances matched on-chain balances exactly, down to the decimal, and the total matched the fixed supply of 790,227.

It also debunked three things this diary had recorded as fact.

First: an earlier note claimed Farcaster rewards had gone out to real people, building toward 20 holders. They hadn't — every address that looked external turned out to be DEX routing infrastructure (1inch, LI.FI) passing tokens through in the same transaction, net effect zero.

Second: a recorded $1.35 micro-sell from August 4th. It doesn't exist anywhere in the transaction history — there were no sells that day at all, only two small buys. The closest real transaction is a $1.36 purchase five days later.

Third: the holder numbers were wrong. The diary had recorded roughly 229,000 tokens for the author. The real figure across the author's wallets is 260,599 — 32.98% of supply.

Getting the record wrong and then correcting it in public, with the receipts, is exactly what this diary is supposed to do.

**Superseded, 17 August 2026:** the holdings figure above no longer matches the chain. Read live from Base at block 50,091,885, the author's disclosed addresses hold 278,173 BYKO — 35.2% of supply, not 260,599 and 32.98%. The wallets were consolidated the same day: [BYKO now sits in exactly two wallets](https://byko.bykovas.lt/d/byko-now-sits-in-exactly-two-wallets).

---
**Teaser:** An on-chain audit of BYKO's full history just debunked three things this diary had recorded as fact.
**X:** Full on-chain audit: 100 transactions, all reconciled to the supply. It debunked three things this diary had recorded as fact — including holder numbers that were wrong. Correcting the record in public is the whole point of this experiment.

## MetaMask values a malicious token at $1,032 — while BYKO still has no price — 15 August 2026

MetaMask says this token is **Malicious** — and still counts **$1,032.23** of it in my portfolio balance.

In the same wallet, BYKO is labelled **Risky** and shown with no value at all — no price, no portfolio line — even though it has a real on-chain BYKO/USDC market.

That contrast is exactly why BYKO exists: not to hype another token, but to document how crypto systems decide what looks legitimate, valuable, suspicious, or invisible.

One wallet. Two completely different signals.

A malicious token gets a four-digit valuation.
A transparent token with a real market gets none.

The screenshots are now part of the public diary.

![MetaMask, account BYKOVAS LUKO: www.bopx.club is flagged Malicious and still counted as $1,032.23 of a $1,033.17 balance](/assets/diary/metamask-values-a-malicious-token-at-1-032-while-byko-still-has-no-price/metamask-malicious-token-1032.png)

![MetaMask, account BYKOVAS: BYKO is flagged Risky and its 262,159.22 tokens are shown with no price and no value](/assets/diary/metamask-values-a-malicious-token-at-1-032-while-byko-still-has-no-price/metamask-byko-risky-no-price.png)

---
**Teaser:** MetaMask counted a token it labels Malicious as $1,032.23 of portfolio value — while BYKO, labelled Risky, shows no value at all.
**X:** MetaMask says this token is Malicious — then counts $1,032.23 of it in my portfolio. BYKO, in the same wallet, is labelled Risky and shown with no value at all, despite a real BYKO/USDC market. Crypto legitimacy, explained by UI.

## The first real vote for legitimacy — 14 August 2026

The first real vote is in.

Someone outside the BYKO project independently chose to buy and hold BYKO — a token that promises no returns, no roadmap and no future utility. The only proposition was simple: holding BYKO is an on-chain signature for honesty, transparency and legitimacy over hype.

Today somebody actually signed it.

Wallet: 0x30Fd96C5AE61f0fB3d97e6159ab023710163eFBF

I don't know who controls it, and that is exactly how it should be. The blockchain records the fact; the identity does not matter.

Thank you to the first real supporter. Whatever happens next, this address is now permanently part of the BYKO diary as the first external vote for legitimacy.

---
**Teaser:** The first real vote is in. Someone outside the project chose to buy and hold BYKO — not for a promise, but as an on-chain signature for legitimacy.
**X:** BYKO just got its first real vote for legitimacy. Someone independently bought and held it. Thank you, 0x30Fd…eFBF. The first external on-chain signature is now permanently part of the diary.

## Fake, worthless, decentralized — case closed — 14 August 2026

Crypto.com support called BYKO “fake.” Their proof: BaseScan shows $0.00.

Fine. I stopped arguing about price and asked a much simpler question: if BYKO is worth $0 in your own reasoning, why does Crypto.com Onchain Wallet show nothing instead of $0, while other zero-value assets show $0?

The final answer: “we don't have access to that as the Onchain wallet is a decentralized wallet.” Then the conversation was closed.

A decentralized wallet apparently explains why its own UI renders one token differently from another. Incredible.

I came to support with a missing price field. I left with BYKO declared fake, then worthless, then protected from debugging by decentralization.

Full transcript in today’s diary entry. Thank you to the support agent for contributing an unusually pure specimen to the experiment.

---
**Teaser:** Crypto.com support called BYKO fake because BaseScan showed $0.00. Asked why their own wallet shows blank instead of $0, they answered: the wallet is decentralized.
**X:** @cryptocom support called BYKO “fake” because BaseScan shows $0.00. I asked why their wallet then shows BLANK instead of $0. Answer: “the Onchain wallet is decentralized.” Case closed. This conversation is spectacular.

## The market's first reply: a price tag — 13 August 2026

BYKO's social channels are brand new — and the first messages have already arrived: offers of paid promotion and fast-track listings.

Honestly, we're a bit flattered. It means someone is reading. A coin with a hundred-dollar pool and a handful of holders already has an audience — even if the first readers arrived with a price list.

No hard feelings — it's just not our genre. BYKO is an experiment in what legitimacy costs when you don't buy it. Paid attention would break the instrument.

But free help is a different story. Honest feedback, a repost, a word of advice, or simply reading the diary — welcome. That's exactly the signal this experiment is built to measure.

---
**Teaser:** Someone is reading us
**X:** Our new social channels got their first replies: paid promotion offers. So someone is reading. Wow. BYKO doesn't buy attention — that's the whole experiment. But if you want to help for free: welcome.

## Turns out I can't count — 13 August 2026

For a while, holder votes were being tracked by hand — spreadsheets, notes on paper, counted manually.

Turns out the count was wrong. After cleaning up the wallets, it became clear that of all the holders being tracked, exactly one actually exists: the person running the experiment. Votes: zero against zero. 😂

A little embarrassing, but the site now shows the truth instead of the earlier miscount. The experiment keeps going — still waiting on real voters, just with the math done correctly this time.

**Update, 16 August 2026:** a full on-chain audit went further and put the author's real holdings at 260,599 BYKO, 32.98% of supply — the token count in this entry was off too: [On-chain audit: 100 transactions, three debunked facts](https://byko.bykovas.lt/d/on-chain-audit-100-transactions-three-debunked-facts).

---
**Teaser:** Thought BYKO had 20 holders. Turned out to be just one — me. 😂 The site now shows the real number.
**X:** Turns out the 20 holders I'd been counting by hand were really just one: me. 😂 Cleaned up the wallets, fixed the math. The site now shows the real number. Experiment continues — still waiting on actual voters.

## Signed by the deployer — 13 August 2026

The website has always said BYKO's author is Denisas Bykovas. Until today, that claim rested on things that proved intent, not identity: a statement on a domain, basenames chosen by the same person, a private verification only Basescan's own system could see.

Today that changed. A message was signed with the private key of the address that deployed the BYKO contract — 0x624056460437Cb4c63F7A3CF0c5a554dF3375222, the deployer wallet — and published on Basescan. The message states the name, the LinkedIn profile, the deployer address, and the BYKO contract address, all in one line. Anyone can verify it against the signature, byte for byte, at basescan.org/verifySig/95926.

The signing wallet was chosen deliberately: not the main wallet, which carries a smart-account delegation that would make a plain signature check fail and look like a red flag instead of proof. The deployer address is a clean externally-owned account, so the signature verifies with any standard tool — not just Basescan's.

What it proves: control of that one key, nothing more. It doesn't cover the rest of the wallet cluster, and that's left as is on purpose. What it removes is the need to just trust the page. Cost: $0 — no transaction, no gas, a few minutes to sign. The link, once published, can't be revoked — only lost, which would be worse.

A matching note now also lives on LinkedIn, pointing back at the site — so the identity claim runs both directions.

---
**Teaser:** The site said the author is Denisas Bykovas — now it's cryptographically signed and publicly verifiable on Basescan.
**X:** The site said BYKO's author is Denisas Bykovas. Now it's proven: a message signed with the deployer's private key, published on Basescan, verified byte for byte. Cost: $0, no gas, minutes. Trusting the page is no longer required.

## Bykocoin: now official — 12 August 2026

BYKO now has official channels: Telegram, X, and Facebook.

Telegram: t.me/bykocoin
X: x.com/bykocoin (@bykocoin)
Facebook: this page

The handle — bykocoin — matches the on-chain basename bykocoin.base.eth and the distribution wallet's profile in the Base app.

---
**Teaser:** BYKO's official channels are live — Telegram, X, and Facebook, all under one handle: bykocoin.
**X:** BYKO now has official channels — Telegram, X, Facebook, handle @bykocoin, matching the on-chain basename.

## The site that answered 200 to everything — 12 August 2026

Registered the site in Google Search Console — free, fifteen minutes, and the first thing it did was point at something embarrassing.

Every non-existent URL on byko.bykovas.lt returned 200 OK with the homepage. Not a 404 — a confident "yes, this page exists, here it is". A default fallback that switches itself on when there's no 404 page, and it meant a site whose entire argument is "check everything yourself" was quietly claiming that every address it doesn't have, exists.

Nobody would have noticed. Search engines would have: infinite duplicates of one page, under infinite addresses.

While there, a few more gaps: the raw markdown files behind the site were being served and indexed as duplicates of the pages they generate; canonical links and og:url were missing entirely; sitemap didn't exist; one page had no social preview tags at all.

All fixed, all free. Total spent on this episode: $0 and 90 minutes.

The part worth keeping: I've spent two weeks documenting other people's automated verdicts about my token. The first tool I pointed at my own site immediately found my own sloppiness. Which is the deal — if the argument is that everything should be checkable, it has to be checkable when it's inconvenient too.

---
**Teaser:** A site about verifiable facts was returning 200 OK for every address that doesn't exist.
**X:** Registered the site in Search Console and found this: every non-existent URL returned 200 OK with the homepage. A site about verifiability was quietly claiming that every address it doesn't have, exists. Fixed. Cost: $0 and 90 minutes.

## Coinbase cannot remove its own flag — 12 August 2026

First real answer from anyone, after eight days of disputes: Coinbase Support, case #27207505, 12 August.

The key sentence, quoted exactly: "the security warnings displayed in Coinbase Wallet are generated by independent, third-party security signal providers. Our support team does not have the ability to manually override, remove, or modify these classifications."

And then the part that makes it structural rather than annoying: they cannot confirm which provider flagged the token. Their recommendation is that I research the security scanners commonly used in the Base ecosystem and submit the contract to them myself.

So, plainly: a wallet displays a warning that hides a token from its owner's portfolio, and the company running that wallet can neither remove the warning nor say who issued it. Not "won't" — cannot.

This mirrors the conclusion from the Crypto.com rounds almost word for word: the fix never lives with the support desk. It lives in data directories and scanner databases, filed elsewhere, with no accountable human at the other end.

The complaint was logged and escalated internally. The next move is what they suggested — going directly to the providers, starting with the Blockaid mistake-report form.

Credit where it's due: this is the first response in this entire experiment that was written by a person rather than a template, and it says something true, even if the truth is uncomfortable.

---
**Teaser:** Coinbase confirms in writing that it cannot remove the warning in its own wallet — or say who issued it.
**X:** Coinbase Support, in writing: warnings in Coinbase Wallet come from third-party providers, and their team "does not have the ability to manually override, remove, or modify these classifications". They can't say which one flagged it.

## Burning the liquidity, and the first flag that moved — 7 August 2026

On 7 August I burned the liquidity. All of it.

Two transactions: first 3.07% as a rehearsal — to watch exactly what happens and confirm nothing breaks — then the remaining 96.93%. The LP tokens now sit at 0x…dEaD, which is an address nobody holds the keys to. The pool cannot be withdrawn by anyone. Including me. Especially me.

Burned, not locked. A lock has an expiry date and a service you have to trust; burning has neither. The proof isn't a promise, it's a holder list: on the LP token's page, the dead address holds 100%.

The next day, MetaMask dropped its "Low locked liquidity" warning. Blockaid had rescanned, seen the burn and counted it — in roughly twenty-four hours, with no email, no form, no appeal.

That is the first measurable result of this whole experiment: one flag, removed by evidence rather than by argument. The other one, "Unstable price", stays. It goes away only with trading history, and no amount of writing changes that.

Cost of the burn: a few cents of gas. Cost of what was burned: the pool is now permanently beyond reach — which was the entire point.

---
**Teaser:** 100% of the LP burned in two transactions. A day later, the first flag came off by itself.
**X:** On 7 Aug I burned 100% of the LP tokens to 0x…dEaD — a 3% rehearsal first, then the rest. The pool can never be withdrawn by anyone, including me. A day later MetaMask dropped its "low locked liquidity" flag. First measurable result.

## The diary started with two things I got wrong — 6 August 2026

This project turned into a diary because of two things I got wrong.

While redesigning the site, I wrote that "the money never reaches the author". It sounded good. It is also false: I hold BYKO, and I can sell it into the same pool that buyers pay into. The liquidity can never be withdrawn — that part is true and provable — but the sentence as written claimed something stronger than the facts support.

The second one: the stat bar showing hours and dollars spent had placeholder numbers in it. On a page whose entire argument is "counted, dated, published", invented figures are the one thing that cannot ship.

Both were caught before going live, which is the only reason this is a diary entry and not an apology.

That's when the format became obvious. Not a product launch, not a roadmap — a log of what it actually takes for a token with nothing to hide to stop looking like a scam. Hours, emails, dollars, days of waiting. Measured, dated, published, including the parts where I'm the one who got it wrong.

BYKO isn't a product. It's a measuring instrument, and the first thing it measured was me.

---
**Teaser:** Two claims on this site didn't survive their own fact-check — both caught before publishing.
**X:** While redesigning the site I found two of my own claims that didn't survive checking: "the money never reaches the author" (it can) and placeholder numbers in the stat bar. Both caught before shipping. That's when this became a diary.

## The price list for being seen — 5 August 2026

Every door in this ecosystem has a price on it. Here is the list I've been quoted so far, and what I did about it.

DexScreener Enhanced Token Info: $299. DEXTools listing: $195. CoinGecko and CoinMarketCap price data, via the paid routes people quote: around $5,000. BaseScan Priority Support, which does not promise approval — only a faster answer — has its own Make Payment page.

All declined. Total spent on visibility: $0.

Trust Wallet's asset repository is free, and out of reach for a different reason: the requirements list a whitepaper, a roadmap, an audit, a CoinMarketCap listing and ten thousand holders. BYKO has none of those, deliberately — the absence of a roadmap is a design decision, not an oversight.

Even the giveaway had a price: distributing 27 BYKO through Sablier would have cost roughly $2 per claim, to hand out something worth a fraction of a cent. Declined too.

I'm not refusing to pay because $299 is unaffordable. I'm refusing because the moment I pay it, the experiment stops measuring anything. The question was never whether legitimacy can be bought — obviously it can. The question is what it costs to earn it without paying, and that number only stays honest while the receipts stay empty.

For the record, I do use the free DEXTools widget on the market page. Refusing to buy visibility isn't the same as refusing to use what's given away.

---
**Teaser:** $299, $195, ~$5,000 — the quoted price of being seen. All declined. Total spent: $0.
**X:** Prices quoted for visibility: DexScreener $299, DEXTools $195, CG/CMC ~$5,000, BaseScan priority support paid with no promise of approval. All declined. Total spent: $0. Legitimacy can be bought — the experiment is what it costs not to.

## Four rounds with a script — 5 August 2026

Four rounds with Crypto.com support, on a question with a one-line answer.

The issue: BYKO showed in the wallet without an icon and without a USD value. The wallet was reading the token fine — it just had nothing to display next to it.

Round one, I explained the problem. Round two, they asked me to confirm the wallet address. Round three, they told me the wallet is non-custodial and they have no visibility into my funds — which is true, and had nothing to do with the question. Round four, the same sentence again.

The answer, which no round produced: none of this is fixed by support. The icon comes from token data directories that wallets read; the USD value comes from a price feed the token isn't in yet. Both are paperwork, filed elsewhere, with nobody to talk to.

By 9 August the icon appeared — because the data directory updated, not because the conversation went anywhere. The USD value is still missing, and will stay missing until a price source picks the token up.

The useful part isn't the outcome. It's that four rounds of a polite, patient script cost more time than reading the documentation would have — and the script never once said "this isn't something we can fix".

---
**Teaser:** Four rounds with a support script about a missing icon. The icon appeared — for unrelated reasons.
**X:** Four rounds with Crypto.com support about a missing icon. Round 3 explained the wallet is non-custodial and they can't see my funds — true, and unrelated. The icon appeared later, because a data directory updated. Not because of the chat.

## Three refusals, zero signed reasons — 4 August 2026

On 4 August I verified ownership of the BYKO contract on BaseScan and submitted the token information form: website, icon, GitHub, LinkedIn, price data link. Everything the form asks for.

The first wave of refusals arrived the same day. The stated reasons, template-picked, included: the sender's email is not the project's official domain; the information provided is false or misrepresents public entities; the token name or symbol may be susceptible to brand impersonation.

The email came from bykovas@bykovas.lt. The site is byko.bykovas.lt. The founder is named on the site, with a LinkedIn link. The contract is verified as an exact match, and "BYKO" impersonates a brand that does not exist. Three reasons that contradict the submission and each other.

The second refusal came on 5 August, the third on 11 August, both with the same sentence: "unable to process the update at this time. This is usually due to a lack of information about the token." No specifics, no signature on the decision, nothing to fix.

The pattern is consistent: one or two days from submission to a template. Which is the honest measurement here — not that they said no, but that nobody had to say why.

Next move is a reply in the existing thread rather than a fourth form.

---
**Teaser:** Three waves of refusals, four identical emails in one day, and not a single signed reason.
**X:** Three waves of refusals from BaseScan: 4, 5 and 11 August. Wave one cited "sender's email is not the project's domain" (it is) and "symbol may impersonate a brand" (it's my surname). Nobody signs the decision.

## Flagged: what the scanners actually measure — 4 August 2026

Within days of existing, BYKO was flagged.

MetaMask, via Blockaid: "Low locked liquidity" and "Unstable price". Base app: "Flagged as a scam" — with no button anywhere to dispute it.

So I ran the token through the scanners myself. GoPlus: not a honeypot, open source, zero tax. De.Fi: no rug-pull risk. honeypot.is: clean. RugCheck scored it 28 out of 100 — and the breakdown is the interesting part: the contract itself passed everything, the points were lost on Pool size, Transactions and Creation date. Translated: the token is small and new. Not dangerous — small.

That is the actual finding. The automated verdict everyone reads as "is this safe?" mostly answers a different question: "is this big?"

Since then MetaMask has dropped the liquidity flag — the LP tokens were burned, and that one is now measurably false. "Unstable price" stays; in a $150 pool it's not wrong. Base app still says scam, and as of 11 August has removed BYKO from portfolio view entirely.

The appeal channels exist, they are just not where you'd look: report.blockaid.io/mistake, a report form inside MetaMask, security@coinbase.com.

---
**Teaser:** Every scanner cleared the contract. The score still said 28 — because the points measure size, not safety.
**X:** BYKO got flagged within days of existing. GoPlus: not a honeypot, open source, no tax. De.Fi: no rug risk. RugCheck: 28/100 — points lost on pool size, transactions and age. The contract passed everything. Small isn't dangerous.

## Twenty holders and a $1.35 sell — 3 August 2026

**Correction, 16 August 2026:** both numbers in this entry are wrong. A full on-chain audit of every BYKO transfer found that the twenty holders were DEX routing contracts passing tokens through in the same transaction, not people, and that the $1.35 sell never happened — there were no sells that day at all. The audit, with the reconciled figures: [On-chain audit: 100 transactions, three debunked facts](https://byko.bykovas.lt/d/on-chain-audit-100-transactions-three-debunked-facts). The original text is left below, unedited.

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
