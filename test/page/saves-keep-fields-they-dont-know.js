// seed: {"weeks/$WEEK": {"picks": {}, "mealDone": {"x": "cooked"}, "futureField": {"x": 1}, "updatedAt": 1}}
/* Another build of the page — the Week-tab rework, open on the other phone —
   keeps state this build has never heard of. A save from this build must carry
   it through, not erase it. */
await ready();
const id = aDinner();
setPick(id, otherDish(id));
await wait(1200);
ok("the swap is saved", stored().picks[id] === picks[id]);
ok("another build's field survives the save", stored().mealDone && stored().mealDone.x === "cooked");
ok("so does a field from a build not yet written", stored().futureField && stored().futureField.x === 1);
