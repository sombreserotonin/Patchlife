import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validateSources } from "../scripts/validate-data.mjs";
import { categoryFor, fill, isoDate, recordId } from "../scripts/parsers/common.mjs";
import * as asus from "../scripts/parsers/asus.mjs";
import * as ezviz from "../scripts/parsers/ezviz-eol.mjs";
import * as glInet from "../scripts/parsers/gl-inet.mjs";
import * as google from "../scripts/parsers/google.mjs";
import * as kyocera from "../scripts/parsers/kyocera.mjs";
import * as ring from "../scripts/parsers/ring.mjs";
import * as tpLink from "../scripts/parsers/tp-link-au.mjs";
import { GOOGLE_AU, PAGES, RING, fixtureSources } from "./fixtures/parsers/profiles.mjs";

// The parsers read the real profiles; the pages are synthetic (made-up models, the real markup). The B4 brands take
// the fixture profiles, which add the made-up names to the renames tables and point Google at the fixture statements.
const SOURCES = fixtureSources(validateSources(fileURLToPath(new URL("../data/sources", import.meta.url))).entries);
const profile = (slug) => SOURCES.find((s) => s.brand_slug === slug);
const pagesFor = (parser, slug) => parser.pages(profile(slug)).map((url) => ({ url, html: PAGES[url] }));
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
  assert.equal(categoryFor(p, { id: "x-z", model: "M1", quote: "Smart Door Lock M1" }), null);
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
    { quote: "Smart Door Lock M9000 V1 31/12/2028 or later*", reason: 'no category_map entry for product line "Smart Door Lock"' },
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

test("the Ring parser merges a model's rows across the three pages, in page order, with the row and the at-least sentence from each", () => {
  const { candidates, skipped, flags, rows } = ring.parse({ pages: pagesFor(ring, "ring"), profile: profile("ring"), today: TODAY });
  const atLeast = profile("ring").at_least[0];
  const item = (url, quote) => ({ url, quote, retrieved: TODAY, regime: "vendor_policy" });
  assert.deepEqual(rows, { [RING.GB]: 7, [RING.AU]: 3, [RING.US]: 9 });
  assert.deepEqual(candidates.find((c) => c.id === "ring-video-doorbell-9"), {
    id: "ring-video-doorbell-9",
    brand: "Ring",
    brand_slug: "ring",
    model: "Video Doorbell 9",
    aliases: ["Ring Video Doorbell 9"],
    category: "doorbell",
    regions: ["UK", "AU", "US"],
    support: { rule: "fixed_date", end_date: "2029-12-31", years: null, anchor_date: null, at_least: true, conditions: profile("ring").conditions[RING.GB][0] },
    evidence: [item(RING.GB, "Ring Video Doorbell 9 31 December 2029"), item(RING.GB, atLeast), item(RING.AU, "Ring Video Doorbell 9 31 December 2029"), item(RING.AU, atLeast), item(RING.US, "Video Doorbell 9 31 December 2029"), item(RING.US, atLeast)],
    verification: { status: "unverified" },
  });
  // A page listed on one page only keeps that page's region; "Ring " is dropped from a US name too.
  assert.deepEqual(candidates.find((c) => c.id === "ring-alarm-keypad-z").regions, ["UK"]);
  assert.deepEqual(candidates.find((c) => c.id === "ring-beacon-z").regions, ["US"]);
  assert.equal(candidates.find((c) => c.id === "ring-beacon-z").category, "other");
  // Different dates on different pages are a D33 split: flagged with the model, both rows skipped, nothing recorded.
  assert.ok(!candidates.some((c) => c.model === "Chime Z"));
  assert.deepEqual(flags, [{ model: "Chime Z", text: "conflict: Ring's pages give different dates for Chime Z (UK 2029-12-31, US 2030-12-31), a D33 split for a person to record" }]);
  assert.deepEqual(skipped, [
    { url: RING.GB, quote: "Chime Q TBC", reason: '"TBC" is not a day, month and year' },
    { url: RING.US, quote: "Ring Widget Z 31 December 2030", reason: 'no category_map entry matches "Widget Z"' },
    { url: RING.GB, quote: "Ring Chime Z 31 December 2029", reason: "different dates on different pages for Chime Z (D33)" },
    { url: RING.US, quote: "Chime Z 31 December 2030", reason: "different dates on different pages for Chime Z (D33)" },
  ]);
});

