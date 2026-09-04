#!/usr/bin/env node
/**
 * Parses Intermarché "Votre facture est disponible" emails into structured
 * purchase history.
 *
 * Input:  data/invoices/*.txt  (plain-text bodies of the invoice emails)
 * Output: data/purchase-history.json
 *
 * The emails follow a stable template:
 *
 *     N0 de commande
 *      362261931
 *     Drive
 *      jeudi 27 août, entre 14h30 et 15h30
 *     ...
 *     Récapitulatif de votre commande
 *     24 produits
 *         <Brand> <Product name>
 *     <packaging line>
 *     x1
 *     3,04 €
 *     3,04 €
 *
 * Weighed items use "Poids exact" and a kg quantity instead of "xN".
 * Out-of-stock items carry a "Produit indisponible" line and no line total.
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INVOICE_DIR = join(ROOT, "data", "invoices");
const OUT = join(ROOT, "data", "purchase-history.json");

const MONTHS = {
  janvier: 1, février: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, août: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12,
};

const money = (s) => parseFloat(s.replace(/\s/g, "").replace(",", "."));

// Product names are compared case- and spacing-insensitively: the same product
// comes back as "Ultima croquettes..." one week and "Ultima Croquettes..." the next.
const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();

// Does `haystack` contain every fragment, in order? Used to fold a truncated
// name ("Jean Roze, une ma... Chipolata superie...") onto its full version.
function containsInOrder(haystack, fragments) {
  let at = 0;
  for (const f of fragments) {
    const found = haystack.indexOf(f, at);
    if (found === -1) return false;
    at = found + f.length;
  }
  return true;
}

function parseInvoice(text, year = null) {
  const order = {
    orderNumber: null,
    store: null,
    date: null,
    items: [],
    total: null,
  };

  const num = text.match(/N0? de commande\s*\n\s*(\d+)/);
  if (num) order.orderNumber = num[1];

  const store = text.match(/Votre facture est disponible\.\s*\n+\s*(\S[^\n]*)/);
  if (store) order.store = store[1].trim();

  // "jeudi 27 août, entre ..." — the month is accented, and \w+ stops at the accent.
  // The body never states the year, so it comes from the filename.
  const day = text.match(/(\d{1,2}) ([^\s,]+), entre/);
  if (day) {
    order.date = { year, day: +day[1], month: MONTHS[day[2].toLowerCase()] ?? null };
  }

  const total = text.match(/Total pay[ée][\s\S]{0,40}?(\d+,\d{2})[ \u00a0]*€/);
  if (total) order.total = money(total[1]);

  // Everything after the recap header is line items.
  const recapAt = text.indexOf("capitulatif de votre commande");
  if (recapAt === -1) return order;
  const body = text.slice(recapAt).split(/Total pay[ée]/)[0];

  // Each item begins with an indented brand/name line and ends at the next one.
  // Split on the quantity markers instead: they are the only reliable anchors.
  const lines = body.split("\n").map((l) => l.trimEnd());

  let buffer = [];
  const flush = () => {
    if (!buffer.length) return;
    const chunk = buffer.join("\n");
    buffer = [];

    const unavailable = /Produit indisponible/.test(chunk);
    // \s would span newlines and swallow the "x1" quantity into the price.
    const prices = [...chunk.matchAll(/(\d+(?:[ \u00a0]\d{3})*,\d{2})[ \u00a0]*€/g)]
      .map((m) => money(m[1]));

    let qty = null;
    let unit = "unit";
    const byCount = chunk.match(/\bx(\d+(?:\.\d+)?)\s*$/m);
    const byWeightKg = chunk.match(/\bx(\d+(?:\.\d+)?) ?kg\b/);
    // Loose produce is sometimes priced by the gram instead: "x150 g", "x800 g".
    const byWeightG = chunk.match(/\bx(\d+(?:\.\d+)?) ?g\b/);
    const exactG = chunk.match(/Poids exact\s*\n+\s*(\d+(?:\.\d+)?)\s*(kg|g)\b/);
    // "Poids exact" over a bare integer is a unit count, not a weight — two tins
    // of kidney beans, two bags of rice. Only multi-buys of packaged goods look
    // like this, and without the branch they parse as no quantity at all.
    const exactCount = chunk.match(/Poids exact\s*\n+\s*(\d+)\s*$/m);

    if (byWeightKg) {
      qty = parseFloat(byWeightKg[1]);
      unit = "kg";
    } else if (exactG) {
      qty = parseFloat(exactG[1]);
      unit = exactG[2];
      if (unit === "g") { qty = qty / 1000; unit = "kg"; }
    } else if (byWeightG) {
      qty = parseFloat(byWeightG[1]) / 1000;
      unit = "kg";
    } else if (exactCount) {
      qty = parseFloat(exactCount[1]);
    } else if (byCount) {
      qty = parseFloat(byCount[1]);
    }

    // First non-empty, non-marker line is the product name; the next is packaging.
    const textLines = chunk
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !/^x[\d.]/.test(l) && !/€/.test(l) &&
                     !/^(Poids exact|Produit indisponible|Quantite|Quantité|Prix unitaire|TTC|Total)$/i.test(l));

    if (!textLines.length) return;

    order.items.push({
      name: textLines[0],
      // Invoices before Nov 2025 use a narrower template that cuts names mid-word.
      truncated: textLines[0].includes("..."),
      packaging: textLines[1] ?? null,
      quantity: qty,
      unit,
      unitPrice: prices[0] ?? null,
      lineTotal: unavailable ? 0 : (prices[1] ?? prices[0] ?? null),
      unavailable,
    });
  };

  for (const line of lines) {
    // A line starting with 4+ spaces marks the start of a new product block.
    if (/^ {4,}\S/.test(line) && buffer.length) flush();
    buffer.push(line);
  }
  flush();

  // Drop the header rows the template emits before the first real product.
  order.items = order.items.filter(
    (i) => i.unitPrice !== null && !/^\d+ produits?$/.test(i.name)
  );

  return order;
}

/**
 * Every distinct full product name seen, keyed by its normalised form.
 * These are the names the basket step searches on, so they are the canonical ones.
 */
