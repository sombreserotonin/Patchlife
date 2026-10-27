import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildSite, loadRecords, normaliseBasePath, optionsFromEnv, resolveOutDir, timeLeft, unsafeOutDirReason } from "../scripts/build-site.mjs";
import { attachSearch, matchDevices } from "../site/search.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const VALID = join(HERE, "fixtures", "valid");
const SCRIPT = join(ROOT, "scripts", "build-site.mjs");
const TODAY = "2026-10-21";
const NOTICE = readFileSync(join(ROOT, "data", "NOTICE.md"), "utf8");
const ATTRIBUTION = NOTICE.match(/Attribute it as: "([^"]+)"/)[1];
const HOSTILE = '</script><script>alert(1)</script> "><img onerror=alert(2)>';
const DISCLAIMER = "Support information is as published by each manufacturer. It may change and is not advice.";
// The owner approved the H9a wording in #52, so no built file may still flag it as draft.
const H9A_MARKER = /Draft wording|gate H9a/;
const P8_LEAP = "Minimum support period ended on 28 February 2027. Acme may still provide updates. Date as published by Acme (retrieved 1 Oct 2026).";

const fixtures = () => loadRecords(VALID);
const byId = (records, id) => records.find((r) => r.id === id);
const tempDir = (t) => {
  const dir = mkdtempSync(join(tmpdir(), "patchlife-site-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};

// Builds into a temp dir that is removed after the test.
function build(t, { records = fixtures(), ...options } = {}) {
  const outDir = tempDir(t);
  buildSite({ records, outDir, today: TODAY, ...options });
  return { outDir, read: (path) => readFileSync(join(outDir, path), "utf8"), json: (path) => JSON.parse(readFileSync(join(outDir, path), "utf8")) };
}

// The page as a reader sees it: scripts, comments and tags removed, entities decoded, spaces collapsed.
const text = (page) =>
  page
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
const main = (page) => page.slice(page.indexOf("<main"), page.indexOf("</main>"));
const meta = (page) => page.match(/<meta name="description" content="([^"]*)">/)[1].replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

const htmlFiles = (dir) =>
  readdirSync(dir, { recursive: true })
    .filter((name) => name.endsWith(".html"))
    .map((name) => name.split("\\").join("/"))
    .sort();

const ldJson = (page) => {
  const blocks = [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.equal(blocks.length, 1, "expected one JSON-LD block");
  return blocks[0];
};

// Asserts that the approved wording is in the page body as it was, and that the page carries no H9a draft marker.
function assertApproved(page, phrase, label) {
  assert.ok(page.slice(page.indexOf("<body>")).includes(phrase), `${label}: "${phrase}" not found`);
  assert.doesNotMatch(page, H9A_MARKER, `${label} still has an H9a draft marker`);
}

// Just enough DOM for attachSearch: elements record children, href and text.
function fakeDom(t) {
  const saved = globalThis.document;
  t.after(() => (globalThis.document = saved));
  globalThis.document = {
    createElement: (tag) => ({
      tag,
      href: "",
      textContent: "",
      children: [],
      append(...nodes) {
        this.children.push(...nodes);
      },
    }),
  };
  const input = { value: "", listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; } };
  const list = { children: [], replaceChildren(...nodes) { this.children = nodes; } };
  const count = { textContent: "" };
  const type = (value) => {
    input.value = value;
    input.listeners.input();
  };
  const lines = () => list.children.map((li) => li.children.map((c) => (typeof c === "string" ? c : c.textContent)).join(""));
  return { input, list, count, type, lines };
}

function ringStyle() {
  const record = structuredClone(byId(fixtures(), "acme-cam-1"));
  return Object.assign(record, {
    id: "ring-video-doorbell-3",
    brand: "Ring",
    brand_slug: "ring",
    model: "Video Doorbell 3",
    aliases: ["Ring Video Doorbell 3"],
    category: "doorbell",
    regions: ["UK"],
    support: { rule: "fixed_date", end_date: "2027-12-31", years: null, anchor_date: null, at_least: true, conditions: "If bought new on ring.com, at least four years from purchase." },
    evidence: [{ url: "https://ring.com/gb/en/support/articles/ri2p1", quote: "Ring Video Doorbell 3 31 December 2027", retrieved: "2026-10-21", regime: "vendor_policy" }],
    verification: { status: "verified", checked: "2026-10-21" },
  });
}

const SPEC_SENTENCE = "Security updates until at least 31 December 2027, as published by Ring (checked 21 Oct 2026).";

test("a future at-least date uses the SPEC 4 sentence and the model page shows every required fact", (t) => {
  const site = build(t, { records: [ringStyle()] });
  const page = site.read("devices/ring-video-doorbell-3/index.html");
  const words = text(page);
  assert.ok(words.includes(`${SPEC_SENTENCE} UK statement. ${DISCLAIMER}`), words);
  assert.match(words, /Status Supported Status as at 21 Oct 2026\. More than 12 months of the guaranteed minimum left\./);
  assert.match(words, /Time left At least 1 year, 2 months and 10 days/);
  assert.match(words, /Conditions If bought new on ring\.com, at least four years from purchase\./);
  assert.match(page, /<blockquote cite="https:\/\/ring\.com\/gb\/en\/support\/articles\/ri2p1"><p>Ring Video Doorbell 3 31 December 2027<\/p><\/blockquote>/);
  assert.match(page, /<a class="url" href="https:\/\/ring\.com\/gb\/en\/support\/articles\/ri2p1">/);
  // The correction link opens the "Wrong or outdated date" form with the device and this page filled in (C1).
  const correction = page.match(/<a href="(https:\/\/github\.com\/sombreserotonin\/Patchlife\/issues\/new\?[^"]*)">Report a wrong date<\/a>/);
  assert.ok(correction, "the correction link");
  assert.deepEqual(Object.fromEntries(new URL(correction[1].replace(/&amp;/g, "&")).searchParams), {
    template: "wrong-date.yml",
    title: "Correction: Ring Video Doorbell 3",
    device: "Ring Video Doorbell 3",
    "our-page": "https://patchlife.tech/devices/ring-video-doorbell-3/",
  });
  assert.match(page, /<html lang="en-AU">/);
  assert.equal(page.match(/<script/g).length, 1, "a model page has no JavaScript besides JSON-LD");
  const structured = JSON.parse(ldJson(page));
  assert.equal(structured["@type"], "WebPage");
  assert.equal(structured.about.name, "Ring Video Doorbell 3");
  assert.equal(structured.offers, undefined);
});

test("the disclaimer sits right under the answer on model pages, not only in the footer", (t) => {
  const site = build(t);
  for (const id of ["acme-cam-1", "acme-hub-4", "acme-plug-3"]) {
    const body = main(site.read(`devices/${id}/index.html`));
    const at = body.indexOf(DISCLAIMER);
    assert.ok(at > body.indexOf('<p class="answer">') && at < body.indexOf("<dl>"), id);
  }
});

test("a relative rule without an anchor is shown in words with status unknown", (t) => {
  const site = build(t);
  const words = text(site.read("devices/acme-plug-3/index.html"));
  assert.ok(words.includes("Security updates for 3 years after Acme ends sales of this model (date not yet published), as published by Acme (retrieved 1 Oct 2026)."), words);
  assert.match(words, /Status Unknown /);
  assert.match(words, /Time left Not known until Acme publishes the date/);
  assert.equal(site.json("api/v1/devices/acme-plug-3.json").device.status, "unknown");
});

test("a passed at-least date uses the full P8 wording and a Minimum passed badge on model, brand and category pages", (t) => {
  const site = build(t, { today: "2027-03-01" });
  const model = site.read("devices/acme-leap-5/index.html");
  assert.ok(text(model).includes(P8_LEAP), text(model));
  assert.match(text(model), /Status Minimum passed Status as at 1 Mar 2027\. The guaranteed minimum period has passed\./);
  assert.doesNotMatch(text(model), /Security updates until|Status Ended/);
  assert.ok(meta(model).startsWith(P8_LEAP), meta(model));
  assert.ok(JSON.parse(ldJson(model)).description.startsWith(P8_LEAP));
  for (const file of ["brands/acme/index.html", "categories/sensor/index.html"]) {
    const page = site.read(file);
    assert.match(page, /<span class="status minimum_passed">Minimum passed<\/span>/, file);
    assert.ok(text(page).includes(P8_LEAP), file);
  }
});

test("search results use the full P8 wording, the region label, attribution and checked date", (t) => {
  const index = build(t, { today: "2027-03-01" }).json("search-index.json").devices;
  const dom = fakeDom(t);
  attachSearch({ ...dom, devices: index, base: "" });
  dom.type("leap 5");
  assert.deepEqual(dom.lines(), [`Acme Leap 5: Minimum passed. ${P8_LEAP} Policy that names no region.`]);
  dom.type("cam 1");
  assert.deepEqual(dom.lines(), ["Acme Cam 1: Supported. Security updates until at least 30 June 2029, as published by Acme (checked 2 Oct 2026). Australian and UK statements."]);
});

test("region-limited dates are labelled in search, meta and JSON-LD, and GLOBAL is never shown raw", (t) => {
  const records = [...fixtures(), ringStyle()];
  const site = build(t, { records });
  const page = site.read("devices/ring-video-doorbell-3/index.html");
  assert.equal(meta(page), `${SPEC_SENTENCE} UK statement.`);
  assert.equal(JSON.parse(ldJson(page)).description, `${SPEC_SENTENCE} UK statement.`);
  const dom = fakeDom(t);
  attachSearch({ ...dom, devices: site.json("search-index.json").devices, base: "" });
  dom.type("video doorbell 3");
  assert.deepEqual(dom.lines(), [`Ring Video Doorbell 3: Supported. ${SPEC_SENTENCE} UK statement.`]);
  assert.ok(text(site.read("devices/acme-leap-5/index.html")).includes("Policy that names no region."));
  for (const file of htmlFiles(site.outDir)) assert.doesNotMatch(site.read(file), /GLOBAL/, file);
});

test("lists show attribution, the checked date and the region on every row", (t) => {
  const words = text(build(t).read("brands/acme/index.html"));
  assert.ok(words.includes("Acme Cam 1 Supported Security updates until at least 30 June 2029, as published by Acme (checked 2 Oct 2026). Australian and UK statements."), words);
  assert.ok(words.includes("Acme Router 2 Supported Security updates until 31 March 2028, as published by Acme (retrieved 1 Oct 2026). UK statement."), words);
});

test("stale and disputed records are flagged Under review in lists, search and the model page", (t) => {
  const records = fixtures();
  byId(records, "acme-cam-1").verification.status = "stale";
  byId(records, "acme-router-2").verification.status = "disputed";
  const site = build(t, { records });
  const list = text(site.read("brands/acme/index.html"));
  assert.match(list, /Australian and UK statements\. Under review\./);
  assert.match(list, /31 March 2028, as published by Acme \(retrieved 1 Oct 2026\)\. UK statement\. Under review\./);
  assert.equal((list.match(/Under review/g) ?? []).length, 2);
  assert.match(text(site.read("devices/acme-cam-1/index.html")), /Australian and UK statements\. Under review\./);
  const dom = fakeDom(t);
  attachSearch({ ...dom, devices: site.json("search-index.json").devices, base: "" });
  dom.type("ac1");
  assert.match(dom.lines()[0], /Australian and UK statements\. Under review\.$/);
});

test("none_published records say nothing was found, everywhere, with the regions searched", (t) => {
  const site = build(t);
  const found = "No security update period published by Acme was found for this model (searched 1 Oct 2026).";
  const page = site.read("devices/acme-hub-4/index.html");
  const model = text(page);
  assert.ok(model.includes(`${found} Regions searched: Australia.`), model);
  assert.match(model, /Support period No published period found/);
  assert.doesNotMatch(text(main(page)), /statement/i, "no region is labelled a statement when none was found");
  assert.ok(text(site.read("brands/acme/index.html")).includes(`Acme Hub 4 Unknown ${found} Regions searched: Australia.`));
  const dom = fakeDom(t);
  attachSearch({ ...dom, devices: site.json("search-index.json").devices, base: "" });
  dom.type("hub 4");
  assert.deepEqual(dom.lines(), [`Acme Hub 4: Unknown. ${found} Regions searched: Australia.`]);
});

test("at-least wording never overstates the minimum", (t) => {
  const soon = text(build(t).read("devices/acme-leap-5/index.html"));
  assert.match(soon, /Status Ending soon Status as at 21 Oct 2026\. 12 months or less of the guaranteed minimum left\./);

  const lastDay = text(build(t, { today: "2029-06-30" }).read("devices/acme-cam-1/index.html"));
  assert.match(lastDay, /Time left Today is the last guaranteed day/);

  assert.match(text(build(t, { today: "2027-03-01" }).read("devices/acme-leap-5/index.html")), /Time left None guaranteed\. The minimum period has ended\./);
});

// Google limits the scope, TP-Link names a hardware version, Ring's purchase rule can extend the period.
const CONDITIONS = {
  scope: "Covers critical issues that Acme can fix with a remote software update.",
  hardware: "Hardware version V5 only.",
  purchase: "If bought new on acme.com, at least four years from purchase or this date, whichever is later.",
};

// acme-leap-5 (at least, 28 February 2027) with the given condition: its status note, time left, list row, search line and meta.
function leapViews(t, conditions, today) {
  const records = fixtures();
  byId(records, "acme-leap-5").support.conditions = conditions;
  const site = build(t, { records, today });
  const page = site.read("devices/acme-leap-5/index.html");
  const words = text(page);
  const dom = fakeDom(t);
  attachSearch({ ...dom, devices: site.json("search-index.json").devices, base: "" });
  dom.type("leap 5");
  return {
    page,
    words,
    note: words.match(/Status as at [^.]+\. (.+?) Time left/)[1],
    timeLeft: words.match(/Time left (.+?) Support period/)[1],
    list: text(site.read("brands/acme/index.html")),
    search: dom.lines()[0],
    meta: meta(page),
  };
}

test("scope and hardware conditions keep the plain at-least wording everywhere (D23)", (t) => {
  for (const conditions of [CONDITIONS.scope, CONDITIONS.hardware]) {
    const passed = leapViews(t, conditions, "2027-03-01");
    assert.equal(passed.note, "The guaranteed minimum period has passed.", conditions);
    assert.equal(passed.timeLeft, "None guaranteed. The minimum period has ended.", conditions);
    for (const view of [passed.words, passed.list, passed.search, passed.meta]) assert.ok(view.includes(P8_LEAP), `${conditions}: ${view}`);
    assert.equal(leapViews(t, conditions, "2026-10-21").note, "12 months or less of the guaranteed minimum left.", conditions);
    assert.equal(leapViews(t, conditions, "2027-02-28").timeLeft, "Today is the last guaranteed day", conditions);
  }
});

const HEDGE = "The published minimum date, 28 February 2027, has passed. Some buyers get longer: see Conditions. Acme may still provide updates. Date as published by Acme (retrieved 1 Oct 2026).";

test("a condition that can extend the period (whichever is later) gets one hedge everywhere", (t) => {
  const passed = leapViews(t, CONDITIONS.purchase, "2027-03-01");
  assert.equal(passed.note, "The published minimum date has passed. Some buyers get longer: see Conditions.");
  assert.equal(passed.timeLeft, "Some buyers get longer: see Conditions.");
  for (const view of [passed.words, passed.list, passed.search, passed.meta]) {
    assert.ok(view.includes(HEDGE), view);
    assert.doesNotMatch(view, /None guaranteed|guaranteed minimum|to this date|Minimum support period ended/);
  }
  assert.ok(JSON.parse(ldJson(passed.page)).description.startsWith(HEDGE));
  assertApproved(passed.page, "The published minimum date, 28 February 2027, has passed.", "answer");
  assertApproved(passed.page, "The published minimum date has passed.", "status note");
  assert.ok(passed.page.includes("<dd>Some buyers get longer: see Conditions.</dd>"), "time left has no marker");

  const soon = leapViews(t, CONDITIONS.purchase, "2026-10-21");
  assert.equal(soon.note, "12 months or less until the published minimum date. Some buyers get longer: see Conditions.");
  assertApproved(soon.page, "12 months or less until the published minimum date.", "ending soon note");
  assert.equal(soon.timeLeft, "At least 4 months and 7 days", "the published minimum is still a floor for every buyer");

  const lastDay = leapViews(t, CONDITIONS.purchase, "2027-02-28");
  assert.equal(lastDay.timeLeft, "Today is the published minimum date. Some buyers get longer: see Conditions.");
  assert.ok(lastDay.page.includes("<dd>Today is the published minimum date."), "last day has no marker");
});

test("status notes for a date without at least say when updates end", (t) => {
  const note = (today) => text(build(t, { today }).read("devices/acme-router-2/index.html")).match(/Status as at [^.]+\. ([^.]+\.)/)[1];
  assert.equal(note("2026-10-21"), "More than 12 months of security updates left.");
  assert.equal(note("2027-06-01"), "12 months or less of security updates left.");
  assert.equal(note("2028-04-01"), "The end date has passed.");
});

test("anchors are described as the date the brand gives", (t) => {
  const site = build(t);
  assert.match(text(site.read("devices/acme-leap-5/index.html")), /Support period At least 3 years after the launch or first-sale date Acme gives for this model, 29 February 2024/);
  assert.match(text(site.read("devices/acme-router-2/index.html")), /Support period 3 years after the end-of-sale or end-of-life date Acme gives for this model, 31 March 2025/);
});

test("the methodology says an at-least end date is a published minimum, which some buyers may outlast", (t) => {
  const page = build(t).read("methodology/index.html");
  const words = text(page);
  const sentence =
    'An end date is the last day of the stated period. When the source says "at least", the date is the minimum the manufacturer publishes: updates may continue after it, and some manufacturers give some buyers longer.';
  assert.ok(words.includes(sentence), words);
  assertApproved(page, "An end date is the last day of the stated period.", "methodology");
  assert.doesNotMatch(words, /An end date is the last day of support\.|it is the last guaranteed day/);
});

test("quote claims cover dates, not answers that found nothing", (t) => {
  const site = build(t);
  const about = text(site.read("about/index.html"));
  assert.match(about, /with a quote and a link for every date\./);
  assert.doesNotMatch(about, /every answer/);
  const methodology = text(site.read("methodology/index.html"));
  assert.match(methodology, /Each record that gives a date or rule quotes, word for word,/);
  assert.doesNotMatch(methodology, /Each record quotes/);
  assert.match(text(site.read("index.html")), /Every date quotes the manufacturer's statement and links to it\./);
});

test("both JSON files carry the licence, attribution, build date and computed status", (t) => {
  const site = build(t);
  const all = site.json("api/v1/devices.json");
  const one = site.json("api/v1/devices/acme-cam-1.json");
  for (const body of [all, one]) {
    assert.equal(body.license, "ODbL-1.0");
    assert.equal(body.attribution, ATTRIBUTION);
    assert.equal(body.build_date, TODAY);
  }
  assert.equal(all.devices.length, 5);
  assert.deepEqual(Object.fromEntries(all.devices.map((d) => [d.id, d.status])), {
    "acme-cam-1": "supported",
    "acme-hub-4": "unknown",
    "acme-leap-5": "ending_soon",
    "acme-plug-3": "unknown",
    "acme-router-2": "supported",
  });
  assert.equal(one.device.id, "acme-cam-1");
  assert.equal(one.device.status, "supported");
  assert.equal(one.device.evidence[0].quote, "Acme Cam 1 30 June 2029");
});

test("the sitemap lists every HTML page and nothing else", (t) => {
  const site = build(t);
  const pages = htmlFiles(site.outDir).map((file) => `https://patchlife.tech/${file.replace(/index\.html$/, "")}`);
  const locs = [...site.read("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
  assert.deepEqual(locs, pages.sort());
  assert.equal(pages.length, 1 + 5 + 1 + 5 + 4, "home, 5 models, 1 brand, 5 categories, 4 info pages");
  assert.equal(site.read("robots.txt"), "User-agent: *\nAllow: /\n\nSitemap: https://patchlife.tech/sitemap.xml\n");
});

test("NOINDEX puts noindex on every page and keeps them crawlable, with no sitemap in robots.txt", (t) => {
  const hidden = build(t, { noindex: true });
  for (const file of htmlFiles(hidden.outDir)) assert.match(hidden.read(file), /<meta name="robots" content="noindex">/, file);
  assert.equal(hidden.read("robots.txt"), "User-agent: *\nAllow: /\n", "crawlers must reach the pages to see noindex");
  assert.ok(!existsSync(join(hidden.outDir, "sitemap.xml")), "no sitemap for a site that asks not to be indexed");
  const open = build(t);
  for (const file of htmlFiles(open.outDir)) assert.doesNotMatch(open.read(file), /name="robots"/, file);
  assert.equal(optionsFromEnv({ NOINDEX: "1" }).noindex, true);
  assert.equal(optionsFromEnv({ NOINDEX: "true" }).noindex, true);
  assert.equal(optionsFromEnv({ NOINDEX: "0" }).noindex, false);
  assert.equal(optionsFromEnv({ NOINDEX: "" }).noindex, false);
  assert.equal(optionsFromEnv({}).noindex, false);
});

test("every page has the licence footer, the attribution line and the status date", (t) => {
  const site = build(t);
  for (const file of htmlFiles(site.outDir)) {
    const page = site.read(file);
    assert.match(page, /<a href="https:\/\/github\.com\/sombreserotonin\/Patchlife">Source code on GitHub<\/a>/, file);
    assert.match(page, /<a href="https:\/\/github\.com\/sombreserotonin\/Patchlife\/blob\/main\/LICENSE">AGPL-3\.0-or-later<\/a>/, file);
    assert.match(page, /<a href="https:\/\/opendatacommons\.org\/licenses\/odbl\/1-0\/">ODbL 1\.0<\/a>/, file);
    assert.ok(page.includes(ATTRIBUTION), file);
    assert.match(text(page), /Status as at 21 Oct 2026\./, file);
    assert.doesNotMatch(page, /[\u2013\u2014]/, `${file} has an en or em dash`);
  }
});

test("no built file carries an H9a draft marker, and the approved wording stays", (t) => {
  const site = build(t, { today: "2027-03-01" });
  const files = readdirSync(site.outDir, { recursive: true }).filter((name) => lstatSync(join(site.outDir, name)).isFile());
  assert.ok(files.includes("search.js"), "the copied search script is checked too");
  for (const file of files) assert.doesNotMatch(site.read(file), H9A_MARKER, `${file} still has an H9a draft marker`);
  for (const file of htmlFiles(site.outDir)) {
    const page = site.read(file);
    assertApproved(page, DISCLAIMER, file);
    assertApproved(page, "Quoted manufacturer statements remain the property of their owners", file);
  }
  assertApproved(site.read("brands/acme/index.html"), "Minimum support period ended on", "brand page P8 copy");
  const about = site.read("about/index.html");
  assertApproved(about, "Australia's smart device rules apply", "about");
  assertApproved(about, "Claude Code, an AI coding tool", "about");
  assertApproved(site.read("methodology/index.html"), "The source gave a minimum period", "methodology");
});

test("the privacy page carries the approved text and every page links to it", (t) => {
  const site = build(t);
  const privacy = site.read("privacy/index.html");
  assertApproved(privacy, "Patchlife doesn't collect information about you.", "privacy");
  assertApproved(privacy, "The site sets no cookies and runs no advertising or tracking scripts. Cloudflare Web Analytics counts page views without cookies; Cloudflare says it does not collect or use visitors' personal data.", "privacy");
  assertApproved(privacy, `Cloudflare delivers the site and handles visitors' IP addresses to do so. <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare's privacy policy</a> explains how.`, "privacy");
  assert.doesNotMatch(privacy, /runs no analytics/);
  assertApproved(privacy, "regardless of whether the visitor has signed into GitHub or not.", "privacy");
  assert.match(privacy, /<a href="mailto:admin@sombrexo\.com">admin@sombrexo\.com<\/a>, or open an issue at <a href="https:\/\/github\.com\/sombreserotonin\/Patchlife\/issues">/);
  for (const file of htmlFiles(site.outDir)) assert.match(site.read(file), /<a href="\/privacy\/">Privacy<\/a>/, file);
});

test("a month-only end date shows the month and year, never a day (D38)", (t) => {
  const record = (id, end_date, at_least) => {
    const r = ringStyle();
    return Object.assign(r, { id, model: id, aliases: [], support: { ...r.support, end_date, at_least, conditions: null } });
  };
  const site = build(t, { records: [record("future", "2027-06", true), record("ended", "2026-06", false), record("passed", "2026-06", true)] });
  const future = site.read("devices/future/index.html");
  assert.ok(text(future).includes("Security updates until at least June 2027, as published by Ring (checked 21 Oct 2026)."), text(future));
  assert.match(future, /At least until <time datetime="2027-06">June 2027<\/time>/);
  assert.match(text(future), /Time left At least until June 2027\. Ring gives the month, not the day\./);
  assert.match(text(site.read("devices/ended/index.html")), /Security updates ended in June 2026, as published by Ring/);
  assert.match(text(site.read("devices/passed/index.html")), /Minimum support period ended in June 2026\. Ring may still provide updates\./);
  for (const file of htmlFiles(site.outDir)) assert.doesNotMatch(text(site.read(file)), /\d+ June 202[67]|Invalid Date/, file);
});

test("coverage claims come from the categories that have records", (t) => {
  const site = build(t, { records: [ringStyle()] });
  assert.match(text(site.read("index.html")), /So far it covers 1 device: doorbells\./);
  const about = text(site.read("about/index.html"));
  assert.match(about, /So far it covers doorbells\./);
  assert.doesNotMatch(about, /router|printer|smart plug/i);
  assert.match(text(build(t).read("index.html")), /So far it covers 5 devices: cameras, smart home hubs, routers, sensors and smart plugs\./);
});

test("BASE_PATH, SITE_URL and BUILD_DATE from the environment shape links, and every internal link resolves", (t) => {
  const outDir = tempDir(t);
  const run = spawnSync(process.execPath, [SCRIPT, outDir, VALID], {
    encoding: "utf8",
    env: { ...process.env, BASE_PATH: "/Patchlife/", SITE_URL: " https://example.org/\n", BUILD_DATE: "2027-03-01", NOINDEX: "" },
  });
  assert.equal(run.status, 0, run.stderr);
  const read = (path) => readFileSync(join(outDir, path), "utf8");
  const resolves = (path, from) => {
    assert.ok(path.startsWith("/Patchlife/"), `${from}: ${path}`);
    const local = path.slice("/Patchlife".length);
    assert.ok(existsSync(join(outDir, local.endsWith("/") ? `${local}index.html` : local)), `${from}: ${path} does not resolve`);
  };
  const home = read("index.html");
  assert.match(home, /data-base="\/Patchlife"/);
  const loaderPaths = [...home.matchAll(/base \+ "(\/[^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(loaderPaths.sort(), ["/search-index.json", "/search.js"]);
  // A search link (M5, D46) is read on load; what is typed never goes into the URL, so the privacy page stays true.
  assert.match(home, /const query = new URLSearchParams\(location\.search\)\.get\("q"\);/);
  assert.doesNotMatch(home, /history\.(pushState|replaceState)|location\.(search|hash) =/);
  for (const path of loaderPaths) resolves(`/Patchlife${path}`, "search loader");
  assert.equal(read("search.js"), readFileSync(join(ROOT, "site", "search.js"), "utf8"));
  for (const file of htmlFiles(outDir)) {
    const page = read(file);
    const links = [...page.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1]);
    assert.ok(links.length > 0, file);
    for (const href of links) resolves(href, file);
    const canonical = page.match(/<link rel="canonical" href="https:\/\/example\.org(\/[^"]*)">/);
    assert.ok(canonical, file);
    resolves(canonical[1], `${file} canonical`);
    assert.match(text(page), /Status as at 1 Mar 2027\./, file);
  }
  for (const [, path] of read("sitemap.xml").matchAll(/<loc>https:\/\/example\.org(\/[^<]+)<\/loc>/g)) resolves(path, "sitemap");
  assert.match(read("robots.txt"), /Sitemap: https:\/\/example\.org\/Patchlife\/sitemap\.xml/);
  assert.equal(JSON.parse(read("api/v1/devices.json")).build_date, "2027-03-01");
  const about = text(read("about/index.html"));
  assert.ok(about.includes("/Patchlife/api/v1/devices.json") && about.includes("/Patchlife/api/v1/devices/<id>.json"), about);
});

test("attachSearch renders base-prefixed links and replaces results on each input", (t) => {
  const index = build(t).json("search-index.json").devices;
  const dom = fakeDom(t);
  dom.input.value = "ac1";
  attachSearch({ ...dom, devices: index, base: "/Patchlife" });
  assert.equal(dom.list.children.length, 1, "searches the value typed before the script loaded");
  assert.equal(dom.list.children[0].children[0].href, "/Patchlife/devices/acme-cam-1/");
  assert.equal(dom.count.textContent, "1 device found.");
  dom.type("acme");
  assert.equal(dom.list.children.length, 5);
  assert.equal(dom.count.textContent, "5 devices found.");
  dom.type("zzz");
  assert.equal(dom.list.children.length, 0);
  assert.match(dom.count.textContent, /^No devices found\./);
  dom.type("  ");
  assert.equal(dom.count.textContent, "");
});

// Runs the home page's inline search loader with a fake document, location, import() and fetch(), and records what it
// asks for. search is the page URL's query string, "?q=..." for a search link.
function runLoader(page, { fetchOk = true, search = "" } = {}) {
  const code = page.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  const element = (props = {}) => ({ listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; }, ...props });
  const form = element({ dataset: { base: page.match(/data-base="([^"]*)"/)[1] } });
  const input = element({ value: "" });
  const count = { textContent: "" };
  const list = {};
  const nodes = { search: form, q: input, "search-count": count, "search-results": list };
  const calls = { imports: [], fetches: [], attached: [] };
  const fakeImport = async (url) => {
    calls.imports.push(url);
    return { attachSearch: (options) => calls.attached.push(options) };
  };
  const fakeFetch = async (url) => {
    calls.fetches.push(url);
    return fetchOk ? { ok: true, json: async () => ({ devices: ["d"] }) } : { ok: false, status: 404 };
  };
  new Function("document", "loadModule", "fetch", "location", code.replace(/\bimport\(/g, "loadModule("))({ getElementById: (id) => nodes[id] }, fakeImport, fakeFetch, { search });
  const settle = () => new Promise((done) => setTimeout(done, 0));
  return { form, input, count, list, calls, settle };
}

test("the home page search loader loads lazily from the base path and wires up attachSearch", async (t) => {
  const home = build(t, { basePath: "/Patchlife" }).read("index.html");
  for (const trigger of ["focus", "input"]) {
    const loader = runLoader(home);
    await loader.settle();
    assert.deepEqual(loader.calls.imports, [], "nothing loads before the search box is used");
    loader.input.listeners[trigger]();
    loader.input.listeners[trigger]();
    await loader.settle();
    assert.deepEqual(loader.calls.imports, ["/Patchlife/search.js"], trigger);
    assert.deepEqual(loader.calls.fetches, ["/Patchlife/search-index.json"], trigger);
    assert.equal(loader.calls.attached.length, 1, trigger);
    const options = loader.calls.attached[0];
    assert.equal(options.input, loader.input);
    assert.equal(options.count, loader.count);
    assert.equal(options.list, loader.list);
    assert.deepEqual(options.devices, ["d"]);
    assert.equal(options.base, "/Patchlife");
  }
  const loader = runLoader(home);
  let prevented = false;
  loader.form.listeners.submit({ preventDefault: () => (prevented = true) });
  assert.ok(prevented, "submitting the search form does not reload the page");
});

test("a search link fills the box and runs the search on load; without one nothing loads (M5, D46)", async (t) => {
  const home = build(t, { basePath: "/Patchlife" }).read("index.html");
  const linked = runLoader(home, { search: "?q=Tapo%20C200" });
  await linked.settle();
  assert.equal(linked.input.value, "Tapo C200", "decoded, as the box would show it");
  assert.deepEqual(linked.calls.imports, ["/Patchlife/search.js"]);
  assert.deepEqual(linked.calls.fetches, ["/Patchlife/search-index.json"]);
  assert.equal(linked.calls.attached.length, 1, "attachSearch searches the box's value as soon as it is wired up");
  for (const search of ["", "?q=", "?page=2"]) {
    const plain = runLoader(home, { search });
    await plain.settle();
    assert.equal(plain.input.value, "", search);
    assert.deepEqual(plain.calls.imports, [], `nothing loads for "${search}"`);
  }
});

test("the search loader says when search cannot load, and tries again on the next focus", async (t) => {
  const loader = runLoader(build(t).read("index.html"), { fetchOk: false });
  loader.input.listeners.focus();
  await loader.settle();
  assert.equal(loader.count.textContent, "Search could not load. You can still browse by brand or category below.");
  assert.equal(loader.calls.attached.length, 0);
  loader.input.listeners.focus();
  await loader.settle();
  assert.equal(loader.calls.fetches.length, 2, "a failed load is retried");
});

test("SITE_URL is trimmed and must be an http or https origin, with any path in BASE_PATH", () => {
  assert.equal(optionsFromEnv({ SITE_URL: " https://example.org/ \n" }).siteUrl, "https://example.org");
  assert.equal(optionsFromEnv({ SITE_URL: "http://localhost:8080" }).siteUrl, "http://localhost:8080");
  assert.equal(optionsFromEnv({ SITE_URL: "HTTPS://Example.ORG:443/" }).siteUrl, "https://example.org", "normalised to the origin");
  assert.equal(optionsFromEnv({}).siteUrl, "https://patchlife.tech");
  for (const path of ["https://example.org/preview/", "https://sombreserotonin.github.io/Patchlife"]) {
    assert.throws(() => optionsFromEnv({ SITE_URL: path }), /SITE_URL .* put the path in BASE_PATH/, path);
  }
  for (const bad of ["https://exa mple.org", "ftp://example.org", "https://example.org/?q=1", "https://example.org/#top", "example.org"]) {
    assert.throws(() => optionsFromEnv({ SITE_URL: bad }), /SITE_URL/, bad);
  }
});

test("BASE_PATH has no . or .. segments", () => {
  assert.equal(normaliseBasePath("Patchlife/"), "/Patchlife");
  assert.equal(normaliseBasePath("/a.b/c"), "/a.b/c");
  for (const bad of ["/.", "/..", "/a/../b", "./x", "/a/./b", "/a b"]) assert.throws(() => normaliseBasePath(bad), /BASE_PATH/, bad);
});

test("BUILD_DATE must be a real calendar date, and the error names it", (t) => {
  for (const bad of ["2027-02-31", "2026-02-29", "2026-13-45", "2026-1-01"]) {
    assert.throws(() => build(t, { today: bad }), /BUILD_DATE/, bad);
    assert.throws(() => optionsFromEnv({ BUILD_DATE: bad }), new RegExp(`^Error: BUILD_DATE "${bad}" must be a real date`), bad);
  }
  assert.doesNotThrow(() => build(t, { today: "2028-02-29" }));
});

test("the CLI refuses an output dir that is the cwd or holds it, and keeps the files there", (t) => {
  const tmp = tempDir(t);
  const work = join(tmp, "a", "work");
  mkdirSync(work, { recursive: true });
  writeFileSync(join(work, "canary.txt"), "keep");
  for (const outArg of [work, join(tmp, "a"), "."]) {
    const run = spawnSync(process.execPath, [SCRIPT, outArg, VALID], { cwd: work, encoding: "utf8" });
    assert.equal(run.status, 1, `${outArg}: ${run.stdout}`);
    assert.match(run.stderr, /^build-site: refusing to empty .+\n$/, outArg);
    assert.ok(existsSync(join(work, "canary.txt")), `${outArg} deleted the canary`);
  }
});

test("the CLI refuses an output dir that holds the device records", (t) => {
  const devices = join(tempDir(t), "devices");
  cpSync(VALID, devices, { recursive: true });
  const run = spawnSync(process.execPath, [SCRIPT, devices, devices], { encoding: "utf8" });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /^build-site: refusing to empty .+\n$/);
  assert.equal(loadRecords(devices).length, 5);
});

test("an empty or blank outDir argument means the default, never the cwd", (t) => {
  assert.equal(resolveOutDir(""), join(ROOT, "_site"));
  assert.equal(resolveOutDir("  \t"), join(ROOT, "_site"));
  assert.equal(resolveOutDir(undefined), join(ROOT, "_site"));
  const work = tempDir(t);
  writeFileSync(join(work, "canary.txt"), "keep");
  const run = spawnSync(process.execPath, [SCRIPT, "", join(work, "missing")], { cwd: work, encoding: "utf8" });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /^build-site: devices directory not found: .+\n$/);
  assert.ok(existsSync(join(work, "canary.txt")));
});

test("unsafeOutDirReason protects the repo, the cwd, their parents and the records", () => {
  const options = { cwd: join(ROOT, "scripts"), root: ROOT, devicesDir: join(ROOT, "data", "devices") };
  for (const dir of [ROOT, dirname(ROOT), "/", join(ROOT, "scripts"), join(ROOT, "data"), join(ROOT, "data", "devices")]) {
    assert.ok(unsafeOutDirReason(dir, options), dir);
  }
  for (const dir of [join(ROOT, "_site"), join(tmpdir(), "patchlife-out"), join(ROOT, "data-out")]) {
    assert.equal(unsafeOutDirReason(dir, options), null, dir);
  }
});

// The feed an empty build would write: the fields isEarlierBuild checks.
const FEED = { license: "ODbL-1.0", license_url: "https://opendatacommons.org/licenses/odbl/1-0/", attribution: ATTRIBUTION, notice_url: "https://example.org/NOTICE.md", build_date: TODAY, count: 0, devices: [] };

// Every path under dir, sorted, so a test can check that a refused folder is left exactly as it was.
const snapshot = (dir) => readdirSync(dir, { recursive: true }).map((p) => p.split("\\").join("/")).sort();

test("each unsafeOutDirReason guard refuses on its own, even for an earlier build", (t) => {
  const earlier = tempDir(t);
  mkdirSync(join(earlier, "api", "v1"), { recursive: true });
  writeFileSync(join(earlier, "api", "v1", "devices.json"), JSON.stringify(FEED));
  mkdirSync(join(earlier, "devices"));
  const elsewhere = tempDir(t);
  const safe = { cwd: elsewhere, root: elsewhere, devicesDir: join(elsewhere, "records") };
  assert.equal(unsafeOutDirReason(earlier, safe), null, "an earlier build may be emptied");
  assert.match(unsafeOutDirReason(earlier, { ...safe, cwd: join(earlier, "devices") }), /current directory/);
  assert.match(unsafeOutDirReason(earlier, { ...safe, root: join(earlier, "devices") }), /repository/);
  assert.match(unsafeOutDirReason(earlier, { ...safe, devicesDir: join(earlier, "devices") }), /device records/);
});

test("the CLI empties an earlier build first, so a removed record leaves no pages behind", (t) => {
  const tmp = tempDir(t);
  const outDir = join(tmp, "out");
  const devices = join(tmp, "devices");
  cpSync(VALID, devices, { recursive: true });
  const build = () => spawnSync(process.execPath, [SCRIPT, outDir, devices], { encoding: "utf8", env: { ...process.env, BUILD_DATE: TODAY } });
  assert.equal(build().status, 0);
  assert.ok(existsSync(join(outDir, "devices", "acme-hub-4", "index.html")));
  rmSync(join(devices, "acme", "acme-hub-4.yaml"));
  const run = build();
  assert.equal(run.status, 0, run.stderr);
  assert.ok(!existsSync(join(outDir, "devices", "acme-hub-4")));
  assert.ok(!existsSync(join(outDir, "api", "v1", "devices", "acme-hub-4.json")));
  assert.ok(existsSync(join(outDir, "devices", "acme-cam-1", "index.html")));
});

test("the CLI refuses a non-empty folder that is not an earlier build", (t) => {
  const outDir = tempDir(t);
  writeFileSync(join(outDir, "notes.txt"), "keep");
  const run = spawnSync(process.execPath, [SCRIPT, outDir, VALID], { encoding: "utf8" });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /^build-site: refusing to empty .+: it is not empty and is not an earlier site build\n$/);
  assert.ok(existsSync(join(outDir, "notes.txt")));
});

test("the CLI refuses an earlier build that also holds other files, and keeps them", (t) => {
  const outDir = join(tempDir(t), "out");
  const build = () => spawnSync(process.execPath, [SCRIPT, outDir, VALID], { encoding: "utf8", env: { ...process.env, BUILD_DATE: TODAY } });
  assert.equal(build().status, 0);
  mkdirSync(join(outDir, ".git"));
  writeFileSync(join(outDir, ".git", "HEAD"), "ref: refs/heads/gh-pages\n");
  writeFileSync(join(outDir, "CNAME"), "patchlife.tech\n");
  const run = build();
  assert.equal(run.status, 1);
  assert.match(run.stderr, /^build-site: refusing to empty .+: it is not empty and is not an earlier site build\n$/);
  assert.ok(existsSync(join(outDir, ".git", "HEAD")) && existsSync(join(outDir, "CNAME")));
});

test("a folder is an earlier build only when its feed has the shape the build writes", (t) => {
  const options = { cwd: tmpdir(), root: ROOT, devicesDir: VALID };
  const withFeed = (feed) => {
    const dir = tempDir(t);
    mkdirSync(join(dir, "api", "v1"), { recursive: true });
    writeFileSync(join(dir, "api", "v1", "devices.json"), feed);
    return dir;
  };
  assert.equal(unsafeOutDirReason(withFeed(JSON.stringify(FEED)), options), null, "the full shape passes");
  const forged = [
    "{}",
    "not json",
    "[]",
    JSON.stringify({ license: "ODbL-1.0", build_date: TODAY }),
    JSON.stringify({ ...FEED, license: "MIT" }),
    JSON.stringify({ ...FEED, build_date: "2027-02-31" }),
    JSON.stringify({ ...FEED, devices: {} }),
    JSON.stringify({ ...FEED, devices: "abc", count: 3 }),
    JSON.stringify({ ...FEED, count: 3 }),
    JSON.stringify({ ...FEED, attribution: "" }),
    JSON.stringify({ ...FEED, license_url: undefined }),
    JSON.stringify({ ...FEED, notice_url: 7 }),
  ];
  for (const feed of forged) assert.match(unsafeOutDirReason(withFeed(feed), options) ?? "", /not an earlier site build/, feed);
});

test("a folder is an earlier build only when every path in it is one the build writes", (t) => {
  const options = { cwd: tmpdir(), root: ROOT, devicesDir: VALID };
  const earlier = () => {
    const dir = join(tempDir(t), "out");
    buildSite({ records: fixtures(), outDir: dir, today: TODAY });
    return dir;
  };
  assert.equal(unsafeOutDirReason(earlier(), options), null, "a real build passes");
  const extras = {
    "nested file": (dir) => writeFileSync(join(dir, "devices", "notes.txt"), "keep"),
    "file in a model folder": (dir) => writeFileSync(join(dir, "devices", "acme-cam-1", "draft.md"), "keep"),
    "nested .git": (dir) => mkdirSync(join(dir, "api", ".git")),
    "dotfile at the top": (dir) => writeFileSync(join(dir, ".nojekyll"), ""),
    "extra api file": (dir) => writeFileSync(join(dir, "api", "v1", "keys.json"), "{}"),
    "folder named like a slug file": (dir) => mkdirSync(join(dir, "api", "v1", "devices", "acme-x.json")),
    "file where a model folder goes": (dir) => writeFileSync(join(dir, "brands", "acme-x"), "keep"),
    "symlink inside": (dir) => symlinkSync(tmpdir(), join(dir, "devices", "acme-link")),
    "symlink at a build file's path": (dir) => {
      rmSync(join(dir, "robots.txt"));
      symlinkSync(join(tmpdir(), "elsewhere.txt"), join(dir, "robots.txt"));
    },
  };
  for (const [name, add] of Object.entries(extras)) {
    const dir = earlier();
    add(dir);
    assert.match(unsafeOutDirReason(dir, options) ?? "", /not an earlier site build/, name);
  }
});

test("the CLI refuses an earlier build with a nested extra, a nested .git or a forged feed, and keeps every file", (t) => {
  const cases = {
    "nested extra file": (dir) => writeFileSync(join(dir, "devices", "notes.txt"), "keep"),
    "nested .git": (dir) => {
      mkdirSync(join(dir, "api", ".git"));
      writeFileSync(join(dir, "api", ".git", "HEAD"), "ref: refs/heads/main\n");
    },
  };
  for (const [name, add] of Object.entries(cases)) {
    const outDir = join(tempDir(t), "out");
    assert.equal(spawnSync(process.execPath, [SCRIPT, outDir, VALID], { encoding: "utf8", env: { ...process.env, BUILD_DATE: TODAY } }).status, 0);
    add(outDir);
    const before = snapshot(outDir);
    const run = spawnSync(process.execPath, [SCRIPT, outDir, VALID], { encoding: "utf8", env: { ...process.env, BUILD_DATE: TODAY } });
    assert.equal(run.status, 1, name);
    assert.match(run.stderr, /^build-site: refusing to empty .+: it is not empty and is not an earlier site build\n$/, name);
    assert.deepEqual(snapshot(outDir), before, `${name}: every file survives`);
  }
  const forged = tempDir(t);
  mkdirSync(join(forged, "api", "v1"), { recursive: true });
  writeFileSync(join(forged, "api", "v1", "devices.json"), JSON.stringify({ license: "ODbL-1.0", build_date: TODAY }));
  mkdirSync(join(forged, "devices", "work"), { recursive: true });
  writeFileSync(join(forged, "devices", "work", "index.html"), "my own page");
  writeFileSync(join(forged, "index.html"), "my own home page");
  const before = snapshot(forged);
  const run = spawnSync(process.execPath, [SCRIPT, forged, VALID], { encoding: "utf8" });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /not an earlier site build\n$/);
  assert.deepEqual(snapshot(forged), before, "forged feed: every file survives");
  assert.equal(readFileSync(join(forged, "index.html"), "utf8"), "my own home page");
});

test("the CLI refuses a symlinked output folder whose target is missing", (t) => {
  const tmp = tempDir(t);
  const link = join(tmp, "out");
  symlinkSync(join(tmp, "missing"), link);
  const run = spawnSync(process.execPath, [SCRIPT, link, VALID], { encoding: "utf8" });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /^build-site: refusing to empty .+: it is a symlink whose target is missing\n$/);
  assert.ok(lstatSync(link).isSymbolicLink());
});

test("importing the module never runs the CLI", (t) => {
  const outDir = join(tempDir(t), "out");
  const code = `await import(${JSON.stringify(pathToFileURL(SCRIPT).href)});`;
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", code, SCRIPT, outDir, VALID], { encoding: "utf8", env: { ...process.env, BUILD_DATE: TODAY } });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout, "");
  assert.ok(!existsSync(outDir), "nothing was built");
});

test("the CLI rebuilds through a symlinked output folder and keeps the link", (t) => {
  const tmp = tempDir(t);
  const real = join(tmp, "real");
  const linked = join(tmp, "linked");
  const devices = join(tmp, "devices");
  cpSync(VALID, devices, { recursive: true });
  const build = (outDir) => spawnSync(process.execPath, [SCRIPT, outDir, devices], { encoding: "utf8", env: { ...process.env, BUILD_DATE: TODAY } });
  assert.equal(build(real).status, 0);
  symlinkSync(real, linked);
  rmSync(join(devices, "acme", "acme-hub-4.yaml"));
  const run = build(linked);
  assert.equal(run.status, 0, run.stderr);
  assert.ok(lstatSync(linked).isSymbolicLink(), "the link is kept");
  assert.ok(!existsSync(join(real, "devices", "acme-hub-4")), "the old page is gone from the target");
  assert.ok(existsSync(join(real, "devices", "acme-cam-1", "index.html")));
});

test("the CLI runs when the script is reached through a symlink", (t) => {
  const tmp = tempDir(t);
  const link = join(tmp, "build-site.mjs");
  symlinkSync(SCRIPT, link);
  const outDir = join(tmp, "out");
  const run = spawnSync(process.execPath, [link, outDir, VALID], { encoding: "utf8", env: { ...process.env, BUILD_DATE: TODAY } });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /16 page\(s\) for 5 record\(s\)/);
  assert.ok(existsSync(join(outDir, "index.html")));
});

