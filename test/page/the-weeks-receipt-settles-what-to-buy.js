/* After the order, a changed week used to be checked against the approved list
   alone: a plan rewritten around what actually came — chicken where turkey was
   approved — told her to buy the chicken separately. Once the week's receipt is
   in, what it brought, and what was already in the kitchen, is what the order
   covered. What neither covers is still asked for, and "no longer needed" is
   only what came and is now left over. */
await ready();
have = {};
approveAll();
const id = aDinner();
setPick(id, otherDish(id));
const before = driftSinceApproval();
ok("without a receipt, a swap after approving asks for its new lines", !!before && before.more.length > 0);
ok("and names what the old dish no longer needs", !!before && before.less.length > 0);

// A receipt that brought everything the week now wants, plus one of each line
// the old dish needed, some of it under an equivalent's name.
const nameOf = (w) => w.name || subs[w.key] || w.key;
const stand = (name) => {
  const g = GROUP_OF[name];
  const alt = g && (g.members || []).find((m) => m.name !== name && unitOf(m.name) === unitOf(name));
  return alt ? alt.name : name;
};
const all_ = weekWanted().map((w) => ({ product: stand(nameOf(w)), quantity: w.required }));
const extra = before.less.map((x) => ({ product: x.name, quantity: 99 }));
DATA.delivered = { from: { order: "test" }, items: [...all_, ...extra] };
renderAll();
let d = driftSinceApproval();
ok("once the receipt is in, nothing it covers is 'buy separately'", !d || d.more.length === 0,
   d && d.more.map((x) => x.name).join(", "));
ok("including where it came as an equivalent", all_.some((i, n) => i.product !== nameOf(weekWanted()[n])));
ok("what came and is now spare is 'no longer needed'", !!d && before.less.every((x) => d.less.some((y) => y.name === x.name)));
ok("and the notice reads as after the order", /already gone to Intermarché/.test(shopText()));

// The same receipt without the line that covers one of the new needs.
const want = before.more[0].name;
DATA.delivered = { from: { order: "test" },
  items: all_.filter((i) => convert(1, i.product, want) === 0) };
renderAll();
d = driftSinceApproval();
ok("a need the receipt did not cover is still asked for", !!d && d.more.some((x) => x.name === want), want);
ok("and nothing that never came is called left over", !d || d.less.length === 0);

DATA.delivered = null;
setPick(id, baseline[id]);
renderAll();