function canonicalNames(orders) {
  const canonical = new Map();
  for (const order of orders) {
    for (const item of order.items) {
      if (item.truncated) continue;
      const key = norm(item.name);
      if (!canonical.has(key)) canonical.set(key, item.name);
    }
  }
  return canonical;
}

/**
 * Which product is this line item? Full names resolve to themselves. A truncated
 * name folds onto the one full name containing all its fragments in order — so
 * "Jean Rozé, une ma... Chipolata supérie..." finds the chipolatas and nothing
 * else. If it matches none or several, it stays as it is rather than guessing.
 */
function resolveName(item, canonical) {
  const key = norm(item.name);
  if (!item.truncated) return canonical.get(key) ?? item.name;

  const fragments = item.name.split("...").map(norm).filter(Boolean);
  if (!fragments.length) return item.name;

  const hits = [...canonical].filter(([full]) => containsInOrder(full, fragments));
  return hits.length === 1 ? hits[0][1] : item.name;
}

function aggregate(orders) {
  const canonical = canonicalNames(orders);
  const byProduct = new Map();

  for (const order of orders) {
    for (const item of order.items) {
      const key = resolveName(item, canonical);
      if (!byProduct.has(key)) {
        byProduct.set(key, {
          name: key,
          packaging: item.packaging,
          timesOrdered: 0,
          totalQuantity: 0,
          unit: item.unit,
          lastPrice: null,
          timesUnavailable: 0,
          // True only if every sighting came from the truncated template, so the
          // name is a fragment and must not be used as a search term.
          nameTruncated: true,
          orders: [],
        });
      }
      const p = byProduct.get(key);
      p.timesOrdered += 1;
      p.totalQuantity += item.quantity ?? 0;
      p.lastPrice = item.unitPrice;
      if (!item.truncated || canonical.has(norm(key))) p.nameTruncated = false;
      if (item.unavailable) p.timesUnavailable += 1;
      if (order.orderNumber) p.orders.push(order.orderNumber);
    }
  }

  const products = [...byProduct.values()].sort((a, b) => b.timesOrdered - a.timesOrdered);
  const n = orders.length || 1;

  return {
    generatedAt: new Date().toISOString(),
    ordersParsed: orders.length,
    averageBasket: +(orders.reduce((s, o) => s + (o.total ?? 0), 0) / n).toFixed(2),
    averageItemCount: Math.round(orders.reduce((s, o) => s + o.items.length, 0) / n),
    // Bought in more than half of orders: the standing staples. A product only
    // ever seen under a truncated name can't be searched for, so it stays out.
    staples: products
      .filter((p) => !p.nameTruncated && p.timesOrdered / n > 0.5)
      .map((p) => p.name),
    products,
    orders,
  };
}

function main() {
  let files = [];
  try {
    files = readdirSync(INVOICE_DIR).filter((f) => /\.(txt|eml)$/i.test(f));
  } catch {
    console.error(`No ${INVOICE_DIR}. Create it and drop invoice email bodies in as .txt files.`);
    process.exit(1);
  }

  if (!files.length) {
    console.error("No invoice files found.");
    process.exit(1);
  }

  // Files are named <YYYY-MM-DD>-<orderNumber>.txt, which sorts chronologically
  // and supplies the year the email body leaves out.
  const orders = files
    .sort()
    .map((f) => {
      const year = f.match(/^(\d{4})-/);
      return parseInvoice(readFileSync(join(INVOICE_DIR, f), "utf8"), year ? +year[1] : null);
    })
    .filter((o) => o.items.length);

  const result = aggregate(orders);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(result, null, 2));

  console.log(`Parsed ${orders.length} orders, ${result.products.length} distinct products.`);
  console.log(`Average basket: ${result.averageBasket} € / ${result.averageItemCount} items`);
  console.log(`Staples: ${result.staples.slice(0, 10).join(", ")}`);
}

main();
