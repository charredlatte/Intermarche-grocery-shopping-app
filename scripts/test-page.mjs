#!/usr/bin/env node
/**
 * Runs the built page end to end against a stub store, in headless Chromium.
 *
 *   npm run test:page            # builds, then every test/page/*.js
 *   npm run test:page -- leftovers
 *
 * Each scenario is one fresh page load. The stub stands in for the artifact
 * runtime's db: writes land after 20 ms, and every snapshot is delivered late
 * (250 ms unless a scenario says otherwise), because a late snapshot is what
 * broke the page's saving six times over. A scenario may open with
 *
 *   // seed: {"weeks/$WEEK": {...}}   the store before the page loads
 *   // snap: 2500                      snapshot delay, in ms
 *
 * where $WEEK is the newest plan's week. Scenarios name no meal or dish from a
 * particular week, so the suite outlives the plan it was written against.
 *
 * Chromium comes with cloud sessions at /opt/pw-browsers/chromium; elsewhere,
 * point CHROMIUM at one. Nothing is installed.
 */

import { readFileSync, readdirSync, writeFileSync, mkdtempSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = join(ROOT, "artifact", "week.html");
const DIR = join(ROOT, "test", "page");
const CHROMIUM = process.env.CHROMIUM || "/opt/pw-browsers/chromium";

if (!existsSync(CHROMIUM)) {
  console.error(`test-page: no Chromium at ${CHROMIUM} — set CHROMIUM to one.`);
  process.exit(2);
}
if (!existsSync(PAGE)) {
  console.error("test-page: no artifact/week.html — run npm run build:week first.");
  process.exit(2);
}

const plans = readdirSync(join(ROOT, "data", "plans")).filter((f) => f.endsWith(".json")).sort();
const WEEK = JSON.parse(readFileSync(join(ROOT, "data", "plans", plans[plans.length - 1]), "utf8")).weekOf;

const STUB = (seed, snap) => `
window.__errs=[];addEventListener("error",e=>window.__errs.push(String(e.message)+" @"+e.lineno));
window.__server=${JSON.stringify(seed)}; window.__listeners={}; window.__writes=[]; window.__SNAP=${snap};
const __copy=(v)=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
function __emit(path){const p=__copy(window.__server[path]);
  for(const fn of window.__listeners[path]||[]) setTimeout(()=>fn({exists:p!==undefined,data:()=>__copy(p)}),window.__SNAP);}
const __doc=(path)=>({
  set:(d)=>new Promise(res=>setTimeout(()=>{window.__writes.push({path,doc:__copy(d)});
      window.__server[path]=__copy(d);__emit(path);res();},20)),
  update:(d)=>__doc(path).set({...(window.__server[path]||{}),...d}),
  onSnapshot:(fn)=>{(window.__listeners[path]=window.__listeners[path]||[]).push(fn);const p=__copy(window.__server[path]);
      setTimeout(()=>fn({exists:p!==undefined,data:()=>__copy(p)}),window.__SNAP);},
});
window.claude={use:async(n)=>n==="db"?{doc:__doc,collection:()=>({onSnapshot:(fn)=>setTimeout(()=>fn({docs:[]}),window.__SNAP)})}:null};
`;

// Everything a scenario can use, on top of the page's own globals.
const PRELUDE = `
const R=[];const ok=(n,c,x)=>R.push((c?"PASS ":"FAIL ")+n+(x!==undefined?"  ["+x+"]":""));
const info=(t)=>R.push("INFO "+t);const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const ready=async()=>{for(let i=0;i<400&&!weekRef;i++)await wait(10);await wait(window.__SNAP+350);};
const WEEK=${JSON.stringify(WEEK)}, stored=()=>window.__server["weeks/"+WEEK];
const cooks=(m)=>!m.leftovers;
const aDinner=()=>plan.meals.find((m)=>m.slot==="dinner"&&cooks(m)).id;
const otherDish=(id)=>{const slot=plan.meals.find((m)=>m.id===id).slot;
  return Object.keys(all()).find((s)=>all()[s].slot===slot&&s!==picks[id]&&s!==baseline[id]);};
const shopText=()=>document.querySelector("#shop-out").textContent;
const approveAll=()=>{for(const l of basket().pending)chooseLine(l.key,"skip");approveList();};
`;

const only = process.argv[2];
const files = readdirSync(DIR).filter((f) => f.endsWith(".js") && (!only || f.includes(only))).sort();
const tmp = mkdtempSync(join(tmpdir(), "test-page-"));
const page = readFileSync(PAGE, "utf8");
if (page.split("<script>").length !== 2) { console.error("test-page: expected exactly one <script> in the page"); process.exit(2); }

let pass = 0, fail = 0;
for (const f of files) {
  const src = readFileSync(join(DIR, f), "utf8");
  const seedLine = src.match(/^\/\/ seed: (.+)$/m);
  const snapLine = src.match(/^\/\/ snap: (\d+)$/m);
  const seed = seedLine ? JSON.parse(seedLine[1].replaceAll("$WEEK", WEEK)) : {};
  const snap = snapLine ? Number(snapLine[1]) : 250;
  const html = page.replace("<script>", `<script>${STUB(seed, snap)}</script>\n<script>`).trimEnd() +
    `\n<pre id="testout"></pre><script>(function(){${PRELUDE}(async()=>{try{\n${src}\n` +
    `ok("no page errors",window.__errs.length===0,window.__errs.join(" | "));` +
    `}catch(e){R.push("FAIL threw: "+(e&&e.stack?e.stack.split("\\n").slice(0,3).join(" / "):e));}` +
    `document.querySelector("#testout").textContent="\\n"+R.join("\\n")+"\\n";})();})();</script>\n`;
  const file = join(tmp, f.replace(/\.js$/, ".html"));
  writeFileSync(file, html);
  const dom = execFileSync(CHROMIUM, ["--headless", "--disable-gpu", "--no-sandbox",
    "--virtual-time-budget=60000", "--dump-dom", "file://" + file], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const m = dom.match(/<pre id="testout">([\s\S]*?)<\/pre>/);
  const out = (m ? m[1] : "FAIL no output").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").trim();
  const p = (out.match(/^PASS/gm) || []).length, x = (out.match(/^FAIL/gm) || []).length;
  pass += p; fail += x;
  console.log(`${x ? "✗" : "✓"} ${basename(f, ".js")}  (${p} passed${x ? `, ${x} failed` : ""})`);
  for (const line of out.split("\n")) if (/^(FAIL|INFO)/.test(line) && (x || line.startsWith("INFO"))) console.log("    " + line);
}
console.log(`\n${pass} passed, ${fail} failed, week ${WEEK}`);
process.exit(fail ? 1 : 0);
