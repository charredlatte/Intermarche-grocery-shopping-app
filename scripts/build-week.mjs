#!/usr/bin/env node
/**
 * Pours the recipe library and every week's plan into artifact/template.html
 * and writes artifact/week.html, ready to publish.
 *
 *   data/recipes.json  +  data/plans/*.json  ->  artifact/week.html
 *
 * The page is data-driven so next week is a new plan file and a rebuild,
 * republished to the URL recorded in data/artifact-url.txt. Never a fresh
 * publish, or the bookmark on her phone stops pointing at the current week.
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE = join(ROOT, "artifact", "template.html");
const OUT = join(ROOT, "artifact", "week.html");

const die = (msg) => { console.error("build-week: " + msg); process.exit(1); };

const recipes = JSON.parse(readFileSync(join(ROOT, "data", "recipes.json"), "utf8"));

const planDir = join(ROOT, "data", "plans");
let planFiles;
try {
  planFiles = readdirSync(planDir).filter((f) => f.endsWith(".json")).sort();
} catch {
  die(`no ${planDir}. Clone the private data repo into data/ first.`);
}
if (!planFiles.length) die("no plans in data/plans/.");

const plans = planFiles.map((f) => JSON.parse(readFileSync(join(planDir, f), "utf8")));

// A plan naming a dish that isn't in the library renders an empty card, which is
// far harder to spot than a failed build. This is the mistake most likely to
// recur week to week, so it stops the build.
for (const p of plans) {
  for (const m of p.meals) {
    if (!recipes[m.recipe]) {
      die(`plan ${p.weekOf} refers to recipe "${m.recipe}", which is not in data/recipes.json.`);
    }
  }
  const sum = +p.shopping.reduce((a, b) => a + b.cost, 0).toFixed(2);
  if (p.estimatedTotal != null && Math.abs(sum - p.estimatedTotal) > 0.01) {
    die(`plan ${p.weekOf}: shopping lines sum to ${sum} but estimatedTotal says ${p.estimatedTotal}.`);
  }
}

const template = readFileSync(TEMPLATE, "utf8");
if (!template.includes("/*__DATA__*/")) die("template.html has lost its /*__DATA__*/ placeholder.");

// </script> inside the JSON would close the script tag early.
const json = JSON.stringify({ recipes, plans }).replace(/<\//g, "<\/");
const html = template.replace("/*__DATA__*/ null", json);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);

const latest = plans[plans.length - 1];
console.log(`Built ${OUT}`);
console.log(`  ${plans.length} week(s), ${Object.keys(recipes).length} dishes`);
console.log(`  latest: ${latest.label ?? latest.weekOf} — ${latest.meals.length} meals, ${latest.estimatedTotal} EUR`);
