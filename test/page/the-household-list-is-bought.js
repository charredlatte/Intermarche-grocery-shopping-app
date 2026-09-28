/* Things for the house — drain cleaner, bin bags — are added on the Household
   tab, saved in the week's document with everything else, and bought: each is
   a basket line traced to her household list, a name nobody has priced goes to
   Claude to look up at the push, and nothing hot gets in this way either. */
await ready();
const before = basket().total;
ok("the picker offers house things she has bought before", HOUSE_PRODUCTS.length > 0 && HOUSE_PRODUCTS.every((n) => !!PRICES[n]), HOUSE_PRODUCTS.length);

ok("a typed name goes on the list", addProduct("Déboucheur canalisations") === null);
const bought = HOUSE_PRODUCTS[0];
addProduct(bought);
await wait(window.__SNAP + 200);
const lines = basket().lines;
const typed = lines.find((l) => l.name === "Déboucheur canalisations");
ok("it is a basket line under the household section", !!typed && typed.section === HOUSEHOLD && typed.for === "your household list");
ok("with no listing, so Claude looks it up during the push", !!typed && !typed.cat && typed.guess);
ok("the total moves", basket().total > before);
ok("the list is saved in the week's document", !!(stored() && stored().added && stored().added["added:Déboucheur canalisations"]));

renderAll();
const home = $("#home-out").textContent;
ok("the Household tab shows both", home.includes("Déboucheur canalisations") && home.includes(bought));

stepHousehold("added:Déboucheur canalisations", 1);
ok("+ makes it two", basket().lines.find((l) => l.name === "Déboucheur canalisations").toBuy === 2);

for (const hot of ["Sauce piquante", "Harissa"]) {
  const n = Object.keys(added).length;
  ok(`"${hot}" is refused here too`, !!addProduct(hot) && Object.keys(added).length === n);
}

toggleStrike("added:Déboucheur canalisations");
ok("✕ takes it off the list and out of the basket", !added["added:Déboucheur canalisations"] &&
   !basket().lines.some((l) => l.name === "Déboucheur canalisations"));
