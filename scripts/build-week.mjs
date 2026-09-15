#!/usr/bin/env node
/**
 * Pours the recipe library, every week's plan, and a pricebook derived from the
 * invoices into artifact/template.html, writing artifact/week.html.
 *
 *   data/recipes.json + data/plans/*.json + data/purchase-history.json
 *     -> artifact/week.html
 *
 * The page is data-driven so next week is a new plan file and a rebuild,
 * published by /courses as a fresh page for that week and recorded in
 * data/artifacts.json.
 *
 * data/ lives in this repo rather than a private one, so everything it reads is
 * public. Nothing secret may be added to it.
 *
 * The pricebook is the only part of the purchase history that ships. Weighed
 * goods keep their price per kilo and packaged goods their price per unit; the
 * page multiplies by the amount a dish actually calls for. Shipping unit price
 * alone would overstate a basket by half again, since chicken lists at 30 €/kg.
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE = join(ROOT, "artifact", "template.html");
const OUT = join(ROOT, "artifact", "week.html");
const DATA = join(ROOT, "data");

const die = (msg) => { console.error("build-week: " + msg); process.exit(1); };
const read = (p) => {
  try { return JSON.parse(readFileSync(p, "utf8")); }
  catch (e) { die(`could not read ${p} — ${e.message}`); }
};

const recipes = read(join(DATA, "recipes.json"));
const history = read(join(DATA, "purchase-history.json"));
const prefs = read(join(DATA, "preferences.json"));

// Interchangeable products. Optional — without it the page falls back to exact
// name matching, which still works, just misses a different brand of the same
// thing.
let equivalents = { groups: [] };
try { equivalents = JSON.parse(readFileSync(join(DATA, "equivalents.json"), "utf8")); }
catch { /* no equivalents file; exact names only */ }

// Products confirmed from a screenshot of the app rather than by a receipt —
// the route from her phone, alongside the catalogue read in her Chrome.
let seenInApp = { products: [] };
try { seenInApp = JSON.parse(readFileSync(join(DATA, "seen-in-app.json"), "utf8")); }
catch { /* nothing observed yet */ }

// What Méré's site lists for each product, read off intermarche.com. Receipt
// names are poor search terms and packs change, so the Drive checklist links
// straight to each product's page instead.
let catalogue = { products: {} };
try { catalogue = JSON.parse(readFileSync(join(DATA, "catalogue.json"), "utf8")); }
catch { /* not built yet; the checklist falls back to searching by name */ }

// The eight proteins, in the order the Recipes tab groups by. One dish, one
// protein: the one it is built around. Shipped to the page in config so the
// page and the library cannot drift apart on either spelling or order.
const PROTEINS = ["chicken", "turkey", "pork", "charcuterie", "beef", "fish", "eggs", "vegetarian"];

// Nothing else may claim an appliance she does not own — a recipe that assumes
// one is the same bug as the one that assumed fresh leeks.
const APPLIANCES = new Set(prefs.cooking?.equipment ?? []);
// Which of those actually apply heat, for the no-cook rule below.
const HEAT = new Set(["hob", "oven", "air fryer", "casserole dish"]);

/* ---- pricebook ---------------------------------------------------------- */
const pricebook = {};
for (const p of history.products) {
  if (p.nameTruncated || p.lastPrice == null) continue;   // a cut-off name is not searchable
  // The pack travels too: when Méré's pack differs, the page converts the count.
  pricebook[p.name] = { unit: p.unit, price: p.lastPrice, source: "receipt", pack: p.packaging };
}
// A receipt always wins: it is what she was actually charged.
for (const p of seenInApp.products ?? []) {
  if (!p.name || typeof p.price !== "number") die(`seen-in-app: "${p.name}" needs a name and a numeric price`);
  if (pricebook[p.name]) continue;
  pricebook[p.name] = { unit: p.unit ?? "unit", price: p.price, source: "app" };
}

