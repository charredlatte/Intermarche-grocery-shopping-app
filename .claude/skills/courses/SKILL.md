---
name: courses
description: Run the weekly meal plan and fill the Intermarché Drive basket. Use when Charlotte says "courses", "meal plan", "what should I eat this week", or when the Sunday reminder fires.
---

# Weekly courses

Plan the week — 7 dinners and 5 weekday lunches — then pre-fill the Intermarché
Drive Méré basket so she only has to review and confirm.

## Before asking anything

Nothing persists on her machine. Set up first:

```bash
gh repo clone charredlatte/intermarche-grocery-data data   # if data/ is missing
node scripts/parse-invoices.mjs                            # if the history is stale
```

Then read `data/preferences.json` and `data/purchase-history.json`. The history
is older than the newest Intermarché invoice in Gmail if a `Votre facture est
disponible` email post-dates `generatedAt` — add it to `data/invoices/` as
`<YYYY-MM-DD>-<orderNumber>.txt` and re-run the parser.

Come to the conversation already knowing what she buys. Do not ask questions the
receipts answer.

## The three questions

Ask all three at once as tappable options. Not more than three — a longer quiz
gets skipped, and a skipped week is worth less than an imperfect plan.

1. **How many dinners this week?** (default 7 — offer 5 and 7)
2. **What are you in the mood for?** — multi-select, up to 3. Draw the tags from
   the cuisines she actually wants and the dishes she actually cooks.
3. **Anything to use up or avoid?** — free text, optional.

## The constraints, in priority order

These are not preferences. Check the plan against them before showing it.

1. **No chilli. None.** IBS. No gochujang, no chilli oil, no bird's eye, no
   harissa, no hot curry paste. Where a dish *is* chilli — mapo tofu, kimchi
   jjigae, most Thai red and green curry — don't propose it and don't propose a
   sad de-chillied version. Build heat-free flavour instead: ginger, garlic,
   spring onion, sesame, soy, rice vinegar, miso, citrus, black pepper. Mild
   curry powder and tandoori are fine; she buys both.
2. **Milk and cream minimised.** Cheese is fine — the receipts are full of it.
   Coconut milk is not dairy and is unrestricted, so Thai and Indian curries
   work normally. She keeps almond milk in the house, which substitutes in most
   places cream would go.
3. **30 minutes on a weeknight.** Anything slower is a Sunday job.

## Building the plan

- **Asian most nights.** Japanese, Korean, Chinese, Thai, Vietnamese, Indian.
  Spring rolls are a favourite and are made often. Non-Asian nights should be
  vegetable-forward — brussels sprouts, peppers, broccoli, aubergine — not
  another pasta bake.
- **Familiarity comes from the ingredient, not the dish.** The receipts show a
  French repertoire, but that is what she *bought*, not what she wants. Build
  Asian dishes out of what she already buys week after week: eggs (20 at a
  time), chicken fillets and aiguillettes, turkey escalopes, beef mince, pork
  chops, peppers, onions, garlic, broccoli, cucumber, mâche, basmati rice. A
  donburi, a stir-fry and a bún bowl all come out of that list.
- **The pantry is already half built** and Méré is confirmed to stock it — see
  `preferences.json` → `pantry.confirmedAtMere`. Kikkoman soy, yakitori sauce
  (soy/sake/mirin), sweet soy, Tanoshi sushi rice, nori, ramen, Suzi Wan rice
  vermicelli, Ajinomoto gyoza. Reach for these first; they are known-good search
  terms as well as known-good ingredients.
- **One Sunday batch cook** that seeds two weeknights — a braise, a curry base,
  a big pot of rice, or a batch of spring rolls rolled ahead.
- **Reuse perishables across dishes.** A 20-egg pack, a bunch of coriander and a
  head of broccoli should each appear in more than one meal, or they rot.
- **Lunches are their own small dishes**, sized for one — onigiri, a noodle
  salad, bánh mì, a rice bowl on the batch cook, something with mâche and eggs.
  Not a doubled dinner portion.
- Show the plan with a rough per-dish cost so the total is visible before the
  basket exists.

## Converting the plan into a list

Every line must be an **exact Intermarché product name** from the purchase
history where one exists — "Jean Rozé, une marque Intermarché Viande hachée vrac
pur BŒUF 5% MG", not "ground beef". Exact names resolve to one search result on
the site; generic names resolve to forty and the basket step becomes unreliable.

Two things in `purchase-history.json` to respect:

- A product with `nameTruncated: true` came only from the old, narrower invoice
  template and its name is a cut-off fragment. **Never use it as a search term.**
  It is a frequency signal only.
