# Grocery App

Weekly meal planning that ends with a pre-filled Intermarché Drive basket I only have to review and confirm.

## The goal

Once a week, I get asked what I feel like eating. I answer in a few taps. I get back a meal plan for the week, built around what I actually cook and actually buy. Then my Intermarché Drive basket is filled for me. My only job is to skim it and hit "Valider".

I do not want another app to log into. I do not want to type ingredients into a search bar 25 times.

## Why this is not a Potto clone

The inspiration is Potto — a quiz, then a plan, then a shopping list at your store. Potto works because it has retailer integrations. Intermarché has no public API. There is no endpoint that accepts a basket.

So the architecture is inverted. Instead of building an app that talks to Intermarché, this repo is a **configuration + memory layer for Claude**, and Claude drives the real Intermarché website in a browser the same way I would.

```
Sunday reminder  ──▶  Claude asks 3 questions  ──▶  meal plan for the week
       │                                                    │
       │                                                    ▼
  Gmail invoices ──▶ purchase history ──────────▶  shopping list (real product names)
                                                            │
                                                            ▼
                                          Claude in Chrome, logged into my account
                                                            │
                                                            ▼
                                       basket filled at Drive Méré → I confirm
```

## The five pieces

### 1. Purchase history (the part that makes it personal)

Intermarché emails a `Votre facture est disponible` receipt after every Drive order, and those emails are fully itemized — exact product names, quantities, unit prices, and which items were out of stock. A year of them are sitting in Gmail: 25 orders so far, 9 October 2025 to 29 September 2026, averaging 87,86 € and 29 items.

`scripts/parse-invoices.mjs` turns those into `purchase-history.json`: what I buy, how often, in what quantity, at what price. That is a far better preference model than any onboarding quiz, because it is what I did rather than what I said.

It also means the shopping list can use **exact Intermarché product names** — "Jean Rozé, une marque Intermarché Viande hachée vrac pur BŒUF 5% MG, la barquette de 350 g" — as keys. They were meant to be search terms too, on the theory that the exact name would return exactly one result. Tried on the real site on 14 September 2026, it doesn't: Intermarché's search ranks rather than matches, so that full name puts every house-brand product ahead of the mince, and a product that has since been renamed or repacked returns nothing. So the names now key into `data/catalogue.json`, which maps each one to its product page at Méré.

Three things the invoices do that the parser has to handle:

- **The year is never stated.** "jeudi 27 août, entre 14h30 et 15h30" — no year anywhere in the body. It comes from the filename, which is why invoices are saved as `<YYYY-MM-DD>-<orderNumber>.txt`.
- **Quantities come in five shapes**: `x1`, `x0.36 kg`, `x150 g`, `Poids exact / 0.194 kg`, and `Poids exact / 2` — that last one being a unit count, not a weight.
- **Prices are per kilo for anything weighed.** The chicken aiguillettes list at 29,99 € and the garlic at 15,99 €, but a pack of chicken costs about 6 € and a head of garlic about 2 €. So each product also carries `typicalLineTotal` — the median of what was actually paid for that line — and that, not the unit price, is what a basket estimate is built from.
- **Invoices before November 2025 use a narrower template that cuts product names mid-word**: "Jean Rozé, une ma... Chipolata supérie...". The parser folds each of those onto the one full name containing all its fragments in order, and leaves the genuinely ambiguous ones alone — "Jean Rozé, une ma... Viande hachée vra..." matches both the 5% and the 15% mince, so it stays separate and is marked `nameTruncated`. Those names are a frequency signal only; they must never be used as search terms.

### 2. Standing preferences

`preferences.json` holds the things the receipts can't tell you: household size, budget ceiling, what I'm bored of, non-negotiables, which night is a leftovers night.

The two that matter most are firm rules. **No chilli at all** — I don't like spicy food, and that isn't traded off for authenticity. And **milk and cream minimised** — cheese is fine, coconut milk is fine, so curries still work.

There is also a `pantry` block listing the Asian staples Méré is *confirmed* to stock, taken from my own receipts rather than guessed: Kikkoman soy, the Itinéraire des Saveurs yakitori and sweet soy sauces, Tanoshi sushi rice, nori and ramen, Suzi Wan rice vermicelli, Ajinomoto gyoza. By 14 September 2026 two of those — the gyoza and the vermicelli — were no longer sold at Méré, which is the kind of drift the catalogue exists to catch.

### 2b. What's already in the kitchen

The basket is what I still have to buy, not what the recipes add up to. The build takes the most recent receipt
dated on or before the week's first day as what is already in, and the page subtracts it. `data/equivalents.json`
(hand-edited) says which products stand in for one another, so the Jean Rozé pork chops on a receipt cover a recipe
that names the Terroirs ones, and every match is printed on the line it covered. It is week-scoped on purpose: each
plan starts again from the newest receipt rather than carrying a running inventory nobody keeps up to date.

Once the week's own order arrives, its receipt settles what still has to be bought separately, so a plan rewritten
around what actually came doesn't ask for it twice.

### 3. The weekly conversation

