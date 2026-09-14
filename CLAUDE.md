# Intermarché grocery app

Weekly meal planning that ends with a pre-filled Intermarché Drive basket
Charlotte only has to review and confirm.

`README.md` is the reasoning. This file is the operating brief.

## One repo, nothing kept on the machine

Her disk is full, so there is no permanent checkout. Every session clones, works,
pushes, and is thrown away.

**One repo now.** `charredlatte/Intermarche-grocery-shopping-app` holds the code
*and* `data/` — invoices, purchase history, preferences, recipes, plans. Charlotte
asked for that on 2026-09-05, having been shown that the repo is public and that
`data/` therefore publishes a year of her receipts and the IBS note in
`preferences.json`. It was her call; don't quietly re-split it.

There was a separate private `intermarche-grocery-data` repo until 2026-09-05.
It has been retired — everything it held is in `data/` here. Do not recreate it.

**First thing in a fresh session:**

```bash
gh repo clone charredlatte/Intermarche-grocery-shopping-app app
```

Everything the parser, the build and the skill need is already in `data/`.

## The three pieces

**1. Purchase history.** Intermarché emails a `Votre facture est disponible`
receipt after every Drive order, itemized with exact product names, quantities,
unit prices and what was out of stock. 22 of them, Oct 2025 → Aug 2026, are in
`data/invoices/` as plain text. `scripts/parse-invoices.mjs` turns them into
`data/purchase-history.json`. That is a better preference model than any
onboarding quiz, because it is what she did rather than what she said.

It also means the shopping list can use **exact Intermarché product names** as
keys — into prices, equivalents and `data/catalogue.json`, which maps each one
to its product page at Méré. The names are not search terms; see the catalogue
section for why.

**2. Standing preferences.** `data/preferences.json` — household, budget, the
dietary constraints, the confirmed-in-stock pantry. Hand-edited, never generated.

**2b. What's already in the kitchen.** The build seeds an on-hand list from the
**most recent invoice** and the page subtracts it, so the shopping list is what
she still has to buy rather than what the recipes add up to. `data/equivalents.json`
— hand-edited, like preferences — says which products stand in for one another,
so the Jean Rozé pork chops on the receipt cover a recipe naming the Terroirs
ones. Every match is printed on the line it covered: an equivalence is reported,
never silent. Charlotte and her partner can correct any quantity, swap the
product, strike a line off or add one, and all of it is shared.

Deliberately week-scoped — each plan re-seeds from the newest receipt rather than
carrying a running inventory forward, because an inventory nobody decrements
under-orders, and under-ordering ends with no dinner. Note "pantry" is already
taken twice (`preferences.pantry` = what Méré stocks; a recipe's `pantry: true`
= salt, oil, eggs). This is "on hand".

**3. The weekly conversation.** `.claude/skills/courses/SKILL.md` — three
questions, then a plan, then a line-item list, then the basket.

## Planning rules that bit us once already

- **Half the dinners European, half Asian.** `preferences.cuisines.weeklyShare`
  was `"most"` until 2026-09-06, which quietly made every week ~70% Asian even
  though the library was already half European. It is `"half"` now. The balance
  to check is the *week's plan*, not the library.
- **Breakfast is seven sandwiches a week**, not an afterthought — baguette,
  Boursin, charcuterie, sliced cheese, cherry tomatoes (`sandwich-matin`). It is
  the meal they eat most and it was missing from every plan and every order
  until 2026-09-06. Cherry tomatoes are the sandwich ones; round tomatoes are for
  cooking, which is why the two are not in the same equivalence group.
- **Use products she has never bought.** `preferences.ingredients` says yes to
  pancetta, saffron, anchovies, capers, manchego, gambas and the rest. They ship
  as `guess: true` with an estimated price, then get a catalogue entry (below);
  once the site has named one, the page files it under "New to you" at the
  site's price instead of "Best guesses".
