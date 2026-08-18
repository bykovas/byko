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

  New entries at the top. Pushing a new entry to main triggers
  .github/workflows/publish-diary.yml, which posts it to Facebook and X.
-->

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

Everything is public: the method, the contract, the transfers, every answer, every verdict.

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