`.claude/skills/courses/SKILL.md` is the skill Claude loads. It defines the three questions, how to weight history against novelty, how to build the plan, and how to convert the plan into a line-item list with quantities that account for what's already in the pantry.

Three questions, not five. Anything more and I won't do it every week.

The one rule in there worth calling out: **familiarity comes from the ingredient, not the dish.** My receipts are a French repertoire — mince, chipolatas, baguette, Boursin — but that is what I bought, not what I want to eat. So the plan builds Asian dishes out of the things I buy every week anyway. Eggs, chicken, peppers, onions, broccoli and rice make a donburi as easily as they make a gratin.

### 4. The basket

Claude in Chrome, on my PC, with my Intermarché session already logged in. It works from the list I approved on the page: anything Méré no longer sells as named comes to me as a question first, then it opens each product's own page at Drive Méré, checks the pack, adds the right count, and stops. It does **not** book a slot and does **not** pay. I open the basket, read it, remove what I don't want, and confirm.

`data/catalogue.json` is what makes that work: for every product the app can buy, the product's page at Méré, the site's own name and pack, the price on the day it was checked, and whether it is the same thing as on my receipts. It was built by browsing the site in my Chrome, because Intermarché blocks anything scripted.

### 5. The app

`artifact/template.html` plus `scripts/build-week.mjs` turn the plan data into a published page, and **the basket is the page**. It opens on the shopping list at Méré's own product names, packs and current prices, with a count to add for each line and the total against my ceiling. Anything Méré sells differently or no longer sells waits under "Decide first" until I pick — I can't approve until every line says exactly what to buy. Once approved, "Push to Intermarché" hands the list to Claude on my PC, which fills my Drive basket and reports back on the page line by line, ending with the site's own total. Week, Recipes and Household sit behind it — Household being the things no recipe asks for, drain cleaner and bin bags, which go into the same basket.

It is generated, not hand-written, and **every `/courses` run publishes a fresh page with its own link** for that week, recorded in `data/artifacts.json`. Favourites and my recipe edits carry over from one week's page to the next. A change within the week (a recipe gains an ingredient, a dish is swapped in the plan file) republishes onto that week's existing link instead, so the page we both have open keeps its state.

It is also a two-person app. Any meal can be swapped — either for another dish from the library, or for something new invented on the spot — and the picks live in a shared database, so my partner and I see the same week on our own phones. The shopping list is derived from whatever is currently picked, so the total follows every swap. A dish eaten out of an earlier batch is marked as leftovers and buys nothing, which is the only reason the numbers come out right: counting the Sunday curry three times bought six tins of coconut milk for one pot.

The library is 75 dishes now (48 dinners, 19 lunches, 8 breakfasts): 21 Asian, 54 European or American. That is not the 50/50 I want, and it is not meant to be: the balance to hit is **the week's plan**, not the library. Confusing the two is what caused the one real planning bug so far, when a `weeklyShare` of "most" quietly made every week about 70% Asian while the library looked balanced. Ready-made things like the gyoza are still on the menu but marked as assemblies — a note about the packet, and a real recipe only for the part that is actually cooked.

**Asked for on 15 September 2026, built on 28 September.** The fourth tab, a five-step quiz, is gone: it saved nothing, nothing else read it, and the Recipes tab already filters on everything it asked. In its place, an axis the library never had — **what protein is in the dish**. Every dish declares one of eight and the parser rolls my receipts up the same way; the first thing it told me is that **pork was in 22 of my 23 orders and the library gave it two dinners.** (By the 29 September order it is 23 of 25, and the library has three pork dinners.) Recipes groups by protein or cuisine, and "Cook this on…" on every card is now the one place the week changes. Week is just the seven days with nothing on top of them; tap a meal and it opens.

**Adding to the list by editing a recipe.** Opened from the week or the library, a dish shows every ingredient with a − / + for the amount, a Swap for the product and a ✕ to take it out, plus "Add an ingredient" for anything from my receipts, anything Méré has been looked up for, or a plain name as a best guess. The basket is derived from the dishes, so the list follows, and every line a change adds is marked as coming from "<dish> (edited)". The edits belong to the dish rather than the week — the pad thai keeps its extra lime every time it comes round — and nothing hot gets in: chilli, harissa, chorizo, piment d'Espelette and the rest are refused with the reason. Still to build: a Kitchen tab and ticking off what we actually cooked.

**The Household tab** is the list no recipe makes: drain cleaner, bin bags, sponges. It offers the household products from my receipts before I type anything, and it takes my Google Keep "Meal Planning" list pasted in as text (Keep → ⋮ → Send → Copy to clipboard): ticked lines are left out, "x2" is a count, a name that matches one receipt product goes in as that product, and anything else goes in as written with "Did you mean…" offers beside it. Nothing is swapped in for me, and the chilli guard sits on this door too.

## Non-negotiable rules

- Claude never completes a purchase. It fills, then stops.
- Every line item in the basket must trace back to a dish in the plan, the standing staples list, or my household list (typed on the page or pasted from Google Keep). No surprise additions.
- If a product is unavailable, propose the substitute in chat before adding it — the receipts show this happens once or twice per order.
- Budget is a ceiling, not a target.
- Nothing chilli reaches the list.

