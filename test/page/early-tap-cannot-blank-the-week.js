// seed: {"weeks/$WEEK": {"picks": {}, "qtyAdj": {"Montorsi Mortadelle": 2}, "choices": {"Herta Lardons nature": {"pick": "skip", "at": 1}}, "updatedAt": 1}}
// snap: 2500
/* A slow phone: she taps before her stored week has arrived. Until 28
   September that save replaced the whole stored week with the build's blank
   defaults — every count, decision and approval. */
for (let i = 0; i < 400 && !weekRef; i++) await wait(10);
const id = aDinner();
setPick(id, otherDish(id));
await wait(5000);
ok("her stored count survives an early tap", stored().qtyAdj && stored().qtyAdj["Montorsi Mortadelle"] === 2, JSON.stringify(stored().qtyAdj));
ok("her stored decision survives it", stored().choices && !!stored().choices["Herta Lardons nature"]);
