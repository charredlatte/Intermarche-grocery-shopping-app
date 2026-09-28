// seed: {"library/recipe-edits": {"edits": {"a-dish-she-edited": {"add": [], "set": {}, "drop": ["onion"], "swap": {}}, "another": {"add": [], "set": {"rice": 2}, "drop": [], "swap": {}}}, "updatedAt": 1}}
// snap: 2500
/* Her ingredient edits outlive the week. An edit made before the stored edits
   have arrived must not replace them all with that one edit. */
for (let i = 0; i < 400 && !editsRef; i++) await wait(10);
const slug = picks[aDinner()];
const row = recipeOf(slug).ingredients.find((i) => i.buy && i.buy.mode === "sum");
stepIngredient(slug, itemKey(row), 1);
await wait(5000);
const e = (window.__server["library/recipe-edits"] || {}).edits || {};
ok("her earlier edits to other dishes survive an early tap", !!e["a-dish-she-edited"] && !!e["another"], Object.keys(e).join(", "));
