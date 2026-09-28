/* Editing a dish in the page is changing the recipe. Do it after approving and
   the approved list must say so, like any other change to the week. */
await ready();
approveAll();
const slug = picks[aDinner()];
const row = recipeOf(slug).ingredients.find((i) => i.buy && i.buy.mode === "sum");
stepIngredient(slug, itemKey(row), 1);
ok("more of an ingredient is flagged", /since you approved/i.test(shopText()) && shopText().includes(row.product), row.product);
ok("traced to the edited dish", shopText().includes("(edited)"));
undoDish(slug);
ok("undoing the edit clears it", !/since you approved/i.test(shopText()));
dropIngredient(slug, itemKey(row));
ok("taking an ingredient out is flagged as no longer needed", /no longer needed/.test(shopText()));
