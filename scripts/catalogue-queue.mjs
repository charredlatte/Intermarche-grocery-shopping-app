#!/usr/bin/env node
/**
 * Lists every product the app can put in a basket that data/catalogue.json has
 * not yet matched to a listing on Méré's Drive site, or matched too long ago.
 * This week's plan comes first, then the standing order, then the rest of the
 * recipe library, then equivalents.
 *
 *   npm run catalogue:queue            # human-readable
 *   npm run catalogue:queue -- --json  # for a browsing session to work through
 *   npm run catalogue:queue -- --all   # include products already checked
 *
 * The search term it suggests is only a starting point. Intermarché's search
 * ranks rather than matches: a full house-brand name ("Jean Rozé, une marque
 * Intermarché …") floods the results with every house-brand product, so the
 * brand is dropped and the title searched instead.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const read = (p, fallback) => {
  try { return JSON.parse(readFileSync(p, "utf8")); }
  catch (e) { if (fallback !== undefined) return fallback; throw e; }
};

const STALE_DAYS = 28;
const args = new Set(process.argv.slice(2));

const recipes = read(join(DATA, "recipes.json"));
const history = read(join(DATA, "purchase-history.json"));
const prefs = read(join(DATA, "preferences.json"));
const equivalents = read(join(DATA, "equivalents.json"), { groups: [] });
const catalogue = read(join(DATA, "catalogue.json"), { products: {} });

const planFiles = readdirSync(join(DATA, "plans")).filter((f) => f.endsWith(".json")).sort();
const plan = read(join(DATA, "plans", planFiles[planFiles.length - 1]));
const inWeek = new Set();
for (const m of plan.meals) {
  if (m.leftovers) continue;
  for (const i of recipes[m.recipe]?.ingredients ?? []) if (i.buy) inWeek.add(i.product);
}

const wanted = new Map();
const want = (name, priority, extra) => {
  const w = wanted.get(name) ?? { name, priority, usedBy: new Set(), guess: false };
  w.priority = Math.min(w.priority, priority);
  if (extra.usedBy) w.usedBy.add(extra.usedBy);
  if (extra.guess) w.guess = true;
  wanted.set(name, w);
};
for (const s of prefs.staples?.alwaysInclude ?? []) want(s.name, 1, { usedBy: "standing order", guess: s.guess });
for (const [slug, r] of Object.entries(recipes)) {
  for (const i of r.ingredients ?? []) {
    if (!i.buy) continue;
    want(i.product, inWeek.has(i.product) ? 0 : 2, { usedBy: slug, guess: i.guess });
  }
}
for (const g of equivalents.groups ?? []) {
  for (const m of g.members ?? []) want(m.name, 3, { usedBy: `equivalent: ${g.id}` });
}

const receipt = new Map(history.products.map((p) => [p.name, p]));
const HOUSE_BRAND = /^.*?, une marque Intermarché\s+/;
const PRODUCE_BRAND = /^Le Choix du Primeur\s+/;
const suggest = (name) => name.replace(HOUSE_BRAND, "").replace(PRODUCE_BRAND, "").replace(/\s+—.*$/, "").trim();

const today = new Date();
const ageDays = (d) => (today - new Date(d)) / 864e5;

const queue = [];
for (const w of wanted.values()) {
  const entry = catalogue.products?.[w.name];
  if (entry && ageDays(entry.checked) <= STALE_DAYS && !args.has("--all")) continue;
  const r = receipt.get(w.name);
  queue.push({
    name: w.name,
    priority: w.priority,
    search: entry?.search ?? suggest(w.name),
    receiptPackaging: r?.packaging ?? null,
    receiptUnit: r?.unit ?? null,
    guess: w.guess && !r,
    checked: entry?.checked ?? null,
    status: entry?.status ?? null,
    usedBy: [...w.usedBy],
  });
}
queue.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

if (args.has("--json")) {
  console.log(JSON.stringify(queue, null, 2));
} else {
  const label = ["this week", "standing order", "recipe library", "equivalents only"];
  console.log(`${queue.length} of ${wanted.size} products need a catalogue check (plan ${plan.weekOf}, stale after ${STALE_DAYS} days)`);
  let last = -1;
  for (const q of queue) {
    if (q.priority !== last) { console.log(`\n## ${label[q.priority]}`); last = q.priority; }
    const tail = [q.guess ? "guess" : q.receiptPackaging, q.status && `was ${q.status} on ${q.checked}`].filter(Boolean).join(" · ");
    console.log(`- ${q.name}  →  search "${q.search}"${tail ? `  (${tail})` : ""}`);
  }
}
