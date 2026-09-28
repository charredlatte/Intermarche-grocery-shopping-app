// seed: {"weeks/$WEEK": {"picks": {}, "builtAt": 99999999999999, "updatedAt": 5}}
/* The store says a build with a later clock wrote it, but this is the page she
   just opened, so it is the published one. It must save — reloading has to be
   a way out, never a way in. */
await ready();
ok("a fresh load is never treated as replaced", !superseded);
const n = window.__writes.length, id = aDinner();
setPick(id, otherDish(id));
await wait(1200);
ok("so it saves", window.__writes.length > n);
ok("stamped with its own build", stored().builtAt === BUILT);
