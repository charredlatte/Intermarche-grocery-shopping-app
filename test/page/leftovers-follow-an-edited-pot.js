/* Editing the dish that cooks the pot, rather than swapping it. Taking
   something out of it — a row dropped, cut down, or bought as another
   product — means the pot may not be there, so the leftovers meal is shopped
   for. Adding to the dish, or more of something, leaves the pot as it was. */
await ready();
const lm = plan.meals.find((m) => m.leftovers && m.from);
if (!lm) { info("this week's plan has no leftovers meal — nothing to check"); }
else {
  const src = picks[lm.from], title = all()[picks[lm.id]].title;
  const shops = () => weekWanted().some((w) => String(w.for).includes(title));
  const row = all()[src].ingredients.find((i) => i.buy && i.buy.amount > 0.2);
  const key = itemKey(row);

  stepIngredient(src, key, 1);
  ok("more of something in the source: still leftovers", !shops());
  undoDish(src);
  const extra = Object.keys(PRICES).find((n) => !hotWord(n) && !all()[src].ingredients.some((i) => i.product === n));
  addIngredient(src, extra);
  ok("something added to the source: still leftovers", !shops());
  undoDish(src);

  stepIngredient(src, key, -1);
  ok("a row cut down in the source: the leftovers meal is shopped for", shops());
  ok("and its card stops promising the pot", !meals().find((m) => m.id === lm.id).leftovers);
  undoDish(src);
  dropIngredient(src, key);
  ok("a row taken out of the source: shopped for", shops());
  undoDish(src);
  ok("undo the edits and it is leftovers again", !shops());

  /* The other side: she adds something to the leftovers dish itself. The pot
     covers what the dish already had, not what she put in on top. */
  const lslug = picks[lm.id];
  const mine = Object.keys(PRICES).find((n) => !hotWord(n) && !weekWanted().some((w) => w.key === n) &&
                                              !all()[lslug].ingredients.some((i) => i.product === n));
  addIngredient(lslug, mine);
  const w = weekWanted().find((x) => x.key === mine);
  ok("an ingredient she adds to the leftovers dish is bought", !!w, mine);
  ok("and only that — the rest still comes from the pot",
     weekWanted().filter((x) => String(x.for).includes(title)).length === 1);
  ok("it still counts as leftovers", meals().find((m) => m.id === lm.id).leftovers);
}
