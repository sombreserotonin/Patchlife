import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validateSources } from "../scripts/validate-data.mjs";
import { categoryFor, fill, isoDate, recordId } from "../scripts/parsers/common.mjs";
import * as ezviz from "../scripts/parsers/ezviz-eol.mjs";
import * as tpLink from "../scripts/parsers/tp-link-au.mjs";

// The parsers read the real profiles; the pages are synthetic (made-up models, the real markup).
const SOURCES = validateSources(fileURLToPath(new URL("../data/sources", import.meta.url))).entries;
const profile = (slug) => SOURCES.find((s) => s.brand_slug === slug);
const fixture = (name) => readFileSync(fileURLToPath(new URL(`./fixtures/parsers/${name}`, import.meta.url)), "utf8");
const TODAY = "2026-10-27";
const FOOTNOTE = "*The non-EOL product’s defined support period may be refreshed to extend specified date.";

test("the id is the brand slug and the model slugged, as every record on main is named", () => {
  assert.equal(recordId("tp-link", "Tapo C200 (V5)"), "tp-link-tapo-c200-v5");
  assert.equal(recordId("tp-link", "EAP615-Wall (V1.20)"), "tp-link-eap615-wall-v1-20");
  assert.equal(recordId("ezviz", "CS-X5S-4W-B/1T"), "ezviz-cs-x5s-4w-b-1t");
  assert.equal(recordId("ezviz", "CS-BC1-B3(4MP,W1)"), "ezviz-cs-bc1-b3-4mp-w1");
});

test("helpers: category lookup follows R7, dates must exist, templates must be filled", () => {
  const p = { category_map: [{ row: "^Wi-Fi 6 AP\\b", category: "access-point" }, { model: "^Tapo", category: "camera" }], category_exceptions: { "x-y": "other" } };
  assert.equal(categoryFor(p, { id: "x-y", model: "Tapo", quote: "Wi-Fi 6 AP" }), "other");
  assert.equal(categoryFor(p, { id: "x-z", model: "EAP1", quote: "Wi-Fi 6 AP EAP1 V1 31/12/2028" }), "access-point");
  assert.equal(categoryFor(p, { id: "x-z", model: "Tapo C1", quote: "Camera Tapo C1" }), "camera");
  assert.equal(categoryFor(p, { id: "x-z", model: "M1", quote: "Mobile Wi-Fi M1" }), null);
  assert.equal(isoDate(2029, 1, 7), "2029-01-07");
  assert.equal(isoDate(2029, 6, 31), null);
  assert.equal(isoDate(2028, 2, 29), "2028-02-29");
  assert.equal(fill("Hardware version {version} only.", { version: "v1" }), "Hardware version v1 only.");
  assert.throws(() => fill("Line: {product_line}.", {}), /needs product_line/);
});

test("the TP-Link AU parser turns an 'or later*' row into a minimum with the footnote item and the profile's note", () => {
  const { candidates } = tpLink.parse({ html: fixture("tp-link-au.html"), profile: profile("tp-link"), today: TODAY });
  const item = (quote) => ({ url: tpLink.PAGE, quote, retrieved: TODAY, regime: "au_smart_device_rules" });
  assert.deepEqual(candidates.find((c) => c.id === "tp-link-tapo-z100-v5"), {
    id: "tp-link-tapo-z100-v5",
    brand: "TP-Link",
    brand_slug: "tp-link",
    model: "Tapo Z100 (V5)",
    aliases: ["Tapo Z100 V5"],
    category: "camera",
    regions: ["AU"],
    support: { rule: "fixed_date", end_date: "2028-12-31", years: null, anchor_date: null, at_least: true, conditions: "Hardware version V5 only." },
    evidence: [item("Wired Indoor Camera Tapo Z100 V5 31/12/2028 or later*"), item(FOOTNOTE)],
    verification: { status: "unverified" },
    notes: "The statement's footnote says the date may be extended for products not yet at end of life.",
  });
});

test("the TP-Link AU parser records an end-of-life row with a bare date, no footnote and no note, and keeps the row's version casing", () => {
  const { candidates } = tpLink.parse({ html: fixture("tp-link-au.html"), profile: profile("tp-link"), today: TODAY });
  const eol = candidates.find((c) => c.id === "tp-link-archer-zx55-v1");
  assert.equal(eol.model, "Archer ZX55 (V1)");
  assert.equal(eol.category, "router");
  assert.deepEqual(eol.support, { rule: "fixed_date", end_date: "2029-01-07", years: null, anchor_date: null, at_least: false, conditions: "Hardware version V1 only." });
  assert.equal(eol.evidence.length, 1);
  assert.ok(!("notes" in eol));
  const lower = candidates.find((c) => c.id === "tp-link-es999x-m2-v1");
  assert.equal(lower.model, "ES999X-M2 (v1)");
  assert.deepEqual(lower.aliases, ["ES999X-M2 v1"]);
  assert.equal(lower.support.conditions, "Hardware version v1 only.");
  assert.equal(lower.category, "network-switch");
  assert.equal(candidates.find((c) => c.id === "tp-link-archer-zx20-v1-20").model, "Archer ZX20 (V1.20)");
});

