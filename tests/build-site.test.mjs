import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSite, loadRecords, optionsFromEnv, resolveOutDir, timeLeft, unsafeOutDirReason } from "../scripts/build-site.mjs";
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
const DRAFT = "<!-- Draft wording: needs the owner's legal read (gate H9a). -->";
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

// Asserts that every time the phrase starts a piece of body text, the draft marker comes right before it, with only tags
// between. Returns how many times the phrase appears.
function draftMarkedCount(page, phrase, label) {
  const body = page.slice(page.indexOf("<body>"));
  let count = 0;
  for (let at = body.indexOf(phrase); at >= 0; at = body.indexOf(phrase, at + 1), count++) {
    const before = body.slice(0, at);
    const gap = before.slice(before.lastIndexOf("<!--"));
    const ok = gap.startsWith(DRAFT) && gap.slice(DRAFT.length).replace(/<[^>]*>/g, "").trim() === "";
    assert.ok(ok, `${label}: "${phrase}" at ${at} has no draft marker right before it`);
  }
  return count;
}
const assertDraftMarked = (page, phrase, label) => assert.ok(draftMarkedCount(page, phrase, label) > 0, `${label}: "${phrase}" not found`);

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
  assert.match(page, /<a href="https:\/\/github\.com\/sombreserotonin\/Patchlife\/issues\/new\/choose">Report a correction<\/a>/);
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

  const records = fixtures();
  byId(records, "acme-leap-5").support.conditions = "If bought new, at least four years from purchase or this date, whichever is later.";
  const passed = build(t, { records, today: "2027-03-01" });
  assert.match(text(passed.read("devices/acme-leap-5/index.html")), /Time left The minimum period to this date has ended\. See Conditions\./);
  assert.doesNotMatch(passed.read("devices/acme-leap-5/index.html"), /None guaranteed/);
  assert.match(text(build(t, { today: "2027-03-01" }).read("devices/acme-leap-5/index.html")), /Time left None guaranteed\. The minimum period has ended\./);
});

test("status notes hedge an at-least minimum when the record has conditions", (t) => {
  const soon = build(t, { records: [ringStyle()], today: "2027-06-01" }).read("devices/ring-video-doorbell-3/index.html");
  assert.match(text(soon), /Status Ending soon Status as at 1 June 2027\. 12 months or less of the minimum to this date left\. See Conditions\./);
  assertDraftMarked(soon, "12 months or less of the minimum to this date left. See Conditions.", "ending soon");
  const passed = build(t, { records: [ringStyle()], today: "2028-01-01" }).read("devices/ring-video-doorbell-3/index.html");
  assert.match(text(passed), /Status Minimum passed Status as at 1 Jan 2028\. The minimum period to this date has passed\. See Conditions\./);
  assertDraftMarked(passed, "The minimum period to this date has passed. See Conditions.", "minimum passed");
  assert.doesNotMatch(text(passed), /guaranteed minimum period has passed/);
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

test("the methodology says an at-least end date is the last guaranteed day", (t) => {
  const words = text(build(t).read("methodology/index.html"));
  assert.ok(words.includes('An end date is the last day of the stated period. When the source says "at least", it is the last guaranteed day, and updates may continue after it.'), words);
  assert.doesNotMatch(words, /An end date is the last day of support\./);
});

test("quote claims cover dates, not answers that found nothing", (t) => {
  const site = build(t);
  const about = text(site.read("about/index.html"));
  assert.match(about, /with a quote and a link for every date\./);
  assert.doesNotMatch(about, /every answer/);
  const methodology = text(site.read("methodology/index.html"));
  assert.match(methodology, /Each record that gives a date or rule quotes, word for word,/);
  assert.doesNotMatch(methodology, /Each record quotes/);
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
  assert.equal(pages.length, 1 + 5 + 1 + 5 + 3, "home, 5 models, 1 brand, 5 categories, 3 info pages");
  assert.equal(site.read("robots.txt"), "User-agent: *\nAllow: /\n\nSitemap: https://patchlife.tech/sitemap.xml\n");
});

test("NOINDEX puts noindex on every page and disallows all in robots.txt", (t) => {
  const hidden = build(t, { noindex: true });
  for (const file of htmlFiles(hidden.outDir)) assert.match(hidden.read(file), /<meta name="robots" content="noindex">/, file);
  assert.equal(hidden.read("robots.txt"), "User-agent: *\nDisallow: /\n");
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

test("every draft legal sentence carries the H9a draft marker", (t) => {
  const site = build(t, { today: "2027-03-01" });
  for (const file of htmlFiles(site.outDir)) {
    const page = site.read(file);
    assertDraftMarked(page, DISCLAIMER, file);
    assertDraftMarked(page, "Quoted manufacturer statements remain the property of their owners", file);
    const body = page.slice(page.indexOf("<body>"));
    const p8 = draftMarkedCount(page, "Minimum support period ended on", file) + draftMarkedCount(page, "The source gave a minimum period", file);
    assert.equal((body.match(/may still provide updates/g) ?? []).length, p8, `${file}: every P8 sentence is marked`);
  }
  assert.match(site.read("brands/acme/index.html"), /may still provide updates/, "the brand page has P8 copy to check");
  const about = site.read("about/index.html");
  assertDraftMarked(about, "Australia's smart device rules apply", "about");
  assertDraftMarked(about, "Claude Code, an AI coding tool", "about");
  assertDraftMarked(site.read("methodology/index.html"), "The source gave a minimum period", "methodology");
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

// Runs the home page's inline search loader with a fake document, import() and fetch(), and records what it asks for.
function runLoader(page, { fetchOk = true } = {}) {
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
  new Function("document", "loadModule", "fetch", code.replace(/\bimport\(/g, "loadModule("))({ getElementById: (id) => nodes[id] }, fakeImport, fakeFetch);
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

test("SITE_URL is trimmed and must be a plain http or https URL", () => {
  assert.equal(optionsFromEnv({ SITE_URL: " https://example.org/ \n" }).siteUrl, "https://example.org");
  assert.equal(optionsFromEnv({ SITE_URL: "https://example.org/preview/" }).siteUrl, "https://example.org/preview");
  assert.equal(optionsFromEnv({}).siteUrl, "https://patchlife.tech");
  for (const bad of ["https://exa mple.org", "https://example.org/a b", "ftp://example.org", "https://example.org/?q=1", "https://example.org/#top", "example.org"]) {
    assert.throws(() => optionsFromEnv({ SITE_URL: bad }), /SITE_URL/, bad);
  }
});

test("BUILD_DATE must be a real calendar date", (t) => {
  for (const bad of ["2027-02-31", "2026-02-29", "2026-13-45", "2026-1-01"]) {
    assert.throws(() => build(t, { today: bad }), /build date/, bad);
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

test("an empty outDir argument means the default, never the cwd", (t) => {
  assert.equal(resolveOutDir(""), join(ROOT, "_site"));
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

test("each unsafeOutDirReason guard refuses on its own, even for an earlier build", (t) => {
  const earlier = tempDir(t);
  mkdirSync(join(earlier, "api", "v1"), { recursive: true });
  writeFileSync(join(earlier, "api", "v1", "devices.json"), "{}");
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