test("the CLI fails on an empty devices dir, and a bad record names its file", (t) => {
  const tmp = tempDir(t);
  mkdirSync(join(tmp, "empty"));
  const run = spawnSync(process.execPath, [SCRIPT, join(tmp, "out"), join(tmp, "empty")], { encoding: "utf8" });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /^build-site: no device records found in .+\n$/);
  assert.ok(!existsSync(join(tmp, "out")), "nothing is written when there is nothing to build");
  mkdirSync(join(tmp, "bad", "acme"), { recursive: true });
  writeFileSync(join(tmp, "bad", "acme", "acme-x.yaml"), "id: [unclosed\n");
  assert.throws(() => loadRecords(join(tmp, "bad")), /acme-x\.yaml/);
  writeFileSync(join(tmp, "bad", "acme", "acme-x.yaml"), "");
  assert.throws(() => loadRecords(join(tmp, "bad")), /acme-x\.yaml: not a device record/);
});

test("a hostile quote, model, alias and condition render inert in HTML and JSON-LD", (t) => {
  const records = fixtures();
  const cam = byId(records, "acme-cam-1");
  cam.model = `Cam 1 ${HOSTILE}`;
  cam.aliases = [HOSTILE];
  cam.evidence[0].quote = HOSTILE;
  cam.support.conditions = HOSTILE;
  const site = build(t, { records });
  for (const file of ["devices/acme-cam-1/index.html", "brands/acme/index.html", "categories/camera/index.html"]) {
    const page = site.read(file);
    assert.doesNotMatch(page, /<img/i, file);
    assert.doesNotMatch(page, /<script>/, file);
    assert.doesNotMatch(page, /alert\(1\)<\/script>/, file);
  }
  const page = site.read("devices/acme-cam-1/index.html");
  assert.ok(page.includes("<p>&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt; &quot;&gt;&lt;img onerror=alert(2)&gt;</p>"));
  assert.equal(page.match(/<script/g).length, 1);
  const block = ldJson(page);
  assert.doesNotMatch(block, /[<>]/);
  const structured = JSON.parse(block);
  assert.equal(structured.citation[0].text, HOSTILE, "JSON-LD keeps the quote's exact text");
  assert.equal(structured.about.name, `Acme Cam 1 ${HOSTILE}`);
  assert.equal(site.json("api/v1/devices/acme-cam-1.json").device.evidence[0].quote, HOSTILE);
});

