/* She added a row to a dish; a later session made it permanent in
   recipes.json with the same `item`. Her edit and the library row must not
   both apply — that buys it twice. Modelled by giving her an added row whose
   item the library recipe already has. */
await ready();
const slug = picks[aDinner()];
const row = all()[slug].ingredients.find((i) => i.buy && i.buy.mode === "sum");
const before = weekWanted().find((w) => w.key === row.product).required;
recipeEdits[slug] = { ...emptyEdits(), add: [{ ...row, buy: { ...row.buy } }] };
renderAll();
const rows = recipeOf(slug).ingredients.filter((i) => itemKey(i) === itemKey(row));
ok("the dish has that row once", rows.length === 1, rows.length + " rows");
ok("and the basket needs no more of it", weekWanted().find((w) => w.key === row.product).required === before);
