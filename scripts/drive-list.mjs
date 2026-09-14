#!/usr/bin/env node
/**
 * Turns the list Charlotte approved on the page into the work list for filling
 * the Drive basket: every line joined to its Méré listing from
 * data/catalogue.json, and split into what can go straight in and what needs
 * her answer first.
 *
 *   npm run drive:list -- <week document>.json          # readable
 *   npm run drive:list -- <week document>.json --json   # for the browsing session
 *
 * The week document is weeks/<weekOf> from the page's shared database, saved to
 * a file with the Artifact tool (action read_db, db_op get, out_dir). Only an
 * approved list has lines; an unapproved week is refused rather than guessed at.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("drive-list: pass the saved weeks/<weekOf> document, e.g. npm run drive:list -- weeks/2026-09-14.json");
  process.exit(1);
}

const raw = JSON.parse(readFileSync(file, "utf8"));
const doc = raw.data ?? raw;
const catalogue = JSON.parse(readFileSync(join(ROOT, "data", "catalogue.json"), "utf8"));
const SITE = catalogue.site ?? "https://www.intermarche.com";

if (!doc.approved) {
  console.error("drive-list: this week has not been approved on the page. The basket is filled from an approved list only.");
  process.exit(2);
}
if (!Array.isArray(doc.approved.lines)) {
  console.error("drive-list: this approval predates saved lines. Ask Charlotte to press Reopen, then Approve again.");
  process.exit(2);
}

const inBasket = doc.inBasket ?? {};
const ready = [], ask = [], done = [];
for (const l of doc.approved.lines) {
  const c = catalogue.products[l.name] ?? null;
  const item = {
    key: l.key,
    name: l.name,
    add: l.add,
    estimate: l.cost,
    status: c ? c.status : "unchecked",
    url: c?.listing ? SITE + c.listing.url : null,
    expect: c?.listing ? { brand: c.listing.brand, title: c.listing.title, packaging: c.listing.packaging } : null,
    search: c?.search ?? l.name,
    outOfStockWhenChecked: c?.listing?.available === false ? c.checked : null,
    note: c?.note ?? null,
    alternatives: (c?.alternatives ?? []).map((a) => ({ ...a, url: SITE + a.url })),
  };
  if (inBasket[l.key]) done.push(item);
  else if (item.status === "exact" || item.status === "picked") ready.push(item);
  else ask.push(item);
}

const total = doc.approved.lines.reduce((t, l) => t + (l.cost ?? 0), 0);
if (args.includes("--json")) {
  console.log(JSON.stringify({ approvedAt: new Date(doc.approved.at).toISOString(), estimate: +total.toFixed(2), ask, ready, done }, null, 2));
} else {
  const eur = (n) => (n ?? 0).toFixed(2).replace(".", ",") + " €";
  console.log(`Approved ${new Date(doc.approved.at).toLocaleString("en-GB")}: ${doc.approved.lines.length} lines, estimate ${eur(total)}`);
  console.log(`\n## Ask Charlotte first (${ask.length})`);
  for (const i of ask) {
    console.log(`- ${i.name} ×${i.add} [${i.status}]${i.note ? " — " + i.note : ""}`);
    if (i.url) console.log(`    listed: ${i.expect.brand} · ${i.expect.title}, ${i.expect.packaging}  ${i.url}`);
    for (const a of i.alternatives) console.log(`    or: ${a.brand} · ${a.title}, ${a.packaging}${a.price != null ? ", " + eur(a.price) : ""}  ${a.url}`);
  }
  console.log(`\n## Ready to add (${ready.length})`);
  for (const i of ready) {
    console.log(`- ×${i.add}  ${i.expect ? `${i.expect.brand} · ${i.expect.title}, ${i.expect.packaging}` : i.name}${i.outOfStockWhenChecked ? `  (was out of stock ${i.outOfStockWhenChecked})` : ""}`);
    console.log(`    ${i.url ?? "search: " + i.search}`);
  }
  if (done.length) console.log(`\n## Already ticked on the page (${done.length})\n` + done.map((i) => `- ${i.name}`).join("\n"));
}