/* ---- validate ----------------------------------------------------------- */
// A dish naming a product the pricebook has never seen would render a silent
// zero-cost line. Guesses are exempt, but must carry their own estimate.
const problems = [];
for (const [slug, r] of Object.entries(recipes)) {
  for (const f of ["title", "cuisine", "protein", "slot", "prepMinutes", "cookMinutes", "serves", "short", "steps"]) {
    if (r[f] == null) problems.push(`${slug}: missing "${f}"`);
  }
  if (r.kind && !["recipe", "assembly"].includes(r.kind)) problems.push(`${slug}: unknown kind "${r.kind}"`);
  if (r.protein != null && !PROTEINS.includes(r.protein)) {
    problems.push(`${slug}: unknown protein "${r.protein}" — one of ${PROTEINS.join(", ")}`);
  }
  // The easy copy-paste error this field invites, and the one the tags can catch.
  if ((r.tags ?? []).includes("vegetarian") && !["eggs", "vegetarian"].includes(r.protein)) {
    problems.push(`${slug}: tagged vegetarian but its protein is "${r.protein}"`);
  }
  // No chilli is a health rule, not a tag someone remembers to add. Every dish
  // carries it by hand today and nothing enforced it until now.
  if (!(r.tags ?? []).includes("no chilli")) problems.push(`${slug}: missing the "no chilli" tag`);
  // "no cook" has to mean what it says, or the Recipes tab's appliance chips lie.
  if ((r.tags ?? []).includes("no cook") && r.cookMinutes !== 0) {
    problems.push(`${slug}: tagged "no cook" but cooks for ${r.cookMinutes} minutes`);
  }
  for (const e of r.equipment ?? []) {
    if (!APPLIANCES.has(e)) problems.push(`${slug}: "${e}" is not in preferences.cooking.equipment`);
    if (r.cookMinutes === 0 && HEAT.has(e)) {
      problems.push(`${slug}: cooks for 0 minutes but wants the ${e}`);
    }
  }
  if (r.kind === "assembly" && !r.packNote) {
    problems.push(`${slug}: an assembly needs a packNote saying what comes ready-made`);
  }
  for (const i of r.ingredients ?? []) {
    if (!i.buy) continue;
    if (i.guess) {
      if (typeof i.buy.price !== "number") problems.push(`${slug}: guessed "${i.product}" needs buy.price`);
    } else if (!pricebook[i.product]) {
      problems.push(`${slug}: "${i.product}" is not in the pricebook — check the exact Intermarché name`);
    }
    if (!["sum", "once"].includes(i.buy.mode)) problems.push(`${slug}: "${i.product}" needs buy.mode "sum" or "once"`);
    if (!i.buy.section) problems.push(`${slug}: "${i.product}" needs buy.section`);
  }
}

// An equivalence quietly drops a line off the shopping list, so a typo in a
// product name here is expensive: it either matches nothing, or it matches the
// wrong thing. Both are build failures rather than a surprise at the Drive.
const seenInGroup = new Map();
for (const g of equivalents.groups ?? []) {
  if (!g.id) problems.push(`equivalents: a group has no id`);
  if (!g.members?.length) problems.push(`equivalents ${g.id}: no members`);
  const units = new Set();
  for (const m of g.members ?? []) {
    if (!pricebook[m.name]) {
      problems.push(`equivalents ${g.id}: "${m.name}" is not in the pricebook — check the exact Intermarché name`);
      continue;
    }
    if (seenInGroup.has(m.name)) {
      problems.push(`equivalents ${g.id}: "${m.name}" is already in group "${seenInGroup.get(m.name)}"`);
    }
    seenInGroup.set(m.name, g.id);
    units.add(pricebook[m.name].unit);
  }
  // A tray cannot be counted against a recipe asking for kilos without knowing
  // what the tray weighs.
  if (units.has("kg")) {
    for (const m of g.members ?? []) {
      if (pricebook[m.name] && pricebook[m.name].unit !== "kg" && typeof m.kg !== "number") {
        problems.push(`equivalents ${g.id}: "${m.name}" is sold by the unit in a group priced by the kilo — give it a "kg" pack weight`);
      }
    }
  }
}