test("the Ring parser maps a page's name to the model through the renames table, keeps the name as an alias, joins several rows of one page and quotes the 538eg rows", () => {
  const { candidates } = ring.parse({ pages: pagesFor(ring, "ring"), profile: profile("ring"), today: TODAY });
  const chime = candidates.find((c) => c.id === "ring-chime-z-pro-2nd-gen");
  assert.equal(chime.model, "Chime Z Pro (2nd Gen)");
  assert.deepEqual(chime.aliases, ["Ring Chime Z Pro (2nd Gen)", "Ring Chime Z Pro (2nd Generation)"]);
  assert.deepEqual(chime.regions, ["UK", "AU", "US"]);
  assert.equal(candidates.find((c) => c.id === "ring-video-doorbell-9-plus").aliases.join("|"), "Ring Video Doorbell 9 Plus|Ring Video Doorbell 9 Plus (2027 release)|Video Doorbell 9 Plus (2027 release)");
  const outdoor = candidates.find((c) => c.id === "ring-outdoor-cam-z");
  assert.equal(outdoor.evidence[0].quote, "Outdoor Cam Z , Plug-In 31 December 2030 Outdoor Cam Z , Solar 31 December 2030");
  assert.deepEqual(outdoor.aliases, ["Ring Outdoor Cam Z", "Outdoor Cam Z , Plug-In", "Outdoor Cam Z , Solar"]);
  const indoor = candidates.find((c) => c.id === "ring-indoor-cam-zk");
  assert.deepEqual(indoor.aliases, ["Ring Indoor Cam ZK", "Indoor Cam Z Plus"]);
  assert.deepEqual(indoor.evidence.slice(6), [RING.RENAMES_US, RING.RENAMES_GB, RING.RENAMES_AU].map((url) => ({ url, quote: "Indoor Cam Z Plus Indoor Cam ZK", retrieved: TODAY, regime: "vendor_policy" })));
});

test("the Google parser reads the release date, end date and Yes/No cell from the row, links the statements through the renames table and builds the notes from the templates", () => {
  const { candidates, skipped, flags, rows } = google.parse({ pages: pagesFor(google, "google"), profile: profile("google"), today: TODAY });
  assert.deepEqual(rows, { [google.TABLE]: 7, [google.UK]: 5, [GOOGLE_AU.ULTRA]: 1, [GOOGLE_AU.DOORBELL]: 1, [google.INDEX]: 3 });
  const ultra = candidates.find((c) => c.id === "google-nest-cam-ultra");
  assert.deepEqual(ultra.support, { rule: "years_after_launch", end_date: "2026-08-24", years: 5, anchor_date: "2021-08-24", at_least: true, conditions: "Covers critical issues that Google can fix with a remote software update." });
  assert.deepEqual(ultra.regions, ["GLOBAL", "UK", "AU"]);
  assert.deepEqual(ultra.aliases, ["Nest Cam ultra", "GZ9Z9"]);
  assert.deepEqual(ultra.evidence.map((e) => [e.url, e.regime, e.quote.slice(0, 30)]), [
    [google.TABLE, "vendor_policy", "Nest Cam (ultra) 8/24/2021 8/2"],
    [google.TABLE, "vendor_policy", "Google Nest connected home dev"],
    [google.TABLE, "vendor_policy", "Security updates will address "],
    [google.UK, "uk_psti", "Nest Cam ultra (GZ9Z9)"],
    [google.UK, "uk_psti", "Group 2: At least five years f"],
    [GOOGLE_AU.ULTRA, "au_smart_device_rules", "Nest Cam ultra (GZ9Z9)"],
    [GOOGLE_AU.ULTRA, "au_smart_device_rules", "At least five years from when "],
  ]);
  assert.equal(ultra.notes, "Google's table gives the US Google Store release date and the release date plus 5 years (minimum), in US month/day/year format. Also listed in Google's UK PSTI (April 2024) and Australian Cyber Security Rules (February 2026) statements of compliance, each applying where sold in that country. Google's page names no region; dates are anchored to the US Google Store. Google's table lists this model as currently receiving critical security updates (checked 2026-10-27); the 5-year minimum has passed.");
  // A No gets the not-receiving note; a Yes whose minimum has not passed gets no dated note; "Google " leaves the id.
  assert.ok(candidates.find((c) => c.id === "google-chromecast-z").notes.endsWith("Google's table lists this model as not currently receiving critical security updates (checked 2026-10-27)."));
  const orb = candidates.find((c) => c.id === "google-home-orb");
  assert.equal(orb.model, "Google Home Orb");
  assert.equal(orb.support.anchor_date, "2026-06-25");
  assert.ok(orb.notes.endsWith("Google's page names no region; dates are anchored to the US Google Store."));
  // The UK statement links the doorbell, the Australian statement's date disagrees with the table, so only UK is added.
  const doorbell = candidates.find((c) => c.id === "google-nest-doorbell-ultra-2nd-gen");
  assert.deepEqual(doorbell.regions, ["GLOBAL", "UK"]);
  assert.ok(doorbell.notes.includes("Also listed in Google's UK PSTI statement of compliance (April 2024), which applies where sold in the UK. Google's page names no region"));
  assert.deepEqual(skipped, [
    { url: google.TABLE, quote: "Nest Hub Z 3/30/2021 3/31/2026 Yes", reason: "the end date is not the release date plus 5 years" },
    { url: google.TABLE, quote: "Nest Wifi Z 10/28/2019 TBC Yes", reason: "the release or end cell is not a month/day/year date" },
    { url: google.TABLE, quote: "Google Pixel Lamp 1/1/2020 1/1/2025 Yes", reason: 'no category_map entry matches "Google Pixel Lamp"' },
  ]);
  assert.deepEqual(flags, [
    'google: the end date of "Nest Hub Z 3/30/2021 3/31/2026 Yes" is not the release date plus 5 years',
    'google: the UK statement lists "Nest Thermostat Z (A0909, A0910)", which the profile maps to "Nest Thermostat Z", but the Nest table has no such row',
    `google: the Australian statement ${GOOGLE_AU.DOORBELL} ends "Google Nest Doorbell (ultra, 2nd generation)(GZ8Z8)" no earlier than 2030-10-02, but the Nest table gives 2030-10-01, so it is not linked`,
    "google: the UK statement lists 1 product(s) the profile's renames table does not map to a Nest table model: Nest Hub Z (H9Z, H9Y)",
    "google: the regulatory page links an Australian statement the profile does not list: https://support.google.com/product-documentation/answer/99000003?hl=en",
  ]);
});

