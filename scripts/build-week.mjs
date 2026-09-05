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

const planDir = join(DATA, "plans");
let planFiles;
try { planFiles = readdirSync(planDir).filter((f) => f.endsWith(".json")).sort(); }
catch { die(`no ${planDir}. Clone the private data repo into data/ first.`); }
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
// Only what the page needs travels from preferences; the store address and the
// full dietary notes stay out of the published HTML.
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

const payload = { recipes, plans, pricebook, staples, config };
// </script> inside the JSON would close the script tag early.
const json = JSON.stringify(payload).replace(/<\//g, "<\\/");
writeFileSync(OUT, template.replace("/*__DATA__*/ null", json));

const latest = plans[plans.length - 1];
const dinners = Object.values(recipes).filter((r) => r.slot === "dinner").length;
console.log(`Built ${OUT}`);
console.log(`  ${Object.keys(recipes).length} dishes (${dinners} dinners), ${Object.keys(pricebook).length} priced products`);
console.log(`  ${plans.length} week(s); latest: ${latest.label ?? latest.weekOf}, ${latest.meals.length} meals`);
console.log(`  ceiling ${config.budgetCeiling} EUR, ${staples.length} standing staples`);
