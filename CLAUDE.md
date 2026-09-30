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
`data/` therefore publishes a year of her receipts and her dietary notes in
`preferences.json`. It was her call; don't quietly re-split it.

There was a separate private `intermarche-grocery-data` repo until 2026-09-05.
It has been retired — everything it held is in `data/` here. Do not recreate it.

**First thing in a fresh session:**

```bash
gh repo clone charredlatte/Intermarche-grocery-shopping-app app
```

Everything the parser, the build and the skill need is already in `data/`.

**Work lands on `main`, or it is lost.** Each session pushes to its own
`claude/*` branch, and the next one clones `main`. Until 2026-09-28 nothing was
merged: the same page-sync fix was written six times on four branches, and every
week was republished from a `main` that had none of them. So:

- start by running `git fetch origin && for b in $(git branch -r | grep claude/); do git log --oneline origin/main..$b; done`,
  and say so if anything is stranded;
- a session isn't finished until its branch is merged into `main`. Open a PR
  and merge it (Charlotte's call, 2026-09-28).

## The three pieces

**1. Purchase history.** Intermarché emails a `Votre facture est disponible`
receipt after every Drive order, itemized with exact product names, quantities,
unit prices and what was out of stock. 24 of them, Oct 2025 → Sep 2026, are in
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
**most recent invoice dated on or before the week's first day** (the week's own
shop, a few days in, is what it buys, not what was there) and the page subtracts it, so the shopping list is what
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
  guindilla, peperoncino, 'nduja, merguez. All carry heat, and the rule
  outranks authenticity.
- **Nothing she reads says what was left out.** No "no chilli" tag, no "mild by
  design", no "the original carries peperoncino" — in a recipe, a plan note or
  the page. Charlotte asked for that on 2026-09-28: she doesn't like spicy food
  and doesn't need it pointed out. `build-week.mjs` enforces the rule on the
  ingredients instead of a label.
- **Every recipe declares one `protein`**, from exactly these eight: `chicken`,
  `turkey`, `pork`, `charcuterie`, `beef`, `fish`, `eggs`, `vegetarian`. It is
  the protein the dish is *built around*, not everything in it — the bolognese
  is `beef` though it holds lardons too. `charcuterie` means cured or deli meat
  (mortadelle, lardons, pancetta, jambon); fresh pork, chipolatas included, is
  `pork`. `build-week.mjs` validates it and ships
  the order to the page as `config.proteins` (the Recipes grouping is still to
  build — see below), and the same eight values tag the
  groups in `data/equivalents.json` — which is how `parse-invoices.mjs` rolls the
  receipts up into the `byProtein` block of `data/purchase-history.json`.
  **Balance the week's proteins as well as its cuisines.** Pork is in 22 of 24
  orders (to 15 September) and the library gives it two dinners; fish is in 2
  of 24, and that is price rather than taste.
- **Every recipe declares its `equipment`.** She has an air fryer, an oven,
  muffin tins and casserole dishes — recorded in `preferences.cooking.equipment`,
  and filterable on the Recipes tab. The air fryer and the muffin tin were being
  ignored entirely until 2026-09-06; use them. Assume nothing else: no microwave,
  slow cooker or barbecue is recorded.
- **Favourites live in the page, not the repo.** Stars are written to the shared
  artifact database at `library/favourites`, deliberately outside
  `weeks/<weekOf>` so they survive a new plan. Favourited dishes sort to the top
  of the library. Nothing about them is generated at build time — don't look for
  them in `data/`.
