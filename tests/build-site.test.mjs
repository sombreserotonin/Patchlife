import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSite, loadRecords, timeLeft } from "../scripts/build-site.mjs";
import { matchDevices } from "../site/search.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const VALID = join(HERE, "fixtures", "valid");
const SCRIPT = join(HERE, "..", "scripts", "build-site.mjs");
const TODAY = "2026-10-21";
const NOTICE = readFileSync(join(HERE, "..", "data", "NOTICE.md"), "utf8");
const ATTRIBUTION = NOTICE.match(/Attribute it as: "([^"]+)"/)[1];
const HOSTILE = '</script><script>alert(1)</script> "><img onerror=alert(2)>';

const fixtures = () => loadRecords(VALID);
const byId = (records, id) => records.find((r) => r.id === id);

// Builds into a temp dir that is removed after the test.
function build(t, { records = fixtures(), ...options } = {}) {
  const outDir = mkdtempSync(join(tmpdir(), "patchlife-site-"));
  t.after(() => rmSync(outDir, { recursive: true, force: true }));
  buildSite({ records, outDir, today: TODAY, ...options });
  return { outDir, read: (path) => readFileSync(join(outDir, path), "utf8"), json: (path) => JSON.parse(readFileSync(join(outDir, path), "utf8")) };
}

// The page as a reader sees it: tags removed, entities decoded, spaces collapsed.
const text = (page) =>
  page
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

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

test("a future at-least date uses the SPEC 4 sentence and the model page shows every required fact", (t) => {
  const site = build(t, { records: [ringStyle()] });
  const page = site.read("devices/ring-video-doorbell-3/index.html");
  const words = text(page);
  assert.ok(words.includes("Security updates until at least 31 December 2027, as published by Ring (checked 21 Oct 2026)."), words);
  assert.match(words, /Status Supported Status as at 21 Oct 2026\./);
  assert.match(words, /Time left At least 1 year, 2 months and 10 days/);
  assert.match(words, /Regions UK statement/);
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

test("a relative rule without an anchor is shown in words with status unknown", (t) => {
  const site = build(t);
  const words = text(site.read("devices/acme-plug-3/index.html"));
  assert.ok(words.includes("Security updates for 3 years after Acme ends sales of this model (date not yet published), as published by Acme (retrieved 1 Oct 2026)."), words);
  assert.match(words, /Status Unknown /);
  assert.match(words, /Time left Not known until Acme publishes the date/);
  assert.equal(site.json("api/v1/devices/acme-plug-3.json").device.status, "unknown");
});

test("an at-least date that has passed uses the P8 wording", (t) => {
  const site = build(t, { today: "2027-03-01" });
  const words = text(site.read("devices/acme-leap-5/index.html"));
  assert.ok(words.includes("Minimum support period ended on 28 February 2027. Acme may still provide updates."), words);
  assert.match(words, /Status Ended Status as at 1 Mar 2027\./);
  assert.doesNotMatch(words, /Security updates until/);
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

test("every page has the licence footer, the attribution line and the status date", (t) => {
  const site = build(t);
  for (const file of htmlFiles(site.outDir)) {
    const page = site.read(file);
    assert.match(page, /<a href="https:\/\/github\.com\/sombreserotonin\/Patchlife">AGPL-3\.0-or-later<\/a>/, file);
    assert.match(page, /<a href="https:\/\/opendatacommons\.org\/licenses\/odbl\/1-0\/">ODbL 1\.0<\/a>/, file);
    assert.ok(page.includes(ATTRIBUTION), file);
    assert.match(text(page), /Status as at 21 Oct 2026\./, file);
    assert.match(page, /<!-- Draft wording: the disclaimer needs the owner's legal read \(gate H9a\)/, file);
    assert.doesNotMatch(page, /[\u2013\u2014]/, `${file} has an en or em dash`);
  }
});

test("BASE_PATH, SITE_URL and BUILD_DATE from the environment shape links and dates", (t) => {
  const outDir = mkdtempSync(join(tmpdir(), "patchlife-site-"));
  t.after(() => rmSync(outDir, { recursive: true, force: true }));
  const run = spawnSync(process.execPath, [SCRIPT, outDir, VALID], {
    encoding: "utf8",
    env: { ...process.env, BASE_PATH: "/Patchlife/", SITE_URL: "https://example.org", BUILD_DATE: "2027-03-01" },
  });
  assert.equal(run.status, 0, run.stderr);
  const read = (path) => readFileSync(join(outDir, path), "utf8");
  const home = read("index.html");
  assert.match(home, /href="\/Patchlife\/brands\/acme\/"/);
  assert.match(home, /data-base="\/Patchlife"/);
  for (const file of htmlFiles(outDir)) {
    const page = read(file);
    const rootLinks = [...page.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1]);
    assert.ok(rootLinks.length > 0, file);
    for (const href of rootLinks) assert.ok(href.startsWith("/Patchlife/"), `${file}: ${href}`);
    assert.match(page, /<link rel="canonical" href="https:\/\/example\.org\/Patchlife\//, file);
    assert.match(text(page), /Status as at 1 Mar 2027\./, file);
  }
  assert.match(read("sitemap.xml"), /<loc>https:\/\/example\.org\/Patchlife\/devices\/acme-cam-1\/<\/loc>/);
  assert.match(read("robots.txt"), /Sitemap: https:\/\/example\.org\/Patchlife\/sitemap\.xml/);
  assert.equal(JSON.parse(read("api/v1/devices.json")).build_date, "2027-03-01");
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
  const schema = JSON.parse(readFileSync(join(HERE, "..", "data", "schema", "device.schema.json"), "utf8"));
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
