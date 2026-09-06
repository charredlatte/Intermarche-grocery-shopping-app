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

It also means the shopping list can use **exact Intermarché product names**,
which is what makes the browser step reliable. Searching "ground beef" on
intermarche.fr returns forty things; searching the exact name returns one.

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
  as `guess: true` with an estimated price into "Best guesses" — see below for
  why they cannot be looked up.
- **Some European staples are still banned**: chorizo, piment d'Espelette,
  guindilla, peperoncino, 'nduja, merguez. All carry heat, and the IBS rule
  outranks authenticity. Where a recipe departs from the original for this
  reason, it says so in its own text.

## Intermarché's catalogue cannot be read

Checked 2026-09-06: `intermarche.com` returns **403 with `x-datadome: protected`**
to anything scripted. That is their bot protection, not the sandbox — the proxy
connects fine and other sites return 200. So there is no way to list what Méré
stocks, and no way to price or name-check a product she has not already bought.

What that leaves: the 181 products in `data/purchase-history.json` are known-exact
and known-priced, and **125 of them appear in no recipe** — that is the cheap
variety headroom. Beyond it, a new product is a `guess` with an estimated price,
flagged in the page as such. Do not promise Charlotte a catalogue lookup, and do
not log into her account: there is no browser session here, and the basket step
is deliberately hers, on her PC.

## Commands

```bash
npm run parse       # data/invoices/*.txt -> data/purchase-history.json
npm run build:week  # data/recipes.json + data/plans/*.json -> artifact/week.html
```

The built page is republished to the artifact URL in `data/artifact-url.txt`.
**Always pass that URL** — a publish without it creates a second artifact and
breaks the link she has bookmarked. **Omit `capabilities` on a redeploy** so the
stored `db` and `sample` grants carry forward.

The page is an app, not a printout: Charlotte and her partner swap meals, the
picks live in a shared database under `weeks/<weekOf>`, and the shopping basket
is derived from whatever is currently picked. Nothing they do writes back to the
repo — the plan file is only the starting point.

No dependencies; `npm install` is a no-op. Node 18+.

To add a new invoice: fetch the email body through the Gmail connector as plain
text, save it to `data/invoices/<YYYY-MM-DD>-<orderNumber>.txt`, re-run the
parser. The filename supplies the year — the email body never states it.

## Hard rules

- **Claude never completes a purchase.** Fill the basket, then stop. No slot
  booking, no payment. The confirmation is hers.
- **Every line item traces back** to a dish in the plan or to the standing
  staples list. No surprise additions.
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
