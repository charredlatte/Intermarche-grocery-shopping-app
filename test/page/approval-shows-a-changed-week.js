/* She approves; then the week changes — a swap, or a recipe edited in a
   republish. The approved list must say what no longer matches rather than
   push the old one in silence. */
await ready();
approveAll();
ok("approved", !!approved && approved.lines.length > 0);
ok("quiet straight after approving", !/since you approved/i.test(shopText()));

const id = aDinner();
setPick(id, otherDish(id));
ok("a swap after approving is flagged", /since you approved/i.test(shopText()));
ok("naming the dish behind it", shopText().includes(all()[picks[id]].title));
ok("and in the header, on every tab", /changed since you approved/i.test(document.querySelector("#tally").textContent));
setPick(id, baseline[id]);
ok("undo the swap and the notice goes", !/since you approved/i.test(shopText()));

const dish = LIB[baseline[id]];
dish.ingredients.push({ item: "test", qty: "1", product: "Test Produit Ajouté", guess: true,
                        buy: { amount: 1, mode: "once", section: "Best guesses", price: 4 } });
renderAll();
ok("an ingredient added to a recipe is flagged, by name", shopText().includes("Test Produit Ajouté"));
dish.ingredients.pop();
const at = dish.ingredients.findIndex((i) => i.buy && i.buy.mode === "sum");
const [gone] = dish.ingredients.splice(at, 1);
renderAll();
ok("an ingredient taken out is flagged as no longer needed", /no longer needed/.test(shopText()) && shopText().includes(gone.product), gone.product);
dish.ingredients.splice(at, 0, gone);
renderAll();
ok("and all quiet once the recipe is as it was", !/since you approved/i.test(shopText()));