## Where the data lives

My disk is full, so nothing is checked out permanently — each session clones this repo, works, pushes, and throws the copy away.

Everything lives here, `data/` included: the invoices, the purchase history, my preferences, the recipe library and the week's plan. This repo is public, so all of that is public too. That is a deliberate choice, made knowing it publishes a year of my receipts. `preferences.example.json` is still here as a template for anyone who wants to run this for their own store.

## Phone vs PC

- **Phone:** the weekly conversation. Answering the three questions, seeing the plan, adjusting it. This is 90% of the interaction and works fine in the Claude app.
- **PC:** the basket-filling step only, because it needs Chrome with my logged-in session. I don't have a laptop — this is the desktop, and it's the machine Claude Code runs on.

The handoff is the plan itself. Answer on the couch Sunday morning, run the basket step at the PC whenever.

## Status

- [x] Invoice parser — 25 orders, 239 distinct products (to the 29 September order)
- [x] Preference file
- [x] Weekly planning skill
- [x] Swap a meal you don't fancy, shared with my partner
- [x] Edit a dish's ingredients — amounts, products, add or take out — and the list follows, 28 September 2026
- [x] Recurring Sunday reminder
- [x] Méré catalogue — 153 products looked up on the site on 14–15 September 2026: 98 exact, 12 to check, 28 picked, 15 missing. Entries go stale after 28 days, so the whole catalogue is due a re-check from 12 October; `npm run catalogue:queue` lists what is due
- [x] Push from the page — approve, press Push, `/courses push` fills the basket and writes progress back
- [x] Push tested end to end on 2026-09-14 with a two-line test page: request, basket filled in Chrome, progress on the page, site total matched the estimate to the cent. Re-run the same day after the browser pre-flight hardening, with the in-page helper: one tool call for both products, wrong pack refused, out-of-stock reported, off-site call refused, basket restored
- [x] First push of a whole approved week, 15 September 2026 — 43 products, 130,54 € at Méré (almond milk and paprika from my Keep list included) against a 130,59 € estimate. Two lines were out of stock and settled in chat: the eggs came as two boxes of six, the Salakis as the plain one. Weighed goods turned out to count in grams, so the in-page helper was rebuilt to take one click per call
- [x] The budget question — a 7-dinner, 5-lunch week prices out well over the old 100 € ceiling, so on 4 September it moved to 150 €. The first full week came to 130,54 €.
- [x] What's already in — the latest receipt seeds the week's on-hand list, and the week's own receipt settles what to buy separately (28–30 September 2026)
- [x] Household tab, and the Google Keep list pasted in (28 September 2026)
- [x] Page tests — `npm run test:page`, 20 scenarios in headless Chromium against a stub store that delivers every snapshot late
- [ ] Kitchen tab and a lived-in week — what is actually in, kept up to date by both of us, and each meal ticked cooked, moved or struck off (knowing the 20-egg pack from last week is half gone)

## Setup

```bash
npm run parse            # invoices -> purchase history
npm run build:week       # plans + recipes + catalogue -> artifact/week.html
npm run catalogue:queue  # what still needs looking up on the site
npm run drive:list -- <push doc>.json [<progress dir>] [--batch <tabId>]  # work list, or ready-made browser batches that run scripts/drive-helper.js
npm run test:page        # builds, then drives the page against a stub store in headless Chromium
```

Run `npm run test:page` after any change to the page and before publishing. It needs Chromium: cloud sessions have it at
`/opt/pw-browsers/chromium`; elsewhere set `CHROMIUM`.

No dependencies — the parser uses only the Node standard library, so there is nothing to `npm install`. Node 18 or newer.

To add a new invoice, fetch the email body as plain text through the Gmail connector and save it to `data/invoices/<YYYY-MM-DD>-<orderNumber>.txt`, then re-run the parser. Re-run it too after editing `data/equivalents.json`, because the purchase history's protein roll-up (`byProtein`) is built from the equivalence groups.

## What's where

| | |
| --- | --- |
| `CLAUDE.md` | the operating brief for Claude: the planning rules, the page's sync rules, the hard rules |
| `.claude/skills/courses/SKILL.md` | the `/courses` skill: the weekly conversation, publishing, and `/courses push` |
| `artifact/template.html` | the page. `npm run build:week` pours `data/` into it as `artifact/week.html` (built, not committed) |
| `scripts/` | the parser, the build, the catalogue queue, the push work list and the in-page Drive helper, and the page test runner |
| `test/page/` | one file per thing that once went wrong on the page |
| `data/invoices/` | the receipts, as plain text |
| `data/purchase-history.json` | built by `npm run parse`; never edited by hand |
| `data/preferences.json`, `data/equivalents.json` | hand-edited |
| `data/recipes.json`, `data/plans/` | the recipe library, and one plan per week |
| `data/catalogue.json`, `data/seen-in-app.json` | Méré's product pages, and what phone screenshots showed |
| `data/artifacts.json` | each week's page link |
| `preferences.example.json` | a template for anyone running this for their own store |