test("the GL.iNet parser reads the PSTI minimums and the firmware table's Maintenance rows, and reports a model on both pages (D39)", () => {
  const { candidates, skipped, flags, rows } = glInet.parse({ pages: pagesFor(glInet, "gl-inet"), profile: profile("gl-inet"), today: TODAY });
  assert.deepEqual(rows, { [glInet.PSTI]: 5, [glInet.ENDED]: 4 });
  const item = (url, quote, regime) => ({ url, quote, retrieved: TODAY, regime });
  assert.deepEqual(candidates.find((c) => c.id === "gl-inet-gl-z200"), {
    id: "gl-inet-gl-z200",
    brand: "GL.iNet",
    brand_slug: "gl-inet",
    model: "Velox (GL-Z200)",
    aliases: ["GL-Z200"],
    category: "router",
    regions: ["UK"],
    support: { rule: "fixed_date", end_date: "2027-06-11", years: null, anchor_date: null, at_least: true, conditions: "Pre-defined support period; the actual period is 2 years after GL.iNet announces end of life, so it can be longer." },
    evidence: [item(glInet.PSTI, "Velox (GL-Z200) June 11, 2027 or later*", "uk_psti"), item(glInet.PSTI, "*Actual Support Periods is 2 years after announcement of EOL", "uk_psti")],
    verification: { status: "unverified" },
    notes: "The page is GL.iNet's PSTI support period table and names no region; recorded as UK, the regime it is published under. The date is the pre-defined minimum, not a guaranteed end.",
  });
  assert.deepEqual(candidates.find((c) => c.id === "gl-inet-gl-s9").aliases, []);
  assert.equal(candidates.find((c) => c.id === "gl-inet-gl-s9").category, "hub");
  assert.deepEqual(candidates.find((c) => c.id === "gl-inet-gl-z300"), {
    id: "gl-inet-gl-z300",
    brand: "GL.iNet",
    brand_slug: "gl-inet",
    model: "GL-Z300",
    aliases: [],
    category: "router",
    regions: ["GLOBAL"],
    support: { rule: "fixed_date", end_date: "2026-10-10", years: null, anchor_date: null, at_least: false, conditions: "Status Maintenance: the model has reached end of life and GL.iNet lists a Supported Until date." },
    evidence: [item(glInet.ENDED, "GL-Z300 3.218 QSDK 15.05.1 Maintenance Oct 10th, 2024 Oct 10th, 2026", "vendor_policy")],
    verification: { status: "unverified" },
    notes: "GL.iNet's firmware versions table (columns Status, EOL Date, Supported Until; page names no region) gives EOL date Oct 10th, 2024 and Supported Until Oct 10th, 2026, recorded as GLOBAL (D24).",
  });
  assert.equal(candidates.length, 3);
  assert.deepEqual(flags, [{ model: "Ferret (GL-Z100)", text: "conflict: GL.iNet's pages both list Ferret (GL-Z100): the PSTI table gives 2027-06-11 or later, the firmware table Supported Until 2028-06-08, a D39 case for a person to record" }]);
  assert.deepEqual(skipped.map((s) => s.reason), [
    '"TBC" does not end with the profile\'s at-least phrase',
    '"Feb 30, 2028 or later*" does not start with a month, day and year',
    "status Ended with no Supported Until date",
    "the EOL Date or Supported Until cell is not a month, day and year",
    "both pages list Ferret (GL-Z100) (D39)",
    "both pages list Ferret (GL-Z100) (D39)",
  ]);
});

