#!/usr/bin/env node
/**
 * Pulls the published page back into the repo, the opposite direction to
 * build-week.mjs.
 *
 *   node scripts/sync-artifact.mjs [--check] <live.html>
 *
 * The artifact is private, so nothing here can fetch it: read it with the
 * Artifact tool (action "read"), which saves the HTML to a local file, and hand
 * that file to this script.
 *
 * Why this exists: the live page can be rebuilt or republished from outside any
 * session, and once it has been, template.html no longer describes what is
 * published. That already happened — the shopping-section icons existed only in
 * the published HTML, and the next build would have republished over them
 * without a word. So before every republish, --check; on drift, recover.
 *
 * Recovery reverses the injection build-week.mjs performs and then PROVES it by
 * rebuilding and comparing byte for byte. A template that does not reproduce the
 * live page is worse than no template, because the next build ships it.
 *
 * Exit codes: 0 in sync, 1 drift (recovered, or reported under --check),
 * 2 drift that could not be round-tripped — nothing written.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE = join(ROOT, "artifact", "template.html");
const WEEK = join(ROOT, "artifact", "week.html");
const BUILD = join(ROOT, "scripts", "build-week.mjs");

const die = (msg) => { console.error("sync-artifact: " + msg); process.exit(2); };

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const input = args.filter((a) => a !== "--check")[0];
if (!input) {
  die("usage: node scripts/sync-artifact.mjs [--check] <live.html>\n" +
      "  <live.html> is the file the Artifact tool's read action saved.");
}

let live;
try { live = readFileSync(input, "utf8"); }
catch (e) { die(`could not read ${input} — ${e.message}`); }

/* ---- unwrap ------------------------------------------------------------- */
// Publishing wraps the page in a skeleton: <!doctype html><html><head>…</head>
// <body> + our HTML + </body></html>. Strip exactly that and nothing else.
const open = live.indexOf("<body>");
const close = live.lastIndexOf("</body>");
if (open === -1 || close === -1 || close < open) {
  die(`${input} has no <body>…</body> — that is not a published artifact.`);
}
let page = live.slice(open + "<body>".length, close);
if (page.startsWith("\n")) page = page.slice(1);   // the newline the skeleton adds

/* ---- compare ------------------------------------------------------------ */
const weekBefore = readFileSync(WEEK, "utf8");
const templateBefore = readFileSync(TEMPLATE, "utf8");
const same = (a, b) => a.replace(/\s+$/, "") === b.replace(/\s+$/, "");

if (same(page, weekBefore)) {
  console.log("in sync — the published page is the one in artifact/week.html");
  process.exit(0);
}

const liveLines = page.split("\n");
const weekLines = weekBefore.split("\n");
const firstDiff = liveLines.findIndex((l, i) => l !== weekLines[i]) + 1;
console.log(`The published page differs from artifact/week.html.`);
console.log(`  first difference at line ${firstDiff}; ${liveLines.length} lines live, ${weekLines.length} committed`);

if (checkOnly) {
  console.error("Someone changed the live page outside this repo. Recover it before");
  console.error("republishing, or the next build overwrites their work:");
  console.error(`  npm run sync:artifact -- ${input}`);
  process.exit(1);
}

/* ---- reverse the injection ---------------------------------------------- */
// build-week.mjs replaces the literal `/*__DATA__*/ null` with one line of JSON.
// Putting the placeholder back is what turns a built page into its template.
const dataAt = liveLines.findIndex((l) => l.startsWith("const DATA = "));
if (dataAt === -1) die("the live page has no `const DATA = ` line — it was not built from this template.");
if (!liveLines[dataAt].endsWith(";")) die(`line ${dataAt + 1} does not end the DATA assignment — the payload is not on one line.`);
const liveData = liveLines[dataAt].slice("const DATA = ".length, -1);

const rebuiltTemplate = liveLines.slice();
rebuiltTemplate[dataAt] = "const DATA = /*__DATA__*/ null;";
const template = rebuiltTemplate.join("\n");
if (!template.includes("/*__DATA__*/ null")) die("lost the placeholder while rebuilding the template.");

writeFileSync(TEMPLATE, template);
writeFileSync(WEEK, page);

/* ---- prove the round trip ----------------------------------------------- */
const restore = () => { writeFileSync(TEMPLATE, templateBefore); writeFileSync(WEEK, weekBefore); };
try { execFileSync(process.execPath, [BUILD], { stdio: "pipe" }); }
catch (e) {
  restore();
  console.error("sync-artifact: the recovered template does not build:");
  console.error(String(e.stderr ?? e.message).trim());
  process.exit(2);
}

const rebuilt = readFileSync(WEEK, "utf8");
if (!same(rebuilt, page)) {
  const rebuiltLines = rebuilt.split("\n");
  const at = rebuiltLines.findIndex((l, i) => l !== liveLines[i]);
  restore();
  console.error("sync-artifact: a rebuild does not reproduce the live page. Nothing written.");
  if (at === dataAt) {
    const dump = input + ".data.json";
    writeFileSync(dump, liveData);
    console.error("The difference is the injected data, not the template: the live page carries");
    console.error("recipes or a plan this repo does not have. Bring data/ up to date first —");
    console.error(`what the live page holds is in ${dump}.`);
  } else {
    console.error(`  first difference at line ${at + 1}:`);
    console.error(`    live:    ${(liveLines[at] ?? "").trim().slice(0, 100)}`);
    console.error(`    rebuilt: ${(rebuiltLines[at] ?? "").trim().slice(0, 100)}`);
  }
  process.exit(2);
}

console.log("Recovered into artifact/template.html and artifact/week.html.");
console.log("A rebuild reproduces the live page byte for byte. Commit both, and do not");
console.log("republish — the live page already has this.");
process.exit(1);
