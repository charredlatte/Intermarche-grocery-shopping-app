/* A swap stored on the page points at a dish since deleted from the library.
   The meal must stay on the week — on its planned dish — and the page must say
   so, not drop it and its shopping without a word. */
await ready();
const id = aDinner(), before = meals().length;
applyRemote({ ...stored(), picks: { [id]: "a-dish-nobody-has" }, updatedAt: Date.now() });
ok("the meal is still on the week", meals().length === before, meals().length + " of " + before);
ok("back on its planned dish", picks[id] === baseline[id]);
ok("and the basket says which", /a-dish-nobody-has/.test(shopText()));
