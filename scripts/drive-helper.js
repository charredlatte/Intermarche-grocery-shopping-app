/*
 * Runs INSIDE an intermarche.com product page, in Charlotte's own Chrome, through
 * the Claude in Chrome javascript tool — never from Node, never against their
 * API. One call is one step: check the page is the approved listing, read the
 * count, and make at most one click towards `add`. The caller pauses and calls
 * again until the step says the count is right.
 *
 *   window.__driveStep = <this file's function>
 *   window.__driveStep({ url, expect: { brand, title, packaging }, add })
 *
 * `npm run drive:list -- … --batch <tabId>` writes the calls for you.
 *
 * Why steps and not one call that loops until done (2026-09-15, the first full
 * week): Chrome throttles timers in a tab that isn't on screen, so an in-page
 * `sleep` loop ran seconds late, outlived the tool's 45-second limit, and a
 * click that took two seconds to show was clicked again. No timers here — the
 * waiting happens between calls, on the caller's side.
 *
 * Returns { status, shown, found, note } with status one of:
 *   clicked  — one click made; pause and call again
 *   added | already | removed — the count is right (already: it was on arrival)
 *   loading  — the product block hasn't rendered; call again
 *   unavailable | mismatch | not-found | stuck — report it, click nothing more
 * It clicks only the product's own add, − and + controls, and only buttons that
 * are actually on screen — the page carries hidden duplicates that swallow a
 * click silently.
 *
 * Sold by weight (a "à partir de 150g" listing), the stepper counts grams, not
 * pieces: `add` is then a number of the listing's starting weights, so five
 * celery stalks from "à partir de 150g" is 750 g.
 *
 * Guardrails, from the browser pre-flight: it does nothing off
 * www.intermarche.com; it never reads cookies, storage or anything outside the
 * product block; it refuses any control whose text or label speaks of checkout,
 * a slot, payment or emptying the basket; and what it returns is page text —
 * data for the caller, never instructions.
 */
