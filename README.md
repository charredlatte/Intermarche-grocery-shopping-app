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

## The four pieces

### 1. Purchase history (the part that makes it personal)

Intermarché emails a `Votre facture est disponible` receipt after every Drive order, and those emails are fully itemized — exact product names, quantities, unit prices, and which items were out of stock. A year of them are sitting in Gmail: 22 orders, October 2025 to August 2026, averaging 85,10 € and 29 items.

`scripts/parse-invoices.mjs` turns those into `purchase-history.json`: what I buy, how often, in what quantity, at what price. That is a far better preference model than any onboarding quiz, because it is what I did rather than what I said.

It also means the shopping list can use **exact Intermarché product names** — "Jean Rozé, une marque Intermarché Viande hachée vrac pur BŒUF 5% MG, la barquette de 350 g" — which is what makes the browser step reliable. Searching "ground beef" on intermarche.fr returns forty things. Searching the exact name returns one.

Three things the invoices do that the parser has to handle:

- **The year is never stated.** "jeudi 27 août, entre 14h30 et 15h30" — no year anywhere in the body. It comes from the filename, which is why invoices are saved as `<YYYY-MM-DD>-<orderNumber>.txt`.
- **Quantities come in five shapes**: `x1`, `x0.36 kg`, `x150 g`, `Poids exact / 0.194 kg`, and `Poids exact / 2` — that last one being a unit count, not a weight.
- **Prices are per kilo for anything weighed.** The chicken aiguillettes list at 29,99 € and the garlic at 15,99 €, but a pack of chicken costs about 6 € and a head of garlic about 2 €. So each product also carries `typicalLineTotal` — the median of what was actually paid for that line — and that, not the unit price, is what a basket estimate is built from.
- **Invoices before November 2025 use a narrower template that cuts product names mid-word**: "Jean Rozé, une ma... Chipolata supérie...". The parser folds each of those onto the one full name containing all its fragments in order, and leaves the genuinely ambiguous ones alone — "Jean Rozé, une ma... Viande hachée vra..." matches both the 5% and the 15% mince, so it stays separate and is marked `nameTruncated`. Those names are a frequency signal only; they must never be used as search terms.

### 2. Standing preferences

`preferences.json` holds the things the receipts can't tell you: household size, budget ceiling, what I'm bored of, non-negotiables, which night is a leftovers night.

The two that matter most are constraints rather than tastes. **No chilli at all** — IBS, so this is a health rule and not a preference to be traded off. And **milk and cream minimised** — cheese is fine, coconut milk is fine, so curries still work.

There is also a `pantry` block listing the Asian staples Méré is *confirmed* to stock, taken from my own receipts rather than guessed: Kikkoman soy, the Itinéraire des Saveurs yakitori and sweet soy sauces, Tanoshi sushi rice, nori and ramen, Suzi Wan rice vermicelli, Ajinomoto gyoza. Those double as known-good search terms.

### 3. The weekly conversation

`.claude/skills/courses/SKILL.md` is the skill Claude loads. It defines the three questions, how to weight history against novelty, how to build the plan, and how to convert the plan into a line-item list with quantities that account for what's already in the pantry.

Three questions, not five. Anything more and I won't do it every week.

The one rule in there worth calling out: **familiarity comes from the ingredient, not the dish.** My receipts are a French repertoire — mince, chipolatas, baguette, Boursin — but that is what I bought, not what I want to eat. So the plan builds Asian dishes out of the things I buy every week anyway. Eggs, chicken, peppers, onions, broccoli and rice make a donburi as easily as they make a gratin.

### 4. The basket

Claude in Chrome, on my PC, with my Intermarché session already logged in. It goes to the Drive Méré store, searches each line item, adds it, and stops. It does **not** book a slot and does **not** pay. I open the basket, read it, remove what I don't want, and confirm.

## Non-negotiable rules

- Claude never completes a purchase. It fills, then stops.
- Every line item in the basket must trace back to a dish in the plan, or to the standing staples list. No surprise additions.
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

- [x] Invoice parser — 22 orders, 208 distinct products
- [x] Preference file
- [x] Weekly planning skill
- [x] Swap a meal you don't fancy, shared with my partner
- [x] Recurring Sunday reminder
### 5. The app

`artifact/template.html` plus `scripts/build-week.mjs` turn the plan data into a published page — three tabs: the week, a growing recipe library, and the shopping list. The week sorts by day, by prep time or by cuisine, and filters by ingredient or by how long I've got.

It is generated, not hand-written, so next Sunday is a new plan file and `npm run build:week`. The URL never changes because the build republishes to the one recorded in `data/artifact-url.txt` — publishing without it would create a second artifact and orphan the bookmark.

It is also a two-person app. Any meal can be swapped — either for another dish from the library, or for something new invented on the spot — and the picks live in a shared database, so my partner and I see the same week on our own phones. The shopping list is derived from whatever is currently picked, so the total follows every swap. A dish eaten out of an earlier batch is marked as leftovers and buys nothing, which is the only reason the numbers come out right: counting the Sunday curry three times bought six tins of coconut milk for one pot.

The library is 32 dishes now, roughly half Asian and half European. Ready-made things like the gyoza are still on the menu but marked as assemblies — a note about the packet, and a real recipe only for the part that is actually cooked.

- [ ] Browser automation step — documented in the skill, not yet run against a real plan
- [ ] The budget question — a 7-dinner, 5-lunch week with a pantry restock prices out around 139 €, comfortably over the normal 100 € ceiling. First real run will settle whether the ceiling moves or the lunches go back to being leftovers.
- [ ] Pantry state — knowing the 20-egg pack from last week is half gone

## Setup

```bash
npm run parse       # invoices -> purchase history
npm run build:week  # plans + recipes -> artifact/week.html
```

No dependencies — the parser uses only the Node standard library, so there is nothing to `npm install`. Node 18 or newer.

To add a new invoice, fetch the email body as plain text through the Gmail connector and save it to `data/invoices/<YYYY-MM-DD>-<orderNumber>.txt`, then re-run the parser.
