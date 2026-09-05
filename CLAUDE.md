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

**3. The weekly conversation.** `.claude/skills/courses/SKILL.md` — three
questions, then a plan, then a line-item list, then the basket.

## Commands

```bash
npm run parse         # data/invoices/*.txt -> data/purchase-history.json
npm run build:week    # data/recipes.json + data/plans/*.json -> artifact/week.html
npm run sync:artifact # the published page -> artifact/template.html + week.html
```

`sync:artifact` runs the other way, and the weekly run passes through it before
it publishes anything. The live page can be rebuilt from outside a session — that
has happened, and the icons in the shopping list existed only in the published
HTML until `d89307a` put them back by hand. So: `read` the artifact with the
Artifact tool, which saves the HTML to a file, then

```bash
npm run sync:artifact -- --check <that file>   # 0 in sync, 1 drift, writes nothing
npm run sync:artifact -- <that file>           # recover the drift into the repo
```

Recovery reverses the data injection and then rebuilds to prove the template
reproduces the live page byte for byte; if it cannot, it writes nothing and says
why. **Never republish over a failed `--check`** — that overwrites work that
exists nowhere else.

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