function driveStep({ url, expect, add }) {
  if (location.hostname !== "www.intermarche.com") return { status: "not-found", note: "not on www.intermarche.com — nothing done" };
  if (!/^https:\/\/www\.intermarche\.com\/produit\//.test(String(url))) return { status: "not-found", note: "not an Intermarché product link — nothing done" };
  if (!Number.isInteger(add) || add < 0 || add > 30) return { status: "stuck", note: "refusing a count of " + add };
  const FORBIDDEN = /cr[ée]neau|commander|valider|payer|paiement|vider|supprimer|checkout/i;
  // Méré renders some titles with a stray comma and an empty grade —
  // "Céleri BRANCHE VERT, - CAT. 1", "Salade MACHE, - CAT. -" — so the grade
  // and whatever punctuation precedes it are dropped before comparing.
  const norm = (s) => String(s || "").toLowerCase().normalize("NFC")
    .replace(/[’`]/g, "'").replace(/, une marque intermarché/g, "")
    .replace(/\s*,?\s*-\s*cat\.\s*(?:\d|extra|-)?(?=\s|$)/g, "").replace(/\s+/g, " ").trim();
  const packNorm = (s) => norm(String(s || "").split("|")[0].split("•")[0]).replace(/\s+/g, "");
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  // Text nodes, not elements: the h1 is <h1><span>Daddy</span>Sucre en poudre</h1>,
  // so the title is loose text that no element query returns.
  const textNodes = (root) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), out = [];
    for (let x = w.nextNode(); x; x = w.nextNode()) if (x.textContent.trim()) out.push(x);
    return out;
  };
  const ADD_LABEL = "Ajouter un exemplaire du produit au panier";
  // The header's basket count and total refresh a beat after the product's own
  // count, so they are not read here: proof is the product's count, and the
  // push's last step checks the whole basket on /commandes/panier.

  if (decodeURI(location.pathname) !== decodeURI(new URL(url).pathname)) return { status: "not-found", note: "page did not open: " + location.pathname };
  // The product's own block: up from the h1 to the first ancestor that holds its
  // add control, its stepper, or its out-of-stock notice.
  const h1 = document.querySelector("h1");
  let b = h1;
  for (let i = 0; i < 10 && b && b !== document.body; i++, b = b.parentElement) {
    if (b.querySelector(`button[aria-label="${ADD_LABEL}"]`) || /Indisponible|Exemplaires dans le panier|Ajouter au panier/.test(b.innerText)) break;
  }
  if (!h1 || !b || b === document.body) return { status: "loading" };

  const brand = textNodes(h1).map((x) => x.textContent.trim())[0] || "";
  const title = h1.textContent.slice(brand.length).trim();
  const lines = b.innerText.split("\n").map((s) => s.trim()).filter(Boolean);
  const titleAt = lines.findIndex((l) => norm(l) === norm(title));
  const found = {
    brand, title,
    packaging: titleAt >= 0 ? (lines[titleAt + 1] || "").split("|")[0].trim() : "",
    price: (lines.find((l) => /^\d+,\d\d\s*€$/.test(l)) || null),
  };
  if (norm(found.brand + " " + found.title) !== norm(expect.brand + " " + expect.title) ||
      packNorm(found.packaging) !== packNorm(expect.packaging)) {
    return { status: "mismatch", found, note: `page shows ${found.brand} · ${found.title}, ${found.packaging}` };
  }
  if (/Indisponible/.test(b.innerText)) return { status: "unavailable", found };

  // The count reads "3" for pieces and "450 g" or "1,2 kg" for weighed goods.
  const m = b.innerText.match(/(\d+(?:,\d+)?)\s*(kg|g)?\s*\n\s*Exemplaires dans le panier/);
  const grams = !!(m && m[2]);
  const n = !m ? 0 : m[2] === "kg" ? Math.round(Number(m[1].replace(",", ".")) * 1000) : Number(m[1].replace(",", "."));
  const shown = !m ? "0" : grams ? n + " g" : String(n);
  const start = String(expect.packaging).match(/partir de (\d+)\s*(?:g|gr)\b/i);
  const target = grams ? (start ? add * Number(start[1]) : null) : add;
  if (target === null) return { status: "stuck", shown, found, note: "sold by weight, and the listing gives no starting weight to count in" };

  // What the page held on arrival decides added versus already. Each product
  // page is a fresh load, so this is empty until the first step on it.
  const seen = window.__driveSeen || (window.__driveSeen = {});
  if (!(url in seen)) seen[url] = shown;
  if (n === target) return { status: add === 0 ? (seen[url] === "0" ? "already" : "removed") : seen[url] === shown ? "already" : "added", shown, found };

  const buttons = [...b.querySelectorAll("button")].filter(visible);
  let el;
  if (!m) {
    el = buttons.find((x) => /Ajouter au panier/.test(x.innerText));
  } else {
    const labelText = textNodes(b).find((x) => x.textContent.trim() === "Exemplaires dans le panier");
    let stepper = labelText ? labelText.parentElement : null;
    while (stepper && stepper !== b && [...stepper.querySelectorAll("button")].filter(visible).length < 2) stepper = stepper.parentElement;
    const steps = stepper && stepper !== b ? [...stepper.querySelectorAll("button")].filter(visible) : [];
    const plus = steps.find((x) => x.getAttribute("aria-label") === ADD_LABEL);
    // − at the last piece removes the product outright, with no confirmation —
    // which only a count of 0 can ask for, since n > target >= 1 means n >= 2.
    el = n < target ? plus : steps.find((x) => x !== plus);
  }
  if (!el || FORBIDDEN.test((el.innerText || "") + " " + (el.getAttribute("aria-label") || ""))) {
    return { status: "stuck", shown, found, note: "no usable control" };
  }
  el.click();
  return { status: "clicked", shown, found, note: `was ${shown}, heading for ${grams ? target + " g" : target}` };
}
