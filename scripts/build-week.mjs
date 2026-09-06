#!/usr/bin/env node
/**
 * Pours the recipe library, every week's plan, and a pricebook derived from the
 * invoices into artifact/template.html, writing artifact/week.html.
 *
 *   data/recipes.json + data/plans/*.json + data/purchase-history.json
 *     -> artifact/week.html
 *
 * The page is data-driven so next week is a new plan file and a rebuild,
 * republished to the URL in data/artifact-url.txt. Never a fresh publish, or
 * the bookmark on her phone stops pointing at the current week.
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

/* ---- pricebook ---------------------------------------------------------- */
const pricebook = {};
for (const p of history.products) {
  if (p.nameTruncated || p.lastPrice == null) continue;   // a cut-off name is not searchable
  pricebook[p.name] = { unit: p.unit, price: p.lastPrice };
}

/* ---- validate ----------------------------------------------------------- */
// A dish naming a product the pricebook has never seen would render a silent
// zero-cost line. Guesses are exempt, but must carry their own estimate.
const problems = [];
for (const [slug, r] of Object.entries(recipes)) {
  for (const f of ["title", "cuisine", "slot", "prepMinutes", "cookMinutes", "serves", "short", "steps"]) {
    if (r[f] == null) problems.push(`${slug}: missing "${f}"`);
  }
  if (r.kind && !["recipe", "assembly"].includes(r.kind)) problems.push(`${slug}: unknown kind "${r.kind}"`);
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
const staples = (prefs.staples?.alwaysInclude ?? []).map((s) => ({
  name: s.name,
  quantity: s.quantity ?? 1,
  note: s.note ?? "",
  price: pricebook[s.name]?.price ?? null,
  unit: pricebook[s.name]?.unit ?? "unit",
}));
for (const s of staples) {
  if (s.price == null) die(`standing staple "${s.name}" is not in the pricebook.`);
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

const payload = { recipes, plans, pricebook, staples, config, onHand, equivalents: equivalents.groups ?? [] };
// </script> inside the JSON would close the script tag early.
const json = JSON.stringify(payload).replace(/<\//g, "<\\/");
writeFileSync(OUT, template.replace("/*__DATA__*/ null", json));

const latest = plans[plans.length - 1];
const dinners = Object.values(recipes).filter((r) => r.slot === "dinner").length;
console.log(`Built ${OUT}`);
console.log(`  ${Object.keys(recipes).length} dishes (${dinners} dinners), ${Object.keys(pricebook).length} priced products`);
console.log(`  ${plans.length} week(s); latest: ${latest.label ?? latest.weekOf}, ${latest.meals.length} meals`);
console.log(`  ceiling ${config.budgetCeiling} EUR, ${staples.length} standing staples`);
const d = onHand.from.date;
console.log(`  on hand: ${onHand.items.length} items from order ${onHand.from.order} (${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")})`);
console.log(`  ${payload.equivalents.length} equivalence group(s)`);
