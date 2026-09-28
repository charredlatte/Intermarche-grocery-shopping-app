/* Two of the app's hard rules, enforced in the page by other work: no chilli
   can be added to a dish, and Approve stays locked until every line is
   decided. Pinned here so a change elsewhere cannot quietly undo either. */
await ready();
const slug = picks[aDinner()];
const n = recipeOf(slug).ingredients.length;
for (const hot of ["Sauce sriracha", "Piment d'Espelette", "Chorizo doux", "Paprika fort"]) {
  const refused = addIngredient(slug, hot);
  ok(`"${hot}" is refused`, !!refused && recipeOf(slug).ingredients.length === n, refused || "accepted");
}
ok("sweet paprika is not", addIngredient(slug, "Bouton d’Or, une marque Intermarché Paprika doux moulu") === null);
undoDish(slug);

const pending = basket().pending.length;
if (!pending) info("nothing waits on a decision this week — the lock is not exercised");
else {
  approveList();
  ok("Approve does nothing while a line waits on her", approved === null, pending + " pending");
}
