/* Her Google Keep "Meal Planning" note, copied as text and pasted on the
   Household tab. Ticked items and the title are left out; a count is read;
   a name her receipts know exactly goes in as that product; one the basket
   already buys for a dish is left off and said so; anything else goes in as
   written, with products offered, never swapped in; nothing hot. */
await ready();
const dishLine = basket().lines.find((l) => l.kind === "dish" && search(l.name, [], Object.keys(PRICES)).length === 1);
const bought = HOUSE_PRODUCTS.find((n) => search(n, [], Object.keys(PRICES)).length === 1);
const note = [
  "Meal Planning",
  "☐ Drain cleaner",
  "☐ bin bags x2",
  "☑ Almond milk",
  "- [x] Something already bought",
  bought ? "☐ " + bought : "",
  dishLine ? "☐ " + dishLine.name : "",
  "☐ Harissa",
  "☐ paprika",
  "",
].join("\n");
const r = addFromKeep(note);
await wait(window.__SNAP + 200);

ok("a typed name goes in as written", !!added["added:Drain cleaner"] && added["added:Drain cleaner"].from === "keep");
ok("\"x2\" is read as two", !!added["added:bin bags"] && added["added:bin bags"].qty === 2);
ok("ticked items and the title are left out", !Object.values(added).some((a) => /almond|already bought|meal planning/i.test(a.name)), r.skipped);
if (bought) ok("a name her receipts know exactly is that product", r.matched.some((m) => m.product === bought) && !!added["added:" + bought]);
else info("no household product with a unique name — exact match not exercised");
if (dishLine) ok("what a dish already buys is left off, and said", r.covered.some((c) => c.name === dishLine.name) && !added["added:" + dishLine.name]);
else info("no dish line with a unique name — covered not exercised");
ok("harissa and plain paprika are refused", r.refused.length === 2 && !Object.values(added).some((a) => /harissa|^paprika$/i.test(a.name)));
ok("paprika is offered as doux", r.refused.some((x) => x.safe && /doux/i.test(x.safe)), r.refused.map((x) => x.safe).join(" | "));
ok("they reach the basket", basket().lines.some((l) => l.name === "Drain cleaner" && l.section === HOUSEHOLD));
ok("and the week's document", !!(stored() && stored().added && stored().added["added:Drain cleaner"]));

const again = addFromKeep(note);
ok("pasting the same note twice adds nothing twice", again.added.length === 0 && again.already.includes("Drain cleaner"));

renderAll();
ok("the Household tab offers products for a typed name", !!$('[data-homeuse="added:bin bags"]'));
const pick = $('[data-homeuse="added:bin bags"]').dataset.product;
useProduct("added:bin bags", pick);
ok("picking one replaces the typed name, keeping the count", !added["added:bin bags"] && added["added:" + pick].qty === 2 && added["added:" + pick].from === "keep");