- **Some European staples are still banned**: chorizo, piment d'Espelette,
  guindilla, peperoncino, 'nduja, merguez. All carry heat, and the IBS rule
  outranks authenticity. Where a recipe departs from the original for this
  reason, it says so in its own text.
- **Every recipe declares its `equipment`.** She has an air fryer, an oven,
  muffin tins and casserole dishes — recorded in `preferences.cooking.equipment`,
  and filterable on the Recipes tab. The air fryer and the muffin tin were being
  ignored entirely until 2026-09-06; use them. Assume nothing else: no microwave,
  slow cooker or barbecue is recorded.
- **Favourites live in the page, not the repo.** Stars are written to the shared
  artifact database at `library/favourites`, deliberately outside
  `weeks/<weekOf>` so they survive a new plan. Favourited dishes sort to the top
  of the library and the swap sheet. Nothing about them is generated at build
  time — don't look for them in `data/`.

## Méré's catalogue: `data/catalogue.json`

Scripted requests to `intermarche.com` get **403 with `x-datadome: protected`**
(checked 2026-09-06). Her own Chrome, logged in and set to Méré, renders the
site normally — so the catalogue is read there, by browsing, a page at a time.
Never script their API or fire searches in a burst, and never log in for her:
she signs in herself.

On 2026-09-14 every product the app can buy — 153, from recipes, staples and
equivalents — was looked up and recorded with its product link
(`/produit/<slug>/<barcode>`), the site's brand, title and pack, the day's
price, a search term that works, and a status: **94 exact, 12 check** (renamed
or repacked), **29 picked** (guesses resolved to real listings), **18 missing**.
The Drive checklist links each row straight to its product page, and the
approved list carries those links into the basket step. `npm run catalogue:queue`
lists what still needs looking up; the skill has the procedure.

What the lookup taught, which is why receipt names were never going to work:

- **The receipt name is a poor search term.** Search ranks rather than matches.
  A full house-brand name ("Jean Rozé, une marque Intermarché …") floods the
  results with every house-brand product; a renamed or repacked product returns
  nothing. Exact names remain the *keys* — into the pricebook and the catalogue.
- **A fifth of the receipt products have changed** (25 of 118): Ajinomoto gyoza
  and Suzi Wan rice vermicelli are gone, Kikkoman soy is a 150 ml carafe, eggs
  come in twelves, Herta's lardons are "sans nitrite", the 500 g emmental bag is
  now 200 g or 1 kg.
- **The "Trouvez le produit idéal" carousel lies.** It sits above the results
  grid and shows products Méré does not stock. Read the grid only.
- **Gaps to plan around**: no fresh parsley, thyme or rosemary (fresh herbs are
  basil, dill, mint and coriander, sold "en botte"), no romaine, oak-leaf lettuce
  or rocket, no fresh trout fillets, no manchego, no raw peeled gambas, no
  cooking wine.
- **Stock moves daily.** Twenty listings were out of stock on the day. The
  catalogue records it as a hint; the basket step checks each page live.

**`data/seen-in-app.json` is still the phone route.** When Charlotte sends a
screenshot of the app, record what is *on screen* — exact name, packaging, price,
unit, the date — and it joins the pricebook with `source: "app"`. Record nothing
you cannot see. A receipt always outranks it.

A guess being wrong is not hypothetical. Two recipes assumed fresh leeks; the
screenshot of 2026-09-04 shows the Légumes aisle returning exactly one leek
product, a **jar** of cooked leek whites at 6,23 €. Fresh poireaux are not
stocked. Ask for a screenshot when a guessed product matters to a dish.

## Commands

```bash
npm run parse            # data/invoices/*.txt -> data/purchase-history.json
npm run build:week       # recipes + plans + catalogue -> artifact/week.html
npm run catalogue:queue  # products with no catalogue entry, or one older than 28 days
npm run drive:list -- <push doc>.json [<progress dir>] [--batch <tabId>]  # work list, or ready-made browser batches that run scripts/drive-helper.js
```

