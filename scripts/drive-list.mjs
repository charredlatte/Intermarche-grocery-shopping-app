#!/usr/bin/env node
/**
 * Turns a push request from the page into the work list for filling the Drive
 * basket.
 *
 *   npm run drive:list -- <push doc>.json [<progress dir>]          # readable
 *   npm run drive:list -- <push doc>.json [<progress dir>] --json   # for the session
 *
 * The push doc is push/<weekOf> in the week's page database, and the progress
 * dir holds push/<weekOf>/progress — both saved with the Artifact tool
 * (action read_db, out_dir). Pressing "Push to Intermarché" writes the doc;
 * every line in it is already approved and resolved to one Méré listing and a
 * count, so nothing here decides what to buy.
 *
 * Progress is append-only: each report is a NEW document (the Artifact tool
 * cannot edit an existing one), named <run>-<seq> where run is the request's
 * requestedAt. This prints the ids to use next, and leaves out lines a report
 * already settled, so a push that stopped halfway resumes where it left off.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const batchAt = args.indexOf("--batch");
const tabId = batchAt >= 0 ? Number(args[batchAt + 1]) : null;
const sizeArg = args.find((a) => a.startsWith("--size="));
const [file, progressDir] = args.filter((a, i) => !a.startsWith("--") && !(batchAt >= 0 && i === batchAt + 1));
if (batchAt >= 0 && !Number.isFinite(tabId)) {
  console.error("drive-list: --batch needs the Chrome tab id, e.g. --batch 2126834440");
  process.exit(1);
}
if (!file) {
  console.error("drive-list: pass the saved push/<weekOf> document, and optionally the saved progress folder");
  process.exit(1);
}

const unwrap = (p) => { const raw = JSON.parse(readFileSync(p, "utf8")); return raw.data ?? raw; };
const doc = unwrap(file);
if (!Array.isArray(doc.lines) || !doc.lines.length || !doc.requestedAt) {
  console.error("drive-list: this is not a push request. Charlotte approves on the page, then presses Push to Intermarché.");
  process.exit(2);
}
const run = doc.requestedAt;

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : f.endsWith(".json") ? [p] : [];
});
const reports = progressDir ? walk(progressDir).map(unwrap).filter((r) => r.run === run) : [];
reports.sort((a, b) => (a.at || 0) - (b.at || 0));
const settled = {};
let status = doc.status;
for (const r of reports) {
  if (r.type === "line" && r.key) settled[r.key] = r;
  if (r.type === "status") status = r.status;
}
const SETTLED = ["added", "already", "unavailable", "skipped", "mismatch", "not-found"];

const catalogue = JSON.parse(readFileSync(join(ROOT, "data", "catalogue.json"), "utf8"));
const SITE = catalogue.site ?? "https://www.intermarche.com";

const ready = [], lookup = [], done = [];
for (const l of doc.lines) {
  const c = catalogue.products[l.name] ?? null;
  const item = {
    key: l.key, name: l.name, add: l.add, estimate: l.cost, price: l.price ?? null, status: l.status,
    url: l.url ? SITE + l.url : null, expect: l.expect ?? null, search: l.search ?? c?.search ?? l.name,
    outOfStockWhenChecked: c?.listing?.available === false && l.status !== "chosen" ? c.checked : null,
  };
  const r = settled[l.key];
  if (r && SETTLED.includes(r.status)) done.push({ ...item, report: r });
  else if (item.url) ready.push(item);
  else lookup.push(item);
}

const seq = reports.length + 1;
const idFor = (n) => `${run}-${String(n).padStart(3, "0")}`;
const collection = `push/${doc.weekOf}/progress`;
const eur = (n) => (n ?? 0).toFixed(2).replace(".", ",") + " €";

if (batchAt >= 0) {
  // Ready-made browser_batch actions: open the product page, then run the
  // in-page helper on it. A few products per batch keeps the pace human and
  // lets progress be reported between batches.
  const size = sizeArg ? Math.max(1, Number(sizeArg.split("=")[1])) : 5;
  // The file's header comment is for people; each call carries only the function.
  const source = readFileSync(join(ROOT, "scripts", "drive-helper.js"), "utf8");
  const helper = source.slice(source.indexOf("async function driveProduct"));
  const call = (i) => `await (${helper})(${JSON.stringify({ url: i.url, expect: i.expect, add: i.add })})`;
  const batches = [];
  for (let k = 0; k < ready.length; k += size) {
    // The pause matters: opening product pages back to back got one redirected
    // to a search page instead (2026-09-14).
    batches.push(ready.slice(k, k + size).flatMap((i) => [
      { name: "navigate", input: { tabId, url: i.url } },
      { name: "javascript_tool", input: { tabId, action: "javascript_exec", text: call(i) } },
      { name: "computer", input: { tabId, action: "wait", duration: 2 } },
    ]));
  }
  console.log(JSON.stringify({ run, collection, nextSeq: seq, keys: ready.map((i) => [i.key, i.add]), lookup: lookup.map((i) => i.key), batches }, null, 2));
} else if (args.includes("--json")) {
  console.log(JSON.stringify({ weekOf: doc.weekOf, run, status, collection, nextId: idFor(seq), nextSeq: seq,
    estimate: doc.estimate, ready, lookup, done }, null, 2));
} else {
  console.log(`Push for ${doc.weekOf}, run ${run}: ${status}; ${doc.lines.length} lines, estimate ${eur(doc.estimate)}`);
  console.log(`Reports go to ${collection}, next id ${idFor(seq)} (then ${idFor(seq + 1)}, …)`);
  if (lookup.length) {
    console.log(`\n## Look up and ask (${lookup.length})`);
    for (const i of lookup) console.log(`- ${i.name} ×${i.add} — search "${i.search}", then ask before adding`);
  }
  console.log(`\n## To add (${ready.length})`);
  for (const i of ready) {
    const e = i.expect;
    console.log(`- ×${i.add}  ${e.brand} · ${e.title}, ${e.packaging}${i.price != null ? `, ${eur(i.price)}` : ""}${i.outOfStockWhenChecked ? `  (was out of stock ${i.outOfStockWhenChecked})` : ""}`);
    console.log(`    ${i.url}\n    key: ${i.key}`);
  }
  if (done.length) {
    console.log(`\n## Already settled in this push (${done.length})`);
    for (const i of done) console.log(`- ${i.name}: ${i.report.status}${i.report.qty != null ? " ×" + i.report.qty : ""}`);
  }
}
