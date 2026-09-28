// seed: {"library/recipe-edits": {"edits": {}, "futureField": {"x": 1}, "updatedAt": 1}}
/* A newer build may keep more in the edits document. A save from this one
   carries it through. */
await ready();
const slug = picks[aDinner()];
const row = recipeOf(slug).ingredients.find((i) => i.buy && i.buy.mode === "sum");
stepIngredient(slug, itemKey(row), 1);
await wait(1200);
const d = window.__server["library/recipe-edits"];
ok("her edit is saved", !!d.edits[slug]);
ok("another build's field survives", d.futureField && d.futureField.x === 1);
