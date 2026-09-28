/* A tab left open across a republish: after it loaded, a newer build saved the
   week. It must stop saving, and tell her to reload. */
await ready();
ok("a normal load saves", !superseded);
window.__server["weeks/" + WEEK] = { ...(stored() || {}), builtAt: BUILT + 60000, newerThing: "keep", updatedAt: Date.now() + 1000 };
__emit("weeks/" + WEEK);
await wait(700);
const n = window.__writes.length, id = aDinner();
setPick(id, otherDish(id));
toggleFav(Object.keys(LIB)[0]);
await wait(1200);
ok("the replaced copy writes nothing", window.__writes.length === n, (window.__writes.length - n) + " writes");
ok("the newer build's state is untouched", stored().newerThing === "keep");
ok("and it says to reload", /reload/i.test(document.querySelector("#sync-text").textContent));
