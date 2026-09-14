/*
 * Runs INSIDE an intermarche.com product page, in Charlotte's own Chrome, through
 * the Claude in Chrome javascript tool — never from Node, never against their
 * API. One call per product: check the page is the approved listing, set the
 * count in the basket, prove the count moved, and say what happened.
 *
 *   await (<this file's function>)({ url, expect: { brand, title, packaging }, add })
 *
 * `npm run drive:list -- … --batch <tabId>` writes the calls for you.
 *
 * Returns { status, before, after, found, note } with
 * status one of the push report statuses: added | already | unavailable |
 * mismatch | not-found | stuck. It clicks only the product's own add, − and +
 * controls, and only buttons that are actually on screen — the page carries
 * hidden duplicates that swallow a click silently.
 */
async function driveProduct({ url, expect, add, waitMs = 12000 }) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => String(s || "").toLowerCase().normalize("NFC")
    .replace(/[’`]/g, "'").replace(/, une marque intermarché/g, "")
    .replace(/\s*-\s*cat\.\s*(?:\d|extra)\b/g, "").replace(/\s+/g, " ").trim();
  const packNorm = (s) => norm(String(s || "").split("|")[0].split("•")[0]).replace(/\s+/g, "");
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const leaves = (root) => [...root.querySelectorAll("*")].filter((e) => e.childElementCount === 0 && e.textContent.trim());
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

  // The product's own block: up from the h1 to the first ancestor that holds its
  // add control, its stepper, or its out-of-stock notice.
  const block = () => {
    const h1 = document.querySelector("h1");
    if (!h1) return null;
    let b = h1;
    for (let i = 0; i < 10 && b && b !== document.body; i++, b = b.parentElement) {
      if (b.querySelector(`button[aria-label="${ADD_LABEL}"]`) || /Indisponible|Exemplaires dans le panier/.test(b.innerText)) return b;
    }
    return null;
  };
  const countIn = (b) => { const m = b.innerText.match(/(\d+)\s*\n\s*Exemplaires dans le panier/); return m ? Number(m[1]) : 0; };
  const controls = (b) => {
    const buttons = [...b.querySelectorAll("button")].filter(visible);
    const big = buttons.find((x) => /Ajouter au panier/.test(x.innerText));
    const labelText = textNodes(b).find((x) => x.textContent.trim() === "Exemplaires dans le panier");
    const label = labelText ? labelText.parentElement : null;
    let stepper = label;
    while (stepper && stepper !== b && [...stepper.querySelectorAll("button")].filter(visible).length < 2) stepper = stepper.parentElement;
    const steps = stepper && stepper !== b ? [...stepper.querySelectorAll("button")].filter(visible) : [];
    return { big, minus: steps[0] || null, plus: steps.find((x) => x.getAttribute("aria-label") === ADD_LABEL) || steps[steps.length - 1] || null };
  };

  // Wait for this product's page — not the one it replaced — to finish rendering.
  const wantPath = decodeURI(new URL(url, location.origin).pathname);
  const t0 = Date.now();
  let b = null;
  while (Date.now() - t0 < waitMs) {
    if (decodeURI(location.pathname) === wantPath && (b = block())) break;
    await sleep(250);
  }
  if (!b) return { status: "not-found", note: decodeURI(location.pathname) === wantPath ? "product block never rendered" : "page did not open: " + location.pathname };

  const h1 = document.querySelector("h1");
  const parts = textNodes(h1).map((x) => x.textContent.trim());
  const lines = b.innerText.split("\n").map((s) => s.trim()).filter(Boolean);
  const titleAt = lines.findIndex((l) => norm(l) === norm(parts.slice(1).join(" ")));
  const found = {
    brand: parts[0] || "", title: parts.slice(1).join(" "),
    packaging: titleAt >= 0 ? (lines[titleAt + 1] || "").split("|")[0].trim() : "",
    price: (lines.find((l) => /^\d+,\d\d\s*€$/.test(l)) || null),
  };
  const nameOk = norm(found.brand + " " + found.title) === norm(expect.brand + " " + expect.title);
  const packOk = packNorm(found.packaging) === packNorm(expect.packaging);
  const before = countIn(b);
  const out = (status, extra) => ({ status, before, after: countIn(block() || b), found, ...extra });
  if (!nameOk || !packOk) return out("mismatch", { note: `page shows ${found.brand} · ${found.title}, ${found.packaging}` });
  if (/Indisponible/.test(b.innerText)) return out("unavailable");
  if (!Number.isInteger(add) || add < 0 || add > 30) return out("stuck", { note: "refusing a count of " + add });
  if (before === add) return out("already");

  // One click, then proof: the count must move. The first + straight after an
  // add is the click that goes missing, so a click that changes nothing is
  // tried once more before giving up.
  const press = async (pick) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const cur = block(); const was = countIn(cur); const el = pick(controls(cur));
      if (!el) return false;
      el.click();
      const t = Date.now();
      while (Date.now() - t < 4000) { await sleep(200); const bb = block(); if (bb && countIn(bb) !== was) return true; }
    }
    return false;
  };
  let n = before, guard = 0;
  while (n !== add && guard++ < 40) {
    const ok = n === 0 ? await press((c) => c.big || c.plus) : n < add ? await press((c) => c.plus) : await press((c) => c.minus);
    if (!ok) return out("stuck", { note: `count stayed at ${countIn(block() || b)} after two clicks` });
    await sleep(350);
    n = countIn(block() || b);
  }
  return out(n === add ? (add === 0 ? "removed" : "added") : "stuck");
}
