/* She dropped a row from a dish; later the row was renamed in recipes.json.
   Her edit no longer matches anything, so it silently stopped applying — the
   thing she took out is back on the list. It must be said. */
await ready();
const slug = picks[aDinner()];
recipeEdits[slug] = { ...emptyEdits(), drop: ["a row renamed since"] };
renderAll();
ok("the basket says her edit no longer matches", /no longer matches the recipe/.test(shopText()));
ok("naming the dish and the row", shopText().includes(all()[slug].title) && shopText().includes("a row renamed since"));
recipeEdits[slug] = emptyEdits(); renderAll();
ok("and says nothing when every edit matches", !/no longer matches the recipe/.test(shopText()));