test("a URL that is not https is shown as text, never as a link", (t) => {
  const records = fixtures();
  const cam = byId(records, "acme-cam-1");
  cam.evidence[0].url = "http://example.com/acme/security";
  cam.evidence[0].archive_url = "javascript:alert(1)";
  const site = build(t, { records });
  const page = site.read("devices/acme-cam-1/index.html");
  assert.doesNotMatch(page, /(?:href|cite)="(?:http:|javascript:)/);
  assert.ok(text(page).includes("http://example.com/acme/security (not linked: not an https address)"));
  assert.ok(text(page).includes("javascript:alert(1) (not linked: not an https address)"));
  assert.equal(JSON.parse(ldJson(page)).citation[0].url, undefined);
  assert.match(site.read("devices/acme-router-2/index.html"), /<a class="url" href="https:\/\/example\.com\/acme\/eol">/, "https sources stay linked");
});

test("matchDevices finds aliases and model numbers and needs every term", (t) => {
  const index = build(t).json("search-index.json");
  assert.equal(index.license, "ODbL-1.0");
  const ids = (query) => matchDevices(index.devices, query).map((d) => d.id);
  assert.deepEqual(ids("AC-1"), ["acme-cam-1"], "alias");
  assert.deepEqual(ids("ac1"), ["acme-cam-1"], "model number without punctuation");
  assert.deepEqual(ids("ＡＣ－１"), ["acme-cam-1"], "full-width characters after NFKC");
  assert.deepEqual(ids("acme router 2"), ["acme-router-2"], "brand and model terms");
  assert.deepEqual(ids("plug-3"), ["acme-plug-3"], "id");
  assert.deepEqual(ids("acme nonexistent"), [], "every term must match");
  assert.deepEqual(ids("   "), []);
  assert.equal(ids("acme").length, 5);
});

test("a search link's query prefers the longest exact name, whichever order the index has (PLAN, Matching)", () => {
  // Old models whose names are prefixes of new ones: the audits found "Nest Cam Indoor" (2015) inside "Nest Cam Indoor (wired, 3rd gen)".
  const old = { id: "google-nest-cam-indoor", brand: "Google", model: "Nest Cam Indoor", aliases: [] };
  const wired = { id: "google-nest-cam-indoor-wired-3rd-gen", brand: "Google", model: "Nest Cam Indoor (wired, 3rd gen)", aliases: [] };
  for (const index of [[old, wired], [wired, old]]) {
    const order = (query) => matchDevices(index, query).map((d) => d.id);
    assert.deepEqual(order("Nest Cam Indoor (wired, 3rd gen)"), [wired.id], "the full name finds only its own model: every term must match");
    assert.deepEqual(order("Nest Cam Indoor"), [old.id, wired.id], "the shorter name is exact, the longer one only starts with it");
    assert.deepEqual(order("Google Nest Cam Indoor (wired, 3rd gen)"), [wired.id], "with the brand in front too");
    assert.deepEqual(order("google nest cam indoor"), [old.id, wired.id], "brand and model, any case");
  }
});

test("matchDevices ranks an exact model or alias first, then prefix matches, then the rest", (t) => {
  const ids = ["ring-floodlight-cam", "ring-floodlight-cam-2k", "google-nest-cam-with-floodlight"];
  const records = ["ring", "google"].flatMap((brand) => loadRecords(join(ROOT, "data", "devices", brand))).filter((r) => ids.includes(r.id));
  assert.equal(records.length, 3);
  const index = build(t, { records }).json("search-index.json").devices;
  const order = (devices, query) => matchDevices(devices, query).map((d) => d.id);
  for (const devices of [index, [...index].reverse()]) {
    assert.deepEqual(order(devices, "Floodlight Cam"), ids, "exact model, then a prefix (Floodlight Cam 2K), then the rest");
    assert.deepEqual(order(devices, "ring floodlight cam"), ids.slice(0, 2), "brand and model together count as exact");
    assert.equal(order(devices, "Floodlight Cam (2nd Gen)")[0], "ring-floodlight-cam-2k", "an exact alias");
    assert.equal(order(devices, "floodlightcam")[0], "ring-floodlight-cam", "exact with spaces ignored");
  }
  const cam10 = { ...structuredClone(byId(fixtures(), "acme-cam-1")), id: "acme-cam-10", model: "Cam 10", aliases: ["AC-10"] };
  const acme = build(t, { records: [byId(fixtures(), "acme-cam-1"), cam10] }).json("search-index.json").devices.reverse();
  assert.deepEqual(order(acme, "acme cam 1"), ["acme-cam-1", "acme-cam-10"], "brand and model count as exact without a brand alias");
  assert.deepEqual(order(acme, "AC-1"), ["acme-cam-1", "acme-cam-10"], "an exact alias beats an alias that starts with it");
});

test("every category in the schema has a page label", (t) => {
  const schema = JSON.parse(readFileSync(join(ROOT, "data", "schema", "device.schema.json"), "utf8"));
  const base = byId(fixtures(), "acme-cam-1");
  const records = schema.properties.category.enum.map((category) => ({ ...structuredClone(base), id: `acme-${category}`, category }));
  const site = build(t, { records });
  assert.equal(readdirSync(join(site.outDir, "categories")).length, schema.properties.category.enum.length);
});

test("time left counts whole years, months and days to the last day", () => {
  assert.equal(timeLeft("2026-10-21", "2027-12-31"), "1 year, 2 months and 10 days");
  assert.equal(timeLeft("2027-01-31", "2027-03-01"), "1 month and 1 day");
  assert.equal(timeLeft("2026-10-21", "2026-10-22"), "1 day");
  assert.equal(timeLeft("2026-10-21", "2026-10-21"), null);
});