test("the TP-Link AU parser skips, with a reason, rows it cannot read without guessing", () => {
  const { candidates, skipped } = tpLink.parse({ html: fixture("tp-link-au.html"), profile: profile("tp-link"), today: TODAY });
  assert.deepEqual(skipped, [
    { quote: "Wi-Fi 6 Router Archer ZX10 V3 31/6/2029 or later*", reason: '"31/6/2029 or later*" is not a calendar date' },
    { quote: "Wi-Fi 6 Router Archer ZX5 V1 31/12/2028 or sooner*", reason: `"or sooner*" after the date is not the profile's at-least phrase` },
    { quote: "Mobile Wi-Fi M9000 V1 31/12/2028 or later*", reason: 'no category_map entry for product line "Mobile Wi-Fi"' },
    { quote: "L3 Managed Switch S9900-48C 31/12/2028 or later*", reason: "no hardware version in the model cell" },
  ]);
  // Header and section rows are neither candidates nor skipped; a model listed twice gives two candidates here, which
  // candidates.mjs collapses when the rows are identical and reports when they differ.
  assert.equal(candidates.length, 10);
});

test("the EZVIZ EOL parser reproduces the four-item records with the product line in the note", () => {
  const { candidates } = ezviz.parse({ html: fixture("ezviz-eol.html"), profile: profile("ezviz"), today: TODAY });
  const item = (url, quote) => ({ url, quote, retrieved: TODAY, regime: "vendor_policy" });
  assert.deepEqual(candidates.find((c) => c.id === "ezviz-cs-z1-32w"), {
    id: "ezviz-cs-z1-32w",
    brand: "EZVIZ",
    brand_slug: "ezviz",
    model: "CS-Z1-32W",
    category: "hub",
    regions: ["EU"],
    support: { rule: "fixed_date", end_date: "2030-01-20", years: null, anchor_date: null, at_least: false, conditions: "EZVIZ gives this as an expected EOL date and says its EOL product list is subject to change." },
    evidence: [
      item(ezviz.PAGE, "Home Gateway CS-Z1-32W Europe 2030/1/20"),
      item(ezviz.PAGE, "About EZVIZ’s EOL (End-Of-Life) products: It means that EZVIZ no longer maintain any firmware updates (including security updates) for them, and may no longer respond to security vulnerability reports for such products either."),
      item(ezviz.PAGE, "Please note that the list includes both EOL products and currently active products with an expected EOL date."),
      item("https://www.ezviz.com/inter/trust-center/security/upgrade-policy", "The updates policies and the EOL product list are subject to change and will be reviewed on a regular basis."),
    ],
    verification: { status: "unverified" },
    notes: "EZVIZ lists this as the expected day of firmware update cessation for the targeted area Europe, and says its EOL means no firmware updates, including security updates. The page gives the model number only; product line on the page: Home Gateway.",
  });
  // A product line written over two lines in the cell reads as one.
  const camera = candidates.find((c) => c.id === "ezviz-cs-zv310-a0-1b2wfr-2-8mm");
  assert.equal(camera.category, "camera");
  assert.ok(camera.notes.endsWith("product line on the page: Smart Home Camera."));
  assert.equal(candidates.find((c) => c.id === "ezviz-cs-z5s-4w-b-1t").category, "nvr");
});

test("the EZVIZ EOL parser skips another targeted area, an impossible date and an unmapped product line", () => {
  const { candidates, skipped } = ezviz.parse({ html: fixture("ezviz-eol.html"), profile: profile("ezviz"), today: TODAY });
  assert.equal(candidates.length, 6);
  assert.deepEqual(skipped, [
    { quote: "Smart Home Camera CS-ZB1-A0-2C4WPBL North America 2029/12/31", reason: 'targeted area "North America" is not Europe' },
    { quote: "Smart Home Camera CS-ZB2-A0-2C4WPBL Europe 2029/2/30", reason: '"2029/2/30" is not a calendar date' },
    { quote: "Pet Feeder CS-ZPF1-A0 Europe 2029/12/31", reason: 'no category_map entry for product line "Pet Feeder"' },
  ]);
});