- **Cost the list from `typicalLineTotal`, never from `lastPrice`.** For anything
  sold by weight `lastPrice` is the price *per kilo* — the chicken aiguillettes
  read 29,99 € but a pack actually costs about 6 €, and garlic reads 15,99 €
  against about 2 € a head. `typicalLineTotal` is the median of what was really
  paid for that line. Costing from `lastPrice` overstates a basket by half again.

For anything not in the history, propose the closest thing and flag it as a
guess. If a recipe wants something Méré doesn't stock — gochujang, mirin, fish
sauce, fresh Asian greens — **adapt the recipe to what Méré has and say what you
swapped.** Don't send her to a second shop.

Add the standing staples from `preferences.json`, at the quantities given there
— the cat food is ×2, there are two cats. Then subtract anything likely still in
the pantry from last order, and say what you subtracted, so she can correct you.

Show the list with a running total against the budget ceiling before touching
the browser. A pantry-restock week uses `pantryWeekCeiling` instead of
`ceilingPerOrder` — say plainly that you're claiming it and why.

## Filling the basket

Runs on her PC, in Chrome, with her Intermarché session already logged in. That
is the same machine Claude Code runs on — she has no laptop, so if you are on the
PC you can do this now; if she is on her phone, it waits.

1. Confirm the store is **Drive Méré** before adding anything.
2. Search each line item by exact name, add it, set the quantity.
3. If a product is unavailable, **stop and ask**. Do not substitute silently.
   The receipts show one or two items per order go out of stock, so this will
   come up most weeks. This is different from adapting a recipe up front, which
   is decided before the browser opens.
4. When the list is done, report what went in, what didn't, and the basket total
   versus the plan estimate.

## Hard stops

- **Never book a slot. Never pay. Never complete the order.** Fill the basket
  and stop. The confirmation is hers.
- Never add a line item that doesn't trace back to a dish in the plan or to the
  staples list.
- If the basket total exceeds the ceiling, say so and propose what to cut. Don't
  silently cut it yourself.
- Nothing chilli reaches the list. Check before showing it.

## Publishing the week to her phone

The plan is not delivered until it is on the page she actually opens. After she
approves a plan, before or after filling the basket:

1. **Add any new dish to `data/recipes.json`** — slug, title, cuisine, slot,
   `kind`, prep and cook minutes, serves, tags, ingredients and full steps.
   - `kind: "recipe"` for something cooked. `kind: "assembly"` for a night built
     on a ready-made product; it needs a `packNote` saying what comes out of a
     packet, and its `steps` must cover only what is genuinely cooked. **Never
     write a numbered method for reheating a bought product.**
   - An ingredient is `{ item, qty, product, buy }`. `item` is the plain name
     the filter groups on ("broccoli"); `product` is the exact Intermarché
     string; `buy` is what to put in the basket:
     `{ amount, mode, section }`. `mode: "sum"` adds up across dishes (meat,
     the vegetables a dish really consumes); `mode: "once"` is a thing bought
     once for the week however many dishes use it — **every aromatic, salad and
     citrus belongs here**, or three dishes wanting garlic buy three heads.
   - Omit `buy` for anything already in the cupboard, and add `"pantry": true`.
   - `"guess": true` plus `buy.price` when the product has never been on a
     receipt. The build rejects a non-guess product missing from the pricebook.
2. **Write `data/plans/<weekOf>.json`** — the meals, each with a stable `id`
   (swaps are keyed on it), day, slot, recipe slug, and optional `note`.
   A portion eaten out of an earlier batch gets `"leftovers": true` and a
   `minutesOverride`; the basket skips it, because that pot is already paid for.
   **There is no shopping array any more** — the basket is derived from whatever
   meals are picked, so it survives her swapping things.
3. **`npm run build:week`** — emits `artifact/week.html`.
4. **Republish to the URL in `data/artifact-url.txt`.** Pass it as the Artifact
   tool's `url`. Publishing without it creates a second artifact and breaks the
   bookmark on her phone. Do not change the favicon or the title, and **omit
   `capabilities` so the stored `db` and `sample` grants carry forward** —
   restating a partial set would revoke the other.
5. **Her swaps live in the shared database, not in the plan file.** The page
   reads `weeks/<weekOf>` and overlays those picks on the plan you shipped. A
   new week means a new `weekOf`, so it starts clean without touching hers. If
   she asks to keep a swapped-in dish permanently, move it into the plan file.
6. Commit both repos.

Reuse a slug rather than writing a near-duplicate — that is what makes the
Recipes tab a library worth re-picking from, and it shows her which weeks a dish
has already appeared in.

## After she confirms

Save the week's plan if she wants it kept, commit and push the data repo, and
stop. The invoice email arrives within the hour; next week's parser run picks it
up and the history improves on its own.