test("the Kyocera parser reads the bold model and list blocks, ordinal dates and no-break spaces, and skips what has no date or category", () => {
  const { candidates, skipped } = kyocera.parse({ html: PAGES[kyocera.PAGE], profile: profile("kyocera"), today: TODAY });
  const item = (quote) => ({ url: kyocera.PAGE, quote, retrieved: TODAY, regime: "uk_psti" });
  assert.deepEqual(candidates.find((c) => c.id === "kyocera-ecosys-za9500x"), {
    id: "kyocera-ecosys-za9500x",
    brand: "Kyocera",
    brand_slug: "kyocera",
    model: "ECOSYS ZA9500x",
    aliases: [],
    category: "printer",
    regions: ["UK"],
    support: { rule: "fixed_date", end_date: "2028-01-31", years: null, anchor_date: null, at_least: true, conditions: "Kyocera says support periods are reviewed on a continual basis and extended where it is deemed prudent to do so." },
    evidence: [item("ECOSYS ZA9500x Date of first availability in the UK: Jan-25 End of support date: 31st January 2028"), item("These support periods are reviewed on a continual basis and extended where it is deemed prudent to do so, for the benefit of the consumer. At no point shall the support periods advertised on this webpage be reduced")],
    verification: { status: "unverified" },
    notes: "The page is Kyocera's UK PSTI statement and covers the UK; it says Kyocera's A4 ECOSYS and TASKalfa devices are in scope. The end date is a minimum: the page says the support periods it advertises shall not be reduced.",
  });
  assert.equal(candidates.find((c) => c.id === "kyocera-ecosys-za9500wx").support.end_date, "2027-09-30");
  assert.equal(candidates.length, 3);
  assert.deepEqual(skipped.map((s) => [s.quote.slice(0, 16), s.reason]), [
    ["TASKalfa Z1 Date", 'no category_map entry matches "TASKalfa Z1"'],
    ["ECOSYS Z9999dn D", 'no "End of support date" item with a day, month and year'],
    ["What’s in the bo", 'no "End of support date" item with a day, month and year'],
  ]);
});

test("the ASUS parser splits a group row's models on the markup, quotes from each model to the date, and skips rows without a date or quotes over 300 characters", () => {
  const { candidates, skipped } = asus.parse({ html: PAGES[asus.PAGE], profile: profile("asus"), today: TODAY });
  const item = (quote) => ({ url: asus.PAGE, quote, retrieved: TODAY, regime: "uk_psti" });
  assert.deepEqual(candidates.find((c) => c.id === "asus-zenwifi-zt7-z"), {
    id: "asus-zenwifi-zt7-z",
    brand: "ASUS",
    brand_slug: "asus",
    model: "ZenWiFi ZT7 Z",
    aliases: [],
    category: "mesh-wifi",
    regions: ["UK"],
    support: { rule: "fixed_date", end_date: "2030-12-31", years: null, anchor_date: null, at_least: true, conditions: "ASUS says extended support may be provided after the stated date." },
    evidence: [item("ZenWiFi ZT7 Z 4 years (until 31th December 2030)"), item("ASUS will offer security update support to the networking products complied with UK PSTI(Product Security and Telecommunications Infrastructure Act) until the date specified below. And extended support may be provided after the stated date.")],
    verification: { status: "unverified" },
    notes: "The page is ASUS's UK PSTI security update list for networking products and covers the UK. The date is a minimum: ASUS says extended support may be provided after it. The page writes the date as 31th December 2030.",
  });
  assert.equal(candidates.find((c) => c.id === "asus-4g-zx1").evidence[0].quote, "4G-ZX1 PCE-ZX9 TUF-ZX3000 V2 ZenWiFi ZX6 4 years (until 31th December 2025)");
  assert.equal(candidates.find((c) => c.id === "asus-gt-zx11000").evidence[0].quote, "GT-ZX11000 ZenWiFi ZT7 ZenWiFi ZT7 Z 4 years (until 31th December 2030)");
  assert.equal(candidates.filter((c) => c.model.startsWith("RT-ZX")).length, 16);
  assert.deepEqual(skipped.slice(0, 3), [
    { quote: "PCE-ZX9 4 years (until 31th December 2025)", reason: 'no category_map entry matches "PCE-ZX9"' },
    { quote: "RT-ZX50 Pro Max ZenWiFi ZD4 4 years", reason: '"4 years" gives no day, month and year' },
    { quote: "RT-ZX1 Pro Max 4 years (until 31th December 2028)", reason: "the quote from RT-ZX1 Pro Max to the date is 489 characters, over 300" },
  ]);
  assert.equal(skipped.length, 15);
});