- **So do her ingredient edits.** The recipe sheet (tap a meal on Week, or
  "Ingredients & method" on a Recipes card) lets her change an amount, swap a
  product, take a row out or add one. They are stored per slug in
  `library/recipe-edits` — `{ edits: { <slug>: { add, set, drop, swap } } }`, rows
  keyed by the ingredient's `item`, which the build now requires to be unique
  within a recipe. So **renaming an `item` orphans her edit to it**, the same way
  renaming a slug orphans a star. They apply every time the dish is on the menu,
  are never written back to `data/recipes.json` (promoting one into the library is
  a `/courses` conversation), and every basket line they touch reads
  "<dish> (edited)". Adds and swaps are refused if they read as hot
  (`config.constraints.banned` + `avoidAlso`, plus paprika unless doux).
  Because they outlive the week, the edits document gets the week's three
  protections — nothing saves before the stored edits arrive (an early tap
  erased every other dish's edits), a save is written over the stored document,
  and a replaced copy stops saving. An edit that no longer finds its row — the
  `item` renamed or removed in `recipes.json` — is listed on the basket rather
  than silently not applied; and a row she added that the library recipe now
  has under the same `item` is the library's, so promoting an edit never buys
  it twice, even before the edit is cleared from the document.

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
npm run test:page        # builds, then drives the page against a stub store in headless Chromium
```

**Run `npm run test:page` after any change to the page, and before publishing.**
Each file in `test/page/` is one fresh load against a stub store that delivers
every snapshot late — the condition that broke saving six times — and each
proves one thing that once went wrong: an early tap blanking her week, a save
erasing another build's fields, a leftovers meal left without its pot, a
changed week pushed as the old list, a deleted dish taking its meal with it, a
replaced tab still saving, the same four for her recipe edits, and the chilli
guard and Approve lock. None of them names a meal or dish from a particular
week, so they outlive the plan. Against `main` as it stood before them, 16 of
their checks failed. Cloud sessions have Chromium at `/opt/pw-browsers/chromium`;
elsewhere set `CHROMIUM`.

**A fresh page every week.** Each `/courses` run publishes the built page as a
new artifact — new link — and records it in `data/artifacts.json` under the
week. Charlotte asked for this on 2026-09-14. Her favourites (`library/favourites`)
and recipe edits (`library/recipe-edits`) are copied across from the previous page
with `read_db`/`write_db`; publish with
`capabilities: { db: {}, sample: {} }` and `contract: "0.2.41"`. The pages before
that week shared one bookmarked URL, still listed there as the old page.

**Within a week, the page is updated in place.** A recipe that gains or loses
an ingredient, a renamed product, a changed dish in the plan file: rebuild and
republish onto the week's existing link (`url`, after reading it), never a new
one. Her state never moves, so nothing is copied. A new link splits the week —
whoever has the old page open keeps saving to its database, and a Push pressed
there is invisible to `/courses push`, which reads the link from
`data/artifacts.json`. The skill has the steps, under "Changing a week that is
already published".

**The page and a changed week, end to end** (2026-09-28, each one reproduced
against a stub store before it was fixed):

- *A leftovers meal names its pot.* `"from": "<meal id>"` is required on every
  `leftovers` meal and checked by the build. The meal buys nothing only while
  both it and its source are on their planned dishes, and her edits have taken
  nothing out of the source; swap either, or drop, cut down or swap a row of the
  source, and it is shopped for — before this, swapping Monday's dinner left
  Tuesday's leftover-rice lunch with no rice and no line on the list. Adding to
  the source, or more of something, keeps the pot. What she adds to the
  leftovers dish itself is bought; the rest still comes from the pot.
- *An approval remembers what the week needed* (`approved.wanted`). A swap, or
  a recipe changed in a republish, after she approved shows on the basket and
  in the header as what is now needed and what no longer is — and once the
  order has gone, as what to buy separately. It compares needs only, never the
  kitchen or her counts. Approvals from before this carry no `wanted` and stay
  quiet.
- *A swap to a dish since deleted from the library* falls back to the planned
  dish with a notice, instead of the meal vanishing from the week and the
  basket.

**Shared documents are written over, not instead of.** `persist()` saves the
week on top of the document the store last sent, so a field one copy of the
page doesn't know — added by a newer build, open on the other phone — survives
a save from the older copy. Two versions are live after every republish, until
everyone reloads. So a new field must be additive and optional; never rename
one or change what it means, because an older copy will keep writing the old
meaning. And nothing saves until the stored week has arrived: before that the
page holds only the build's defaults, and one early tap on a slow phone used to
replace her whole week — counts, decisions, approval — with a blank one.

**A copy of the page that has been replaced stops saving.** Every save carries
the build's `builtAt`; a copy that sees a newer build save *while it is open*
turns its sync line amber — "This page has been updated — reload it" — and
saves nothing more, so a tab left open across a republish cannot write the old
page's whole idea of her week over the new one's. A fresh load never counts as
replaced, whatever the store says, so reloading is always the way out and a
build from a machine with a slow clock can't lock the live page. It protects
from the first republish after 2026-09-28 on; copies older than that never
learnt to check,
which is why fields are also written over rather than instead of. Two copies of
the *same* build still share last-writer-wins on each field — a real per-key
merge would need the store's `if_version`, which the page's runtime does not
offer.

**The build refuses a checkout that is behind `origin/main`.** The last publish
wins the page's code for everyone, so a page built from a branch missing
someone else's merged work quietly undoes it. Fetch and merge `main`, then
build.

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

Why new documents: on 2026-09-14 the Artifact tool's `write_db` refused
`update`, `set` and `delete` on existing documents because it could not send
`if_version`. It can now (`ArtifactData` takes `if_version`, checked
2026-09-28), but the append-only progress reports work, so they stay. Seeding a
new page is still best done before she first opens it.

**Household is the fourth tab** (Charlotte, 2026-09-28): the things no recipe
asks for — drain cleaner, bin bags, sponges. It is the list she adds to by hand,
`added` in `weeks/<weekOf>`, which the Basket's "Add something" also feeds; in
the basket it is the "Household & extras" section and every line reads "your
household list". The picker offers the household products in her receipts
before she types (`HOUSE_PRODUCTS`, matched by name), searches the receipts and
the catalogue, and takes a typed name as a best guess that `/courses push`
looks up and asks about. Nothing hot gets in this way either. It is the page's
own copy of her Google Keep "Meal Planning" list and is week-scoped like the
rest of the week's document: a new week's page starts it empty.

**Keep reaches the page by paste, because nothing else can.** There is no Keep
connector (checked 2026-09-28: not in her account, not in the registry), and
Google's Keep API is for Workspace business accounts only. Keep copies a note
as text — ⋮ → Send → Copy to clipboard — and the Household tab's "Paste your
Google Keep list" takes it: ticked lines, blank lines and the title are left
out, "x2" is a count, a name that matches exactly one receipt product goes in
as that product, one the basket already buys for a dish or the standing order
is left off and said so, and anything else goes in as written, marked
`from: "keep"`, with "Did you mean" offers from her receipts beside it — she
picks; nothing is swapped in for her. English names are looked up through a
short word list (`KEEP_WORDS`), since her receipts are French. Hot items are
refused, with a safe product offered (paprika → paprika doux). The paste box
sits outside the redrawn part of the tab, so a sync never eats what she is
pasting.

**Every picker takes a name nothing knows** (2026-09-28, after the Basket's Swap
told her "Nothing in your receipts matches" for *carottes rappees*). All of them
search her receipts *and* the catalogue, accent-blind ("rapees" finds
"râpées"), and when nothing matches exactly what she typed they offer it
anyway: from a basket line's Swap, "Buy … instead" (a `subs` entry to a name no
receipt knows — a guess Claude looks up at the push) or "Add … as well" (the
household & extras list); from the recipe sheet, as an ingredient; from the
Household tab, as an item. The chilli guard sits on every one of those doors.

Week and Recipes sit behind the basket. Two things Charlotte asked for on 15–16
September were built on `claude/*` branches and never merged, and the basket page
was redesigned on top of a `main` without them. They are her standing requests,
confirmed again on 2026-09-28, rebuilt into today's template rather than merged
from the old one:

- **Done 2026-09-28, from `claude/meal-planning-app-reorganize-pddufg` (c2d3a32):**
  three tabs — Basket, Week, Recipes; the Cook quiz is gone. Week is a plain seven
  days from the plan's first day, each meal in eating order with dish, time and ★;
  tap to open the recipe sheet; "Back to the planned week" sits under the days
  only once something is swapped. Recipes is the only place the week changes:
  `Group by [Protein] [Cuisine]`, and every card carries `Cook this on…`, the day
  picker on that dish's own slot (with "put the original back" per day). The dish
  generator lives there too and assigns through the same picker.
- **Still to build, from `claude/trusting-tesla-a9rmyl` (b901bd8, 57b19b0, 415fdfd):**
  a Kitchen tab that she and her partner keep up to date — what is actually in,
  stamped per statement, in its own document outside `weeks/` — and a Week that
  tracks how it is lived: each meal ticked cooked or not, moved, struck off, or
  added, with cooked meals drawing down the kitchen and anything behind her
  dropping out of the basket. The sync and redraw fixes from that branch already
  landed in 29c3a65; only the features are outstanding. Four things that
  branch got wrong, or only found late, so the rebuild doesn't:
  - a `mode: "once"` ingredient is the week's supply — a bottle, a head of
    garlic — so ticking one dish that uses it cooked must not take the whole of
    it out of the kitchen;
  - record what a meal used at the moment it is ticked cooked, or a recipe
    edited later rewrites what was already eaten;
  - `approved.wanted` compares the week's *needs*. If "behind her" is made to
    drop out of `weekWanted()`, every dinner she ticks after the shop will read
    as a change since approval — take it out in `basket()` instead, or compare
    against the plan without it. A struck-off or ticked source meal should also
    end its leftovers meal's `leftoversHold`, as a swap already does;
  - merge `library/kitchen` per product, newest `at` wins, rather than writing
    the whole `items` map from whichever copy of the page saved last. On the
    16 September trial page the document reached version 17 still holding one
    statement: with the page open in several tabs across four republishes, each
    copy saved its own map over the others. Single-tab tests never showed it.

Delete both branches once the Kitchen work is done, not before.

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
- **No chilli, ever.** She doesn't like spicy food. It is taste, not health
  (corrected 2026-09-28 — older notes called it IBS), but it is never traded off.
  Check the finished list before showing it, and never label it: nothing she
  reads says "no chilli".
- **If a product is unavailable at basket time, stop and ask.** Adapting a recipe
  to what Méré stocks is decided up front and reported; substituting an
  out-of-stock item is not something to do silently.
- **Budget is a ceiling, not a target.**
- **A recipe's slug never changes.** Slugs are the keys in `library/favourites`
  in the live shared database, so renaming one silently orphans a star on her
  page. Titles and ingredients change freely; the slug stays even when it ends up
  describing the old version — `pisto-manchego` makes parmesan and
  `salade-roquette-parmesan-pommes` is mâche, because Méré stocks neither.
- **A `missing` catalogue entry is usually not a bug.** Most of them carry
  `alternatives`, and the page's "Decide first" section holds the basket until
  Charlotte picks — that is the design, and the reason nothing is swapped for
  her. Only adapt the *recipe* when Méré stocks no version of the thing at all
  and there is no alternative to offer, and then say so in the recipe's own text.
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
