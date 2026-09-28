/* From a basket line's Swap she typed "carottes rappees" — something no
   receipt names — and was told nothing matches. A name the page does not know
   is still something she can buy: instead of the line, or as well as it. The
   search ignores accents, and nothing hot comes in this way. */
await ready();
const line = basket().lines.find((l) => l.kind === "dish" && !l.pending && !l.choice);
const key = line.key;

ok("the search ignores accents", search("rapes", [], ALL_PRODUCTS).some((n) => /râpé/.test(n)) &&
   search("oeufs", [], ALL_PRODUCTS).length === search("œufs", [], ALL_PRODUCTS).length);

openProductSwap(key);
$("#sheet-search").value = "carottes rappees"; renderProductAlts();
ok("a name nothing knows can be bought instead", !!$('#sheet-alts [data-pick-product="carottes rappees"]'));
ok("or added as well", !!$('#sheet-alts [data-add-product="carottes rappees"]'));
ok("and what is close is still offered", $$("#sheet-alts [data-pick-product]").length > 1);

$('#sheet-alts [data-pick-product="carottes rappees"]').click();
await wait(window.__SNAP + 150);
const now = basket().lines.find((l) => l.key === key);
ok("the line now buys it, saying what it replaces", !!now && now.name === "carottes rappees" && now.renamed === key);
ok("unchecked at Méré, so Claude asks at push", !!now && !now.cat && now.guess);
ok("and it is saved", !!(stored() && stored().subs && stored().subs[key] === "carottes rappees"));

openProductSwap(key);
$("#sheet-search").value = "Sauce piquante"; renderProductAlts();
ok("nothing hot is offered to type in", !$('#sheet-alts [data-pick-product="Sauce piquante"]') && /Not added/.test($("#gen-state").textContent));
$("#sheet").close();

openProductSwap(key);
$("#sheet-search").value = "carottes rappees"; renderProductAlts();
$('#sheet-alts [data-add-product="carottes rappees"]').click();
ok("added as well, it goes on the household & extras list", !!added["added:carottes rappees"]);
$("#sheet").close();
