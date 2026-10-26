/* "In this order, and no longer needed" used to weigh the whole receipt against
   each dropped line on its own, so an equivalent that came for one dish was
   read as spare for another. Two dinners naming different members of one
   equivalence group are enough: the escalope Thursday is going to eat was
   listed as left over the moment Monday was swapped off it, and the one thing
   she must be able to trust is which food is still spoken for. The order's
   surplus is now what is left once every need the week still has has drawn
   from it. Nothing here names a dish or a week — it works off whatever
   equivalence group this library happens to carry. */
await ready();
have = {};
approveAll();
const wanted = weekWanted();
const byName = new Map(wanted.map((w) => [w.name || w.key, w]));

// An interchangeable pair where the week wants one of the two: the order will
// bring that one, and the approval will remember the other.
let pair = null;
for (const g of EQUIV) {
  const names = (g.members || []).map((m) => m.name);
  const held = names.find((n) => byName.has(n));
  const other = held && names.find((n) => n !== held && unitOf(n) === unitOf(held));
  if (held && other) { pair = { held, other }; break; }
}

if (!pair) info("no equivalence group has a member this week buys — not exercised");
else {
  info("approved " + pair.other + ", the order brought " + pair.held);
  // The week as approved, plus one line for a dish since swapped away.
  approved = { ...approved, wanted: {
    ...Object.fromEntries(wanted.map((w) => [w.key, { required: w.required, for: w.for, name: w.name || w.key }])),
    [pair.other]: { required: 1, for: "a dish since swapped away", name: pair.other },
  } };
  // The order brought exactly what the week still wants, and nothing beyond it.
  DATA.delivered = { from: { order: "test" },
    items: wanted.map((w) => ({ product: w.name || w.key, quantity: w.required })) };
  renderAll();

  const d = driftSinceApproval();
  const less = d ? d.less.map((x) => x.name) : [];
  ok("a product another dish still eats is not called left over", !less.includes(pair.other), less.join(", "));
  ok("and a receipt holding exactly this week's needs leaves nothing over", less.length === 0, less.join(", "));
  ok("while what the order did not bring is still asked for",
     !d || d.more.every((x) => !byName.has(x.name)), d ? d.more.map((x) => x.name).join(", ") : "");

  // The same approval, and an order that brought a second of the pair as well:
  // that one really is spare, and she should be told.
  DATA.delivered = { from: { order: "test" },
    items: [...wanted.map((w) => ({ product: w.name || w.key, quantity: w.required })),
            { product: pair.other, quantity: 1 }] };
  renderAll();
  const d2 = driftSinceApproval();
  ok("but a spare one over and above the week's needs is reported",
     !!d2 && d2.less.some((x) => x.name === pair.other), d2 ? d2.less.map((x) => x.name).join(", ") : "no drift");

  DATA.delivered = null;
  renderAll();
}