// A catalogue entry for a name nothing uses can never be shown, which means a
// typo that silently leaves the real product unlinked.
const usedNames = new Set(Object.keys(pricebook));
for (const r of Object.values(recipes)) for (const i of r.ingredients ?? []) if (i.buy) usedNames.add(i.product);
for (const s of prefs.staples?.alwaysInclude ?? []) usedNames.add(s.name);
for (const g of equivalents.groups ?? []) for (const m of g.members ?? []) usedNames.add(m.name);
const STATUSES = ["exact", "check", "picked", "missing"];
const checkListing = (where, l) => {
  if (!l.brand || !l.title) problems.push(`${where}: a listing needs a brand and a title`);
  if (!/^\/produit\//.test(l.url ?? "")) problems.push(`${where}: listing url must start with /produit/`);
  if (l.price != null && typeof l.price !== "number") problems.push(`${where}: listing price must be a number or null`);
};
for (const [name, c] of Object.entries(catalogue.products ?? {})) {
  const where = `catalogue "${name}"`;
  if (!usedNames.has(name)) problems.push(`${where}: no recipe, staple, equivalent or receipt uses this name`);
  if (!STATUSES.includes(c.status)) problems.push(`${where}: status must be one of ${STATUSES.join(", ")}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.checked ?? "")) problems.push(`${where}: needs a "checked" date`);
  if (c.status === "missing" ? c.listing : !c.listing) {
    problems.push(`${where}: ${c.status === "missing" ? "a missing product has no listing — put it in alternatives" : "needs a listing"}`);
  }
  if (c.listing) checkListing(where, c.listing);
  for (const a of c.alternatives ?? []) checkListing(where + " alternative", a);
}

const planDir = join(DATA, "plans");
let planFiles;
try { planFiles = readdirSync(planDir).filter((f) => f.endsWith(".json")).sort(); }
catch { die(`no ${planDir}. It is committed in this repo — check the clone is complete.`); }
if (!planFiles.length) die("no plans in data/plans/.");

const plans = planFiles.map((f) => read(join(planDir, f)));
for (const p of plans) {
  const seen = new Set();
  for (const m of p.meals) {
    if (!recipes[m.recipe]) problems.push(`plan ${p.weekOf}: no recipe "${m.recipe}"`);
    if (!m.id) problems.push(`plan ${p.weekOf}: a meal has no id — swaps are keyed on it`);
    if (seen.has(m.id)) problems.push(`plan ${p.weekOf}: duplicate meal id "${m.id}"`);
    seen.add(m.id);
  }
}

if (problems.length) {
  console.error(`build-week: ${problems.length} problem(s):`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}

/* ---- staples and config ------------------------------------------------- */
// Only what the page needs travels from preferences — not the store phone
// number, not the budget note. The dietary constraints DO ship, including the
// reason text, because the dish generator needs to know it is a health rule
// rather than a taste. That text is therefore in the published page.
// A staple normally has to be in the pricebook, so a typo cannot ship a
// zero-cost line. The exception is a product whose name the receipt truncated —
// the coffee capsules are cut off as "L'Or Capsules de café ..." — which can
// never match. Those carry their own price and are flagged as a guess, exactly
// like a guessed recipe ingredient, so the page says the name needs checking.
const staples = (prefs.staples?.alwaysInclude ?? []).map((s) => ({
  name: s.name,
  quantity: s.quantity ?? 1,
  note: s.note ?? "",
  price: pricebook[s.name]?.price ?? s.price ?? null,
  unit: pricebook[s.name]?.unit ?? "unit",
  guess: !pricebook[s.name],
}));
for (const s of staples) {
  if (s.price == null) {
    die(`standing staple "${s.name}" is not in the pricebook and has no "price" of its own.`);
  }
}

/* ---- what is already in the kitchen ------------------------------------- */
// The most recent receipt is the best available answer to "what do you already
// have", and it beats asking her. It is a starting point, not the truth: the
// page lets both of them correct every quantity, and those corrections live in
// the shared document rather than here.
//
// Deliberately week-scoped. Each new plan re-seeds from the newest receipt
// instead of carrying a running inventory forward, because an inventory nobody
// decrements silently under-orders, and under-ordering is the failure that ends
// with no dinner.
const lastOrder = history.orders[history.orders.length - 1];
const onHand = {
  // Order number and date only. Never the tracking or invoice-download URL from
  // the email — those carry access tokens and this repo is public.
  from: { order: lastOrder.orderNumber, date: lastOrder.date, store: lastOrder.store },
  items: lastOrder.items
    // Billed but never handed over, so it is not in the kitchen.
    .filter((i) => !i.unavailable && !i.truncated)
    .map((i) => ({ product: i.name, quantity: i.quantity, unit: i.unit })),
};

const config = {
  proteins: PROTEINS,
  budgetCeiling: prefs.budget?.ceilingPerOrder ?? 150,
  store: plans[plans.length - 1].store ?? "",
  // Handed to the dish generator so anything new honours the same rules.
  constraints: {
    banned: prefs.dietary?.excluded ?? [],
    bannedReason: prefs.dietary?.excludedReason ?? "",
    limited: prefs.dietary?.limited ?? [],
    limitedReason: prefs.dietary?.limitedReason ?? "",
    maxWeeknightMinutes: prefs.cooking?.maxWeeknightMinutes ?? 30,
  },
};

/* ---- emit --------------------------------------------------------------- */
const template = readFileSync(TEMPLATE, "utf8");
if (!template.includes("/*__DATA__*/")) die("template.html has lost its /*__DATA__*/ placeholder.");

// Each week is published as its own page, so the title carries the week or the
// gallery fills with identical names.
const latestPlan = plans[plans.length - 1];
const weekDate = new Date(latestPlan.weekOf + "T12:00:00Z")
  .toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
const titled = template.replace(/<title>[^<]*<\/title>/, `<title>Méré Basket, ${weekDate}</title>`);
if (titled === template) die("template.html has lost its <title>.");

const payload = {
  recipes, plans, pricebook, staples, config, onHand, equivalents: equivalents.groups ?? [],
  catalogue: catalogue.products ?? {}, site: catalogue.site ?? "https://www.intermarche.com",
};
// </script> inside the JSON would close the script tag early.
const json = JSON.stringify(payload).replace(/<\//g, "<\\/");
writeFileSync(OUT, titled.replace("/*__DATA__*/ null", json));

const latest = plans[plans.length - 1];
const dinners = Object.values(recipes).filter((r) => r.slot === "dinner").length;
console.log(`Built ${OUT}`);
const fromApp = Object.values(pricebook).filter((p) => p.source === "app").length;
console.log(`  ${Object.keys(recipes).length} dishes (${dinners} dinners), ${Object.keys(pricebook).length} priced products (${fromApp} confirmed in the app, the rest from receipts)`);
console.log(`  ${plans.length} week(s); latest: ${latest.label ?? latest.weekOf}, ${latest.meals.length} meals`);
console.log(`  ceiling ${config.budgetCeiling} EUR, ${staples.length} standing staples`);
const d = onHand.from.date;
console.log(`  on hand: ${onHand.items.length} items from order ${onHand.from.order} (${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")})`);
console.log(`  ${payload.equivalents.length} equivalence group(s)`);
const catEntries = Object.values(payload.catalogue);
const byStatus = Object.fromEntries(STATUSES.map((s) => [s, catEntries.filter((c) => c.status === s).length]));
const buyable = new Set([...Object.values(recipes).flatMap((r) => (r.ingredients ?? []).filter((i) => i.buy).map((i) => i.product)),
                         ...staples.map((s) => s.name)]);
const unchecked = [...buyable].filter((n) => !payload.catalogue[n]).length;
console.log(`  catalogue: ${catEntries.length} listings (${STATUSES.map((s) => `${byStatus[s]} ${s}`).join(", ")})` +
            (unchecked ? `; ${unchecked} buyable product(s) not checked on the site — npm run catalogue:queue` : ""));
