/* Once the order has gone, a changed week is something to buy separately —
   not a list to reopen. */
await ready();
approveAll();
push = { weekOf: plan.weekOf, status: "done", requestedAt: 1, lines: approved.lines };
const id = aDinner();
setPick(id, otherDish(id));
ok("says the order has already gone", /already gone to Intermarch/.test(shopText()));
ok("does not ask her to reopen", !/Reopen the list to bring it up to date/.test(shopText()));
ok("the header says so too", /the week has changed since/i.test(document.querySelector("#tally").textContent));
