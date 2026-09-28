/* A leftovers meal buys nothing only while the meal that cooks its pot is
   still on the plan. Swap either and it has to be shopped for, or the lunch has
   no rice. */
await ready();
const lm = plan.meals.find((m) => m.leftovers && m.from);
if (!lm) { info("this week's plan has no leftovers meal — nothing to check"); }
else {
  const title = all()[picks[lm.id]].title;
  const shops = () => weekWanted().some((w) => String(w.for).includes(title));
  ok("as planned, the leftovers meal buys nothing", !shops());
  setPick(lm.from, otherDish(lm.from));
  ok("swap the meal it comes from and it is shopped for", shops());
  ok("and it stops promising an earlier pot", !meals().find((m) => m.id === lm.id).leftovers);
  setPick(lm.from, baseline[lm.from]);
  ok("put that meal back and it is leftovers again", !shops());
  setPick(lm.id, otherDish(lm.id));
  const t = all()[picks[lm.id]].title;
  ok("swap the leftovers meal itself and its new dish is shopped for", weekWanted().some((w) => String(w.for).includes(t)), t);
}
