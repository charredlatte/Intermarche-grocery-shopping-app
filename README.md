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

Claude in Chrome, on my laptop, with my Intermarché session already logged in. It goes to the Drive Méré store, searches each line item, adds it, and stops. It does **not** book a slot and does **not** pay. I open the basket, read it, remove what I don't want, and confirm.

## Non-negotiable rules

- Claude never completes a purchase. It fills, then stops.
- Every line item in the basket must trace back to a dish in the plan, or to the standing staples list. No surprise additions.
- If a product is unavailable, propose the substitute in chat before adding it — the receipts show this happens once or twice per order.
- Budget is a ceiling, not a target.
- Nothing chilli reaches the list.

## Where the data lives

My disk is full, so nothing is checked out permanently. There are two repos:

| | |
| --- | --- |
| this one | public — the code and the skill |
| `intermarche-grocery-data` | private — invoices, purchase history, preferences |

The private one is cloned into `data/`, which is gitignored here, so the layout on disk is exactly what the parser expects and the public repo can't leak anything. `preferences.example.json` documents the config shape without any of my details in it.

## Phone vs computer

- **Phone:** the weekly conversation. Answering the three questions, seeing the plan, adjusting it. This is 90% of the interaction and works fine in the Claude app.
- **Computer:** the basket-filling step only, because it needs Chrome with my logged-in session.

The handoff is the plan itself. Answer on the couch Sunday morning, run the basket step on the laptop whenever.

## Status

- [x] Invoice parser — 22 orders, 208 distinct products
- [x] Preference file
- [x] Weekly planning skill
- [x] Recurring Sunday reminder
- [ ] Browser automation step — documented in the skill, not yet run against a real plan
- [ ] Pantry state — knowing the 20-egg pack from last week is half gone

## Setup

```bash
gh repo clone charredlatte/intermarche-grocery-data data
npm run parse
```

No dependencies — the parser uses only the Node standard library, so there is nothing to `npm install`. Node 18 or newer.

To add a new invoice, fetch the email body as plain text through the Gmail connector and save it to `data/invoices/<YYYY-MM-DD>-<orderNumber>.txt`, then re-run the parser.
