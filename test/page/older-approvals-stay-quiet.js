// seed: {"weeks/$WEEK": {"picks": {}, "approved": {"at": 1, "total": 12.34, "count": 1, "weekOf": "$WEEK", "lines": [{"key": "k", "name": "n", "section": "Proteins", "for": "x", "add": 1, "cost": 12.34, "approx": false, "status": "exact", "url": null, "expect": null, "price": null, "search": "n"}]}, "updatedAt": 1}}
/* An approval saved by a page from before approvals remembered the week has
   nothing to compare against: it stays quiet, and a save keeps it. */
await ready();
ok("the old approval loads", !!approved && approved.lines.length === 1);
ok("no notice without anything to compare", !/since you approved/i.test(shopText()));
inBasket = { k: true }; persist(); await wait(1000);
ok("a save keeps her approval", stored().approved && stored().approved.total === 12.34);