**A fresh page every week.** Each `/courses` run publishes the built page as a
new artifact — new link — and records it in `data/artifacts.json` under the
week. Charlotte asked for this on 2026-09-14. Her favourites (`library/favourites`)
are copied across from the previous page with `read_db`/`write_db`; publish with
`capabilities: { db: {}, sample: {} }` and `contract: "0.2.41"`. The pages before
that week shared one bookmarked URL, still listed there as the old page.

The page is an app, not a printout, and **the basket is its centre**. Basket is
the first tab and where it opens: Méré's own name, pack and current price on
every line, a count to add in the site's packs, and a total against the ceiling.
Anything Méré sells differently or not at all sits under "Decide first" with its
options, and **Approve stays locked until every one is decided** — nothing is
swapped for her. Weighed goods are marked ≈, because the Drive charges the exact
weight. Where Méré's pack differs from the receipt's, the count is converted by
weight, volume or piece count (20 eggs become two boxes of 12). Picks, counts
and decisions live in the shared database under `weeks/<weekOf>`; nothing she
does writes back to the repo — the plan file is only the starting point.

**Approved, the page pushes.** "Push to Intermarché" writes `push/<weekOf>` —
the approved lines, each resolved to a listing and a count. The page cannot reach
intermarche.com, so the request waits for `/courses push` on her PC, which fills
the basket in her Chrome and reports each step as a **new document** in
`push/<weekOf>/progress`; the page folds those over the request and shows the
progress and, at the end, the site's own total against the estimate.

Why new documents: checked 2026-09-14, the Artifact tool's `write_db` refuses
`update`, `set` and `delete` on any document that already exists
(`version_mismatch` — it wants an `if_version` the tool cannot send). Creating a
document is the only write Claude can make to a page's database once her page is
live, so everything Claude reports is append-only, and anything seeded into a
new page has to be written before she first opens it.

Week, Recipes and the Cook quiz sit behind the basket unchanged. Cook is a
five-step quiz modelled on the Potto flow Charlotte sent on 2026-09-06; no-chilli
is a locked card, because it is a health rule, not a mood.

No dependencies; `npm install` is a no-op. Node 18+.

To add a new invoice: fetch the email body through the Gmail connector as plain
text, save it to `data/invoices/<YYYY-MM-DD>-<orderNumber>.txt`, re-run the
parser. The filename supplies the year — the email body never states it.

## Hard rules

- **Claude never completes a purchase.** Fill the basket, then stop. No slot
  booking, no payment. The confirmation is hers.
- **Every line item traces back** to a dish in the plan, to the standing
  staples list, or to her "Meal Planning" list in Google Keep, which the push
  adds on her say-so (2026-09-15). No surprise additions.
- **No chilli, ever.** IBS — this is a health constraint, not a taste preference.
  Check the finished list before showing it.
- **If a product is unavailable at basket time, stop and ask.** Adapting a recipe
  to what Méré stocks is decided up front and reported; substituting an
  out-of-stock item is not something to do silently.
- **Budget is a ceiling, not a target.**
- **Everything in this repo is public, `data/` included.** That is deliberate and
  Charlotte's decision — do not re-add a `.gitignore` for it, do not re-split the
  repo, and do not treat committing an invoice as a mistake. The weekly run adds
  a new receipt to `data/invoices/` and publishes it; that is the intended
  behaviour.
- **What must still never be committed:** her Intermarché password or session
  cookie, any order-tracking or invoice-download URL from the emails (those carry
  access tokens), and any payment detail. The invoice parser is fed the plain-text
  email body with the `click.news.intermarche.com` links stripped for exactly this
  reason — keep stripping them.

## Phone vs PC

The weekly conversation — answering the three questions, seeing the plan,
adjusting it — is 90% of the interaction and works fine in the Claude app. The
basket-filling step needs Chrome with her logged-in session, so it runs on her
PC — the same machine Claude Code runs on. She has no laptop. The handoff is
the plan itself.
