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

## Someone is reading us — 12 August 2026

BYKO's social channels are brand new — and the first messages have already arrived: offers of paid promotion and fast-track listings.

Honestly, we're a bit flattered. It means someone is reading. A coin with a hundred-dollar pool and a handful of holders already has an audience — even if the first readers arrived with a price list.

No hard feelings — it's just not our genre. BYKO is an experiment in what legitimacy costs when you don't buy it. Paid attention would break the instrument.

But free help is a different story. Honest feedback, a repost, a word of advice, or simply reading the diary — welcome. That's exactly the signal this experiment is built to measure.

byko.bykovas.lt

---
**Teaser:** The first replies to BYKO's brand-new social channels were paid promotion offers — which means we have readers. Free help is welcome.
**X:** Our new social channels got their first replies: paid promotion offers. So someone is reading. Wow. BYKO doesn't buy attention — that's the whole experiment. But if you want to help for free: welcome.

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
