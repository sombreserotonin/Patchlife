import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { format, gateDifferences, mismatches, recordYaml, runCandidates } from "../scripts/candidates.mjs";
import { validateDevices, validateSources } from "../scripts/validate-data.mjs";
import * as ezviz from "../scripts/parsers/ezviz-eol.mjs";
import * as tpLink from "../scripts/parsers/tp-link-au.mjs";

// The real profiles, synthetic pages (made-up models in the real markup) and records parsed from them.
const REAL = validateSources(fileURLToPath(new URL("../data/sources", import.meta.url))).entries;
// The real min_rows (199 and 279) are set for the live pages, so the fixture profiles lower them to the fixtures' rows.
const SOURCES = REAL.map((s) => (s.min_rows ? { ...s, min_rows: Object.fromEntries(Object.keys(s.min_rows).map((url) => [url, 5])) } : s));
const FIXTURES = fileURLToPath(new URL("./fixtures/parsers", import.meta.url));
const POLICY = "https://www.ezviz.com/inter/trust-center/security/upgrade-policy";
const PAGES = {
  [tpLink.PAGE]: readFileSync(join(FIXTURES, "tp-link-au.html"), "utf8"),
  [ezviz.PAGE]: readFileSync(join(FIXTURES, "ezviz-eol.html"), "utf8"),
  [POLICY]: "<p>The updates policies and the EOL product list are subject to change and will be reviewed on a regular basis.</p>",
};
const TODAY = "2026-10-27";

// A temporary copy of the fixture records and a fake fetcher, as the repoint-source tests set up.
function setup(pages = PAGES) {
  const dir = mkdtempSync(join(tmpdir(), "patchlife-candidates-"));
  cpSync(join(FIXTURES, "devices"), dir, { recursive: true });
  const fetched = [];
  const get = async (url) => {
    fetched.push(url);
    if (!(url in pages)) throw Object.assign(new Error(`HTTP 404 for ${url}`), { status: 404, url });
    return { url, contentType: "text/html", text: pages[url] };
  };
  const file = (slug, id) => join(dir, slug, `${id}.yaml`);
  const read = (slug, id) => readFileSync(file(slug, id), "utf8");
  const edit = (slug, id, from, to) => {
    const text = read(slug, id);
    assert.ok(text.includes(from), `${id} has no "${from}"`);
    writeFileSync(file(slug, id), text.replace(from, to));
  };
  const files = () => readdirSync(dir, { recursive: true }).filter((name) => name.endsWith(".yaml")).sort();
  return { dir, get, fetched, file, read, edit, files };
}
const run = (dir, options) => runCandidates(dir, { sources: SOURCES, today: TODAY, ...options });
const counts = (report) => ({ rows: report.rows, cited: report.cited, reproduced: report.reproduced.length, newRows: report.newRows.length, skipped: report.skipped.length, mismatches: mismatches(report) });

test("--check reproduces every record whose quote is on its page, lists the new rows and writes nothing", async () => {
  const { dir, get, fetched, files } = setup();
  const before = files();
  const { reports, written } = await run(dir, { get, check: true });
  assert.deepEqual(written, []);
  assert.deepEqual(files(), before);
  // Each page is fetched once; the policy page once for its sentence.
  assert.deepEqual(fetched, [tpLink.PAGE, ezviz.PAGE, POLICY]);
  assert.deepEqual(reports.map(counts), [
    { rows: 14, cited: 5, reproduced: 5, newRows: 2, skipped: 4, mismatches: 0 },
    { rows: 9, cited: 4, reproduced: 4, newRows: 2, skipped: 3, mismatches: 0 },
  ]);
  const [tp, ez] = reports;
  assert.deepEqual(tp.newRows.map((c) => c.id), ["tp-link-archer-zx20-v1-20", "tp-link-tapo-z400-kit-v2"]);
  // Two different rows for TD99 V1 are ambiguous, so neither is a new row; the identical Tapo Z400 KIT rows are one.
  assert.deepEqual(tp.ambiguous, [{ id: "tp-link-td99-v1", quotes: ["Video Doorbell TD99 V1 31/12/2028 or later*", "Video Doorbell TD99 V1 31/12/2029 or later*"] }]);
  assert.deepEqual(ez.newRows.map((c) => c.id), ["ezviz-cs-zv310-a0-1b2wfr-2-8mm", "ezviz-cs-z5s-4w-b-1t"]);
  assert.equal(tp.minRows, 5);
});

test("a record the parser reads differently fails the gate, naming the field and both values", async () => {
  const { dir, get, edit } = setup();
  edit("tp-link", "tp-link-tapo-z100-v5", "category: camera", "category: doorbell");
  edit("ezviz", "ezviz-cs-z1-32w", 'end_date: "2030-01-20"', 'end_date: "2030-01-21"');
  const { reports, written } = await run(dir, { get });
  assert.deepEqual(written, []);
  assert.deepEqual(reports[0].differ, [{ id: "tp-link-tapo-z100-v5", differences: [{ field: "category", record: "doorbell", parser: "camera" }] }]);
  assert.deepEqual(reports[1].differ, [{ id: "ezviz-cs-z1-32w", differences: [{ field: "end_date", record: "2030-01-21", parser: "2030-01-20" }] }]);
  assert.equal(mismatches(reports[0]) + mismatches(reports[1]), 2);
  assert.ok(format(reports[0]).includes('  differs: tp-link-tapo-z100-v5: category: record "doorbell", parser "camera"'));
});

test("a record whose quote has gone is a changed row, not a mismatch, and its new row is never written", async () => {
  const { dir, files } = setup();
  // The page now dates Tapo Z100 V5 to 2029: the record's row is gone and the parser's row names an existing record.
  const pages = { ...PAGES, [tpLink.PAGE]: PAGES[tpLink.PAGE].replace("Tapo Z100 V5</p>\n\t\t\t</td>\n\t\t\t<td nowrap=\"nowrap\" valign=\"bottom\" width=\"162\">\n\t\t\t<p class=\"MsoNormal\">31/12/2028", "Tapo Z100 V5</p>\n\t\t\t</td>\n\t\t\t<td nowrap=\"nowrap\" valign=\"bottom\" width=\"162\">\n\t\t\t<p class=\"MsoNormal\">31/12/2029") };
  assert.notEqual(pages[tpLink.PAGE], PAGES[tpLink.PAGE]);
  const { get: getChanged } = setup(pages);
  const before = files();
  const { reports, written } = await run(dir, { get: getChanged, brands: ["tp-link"], limit: 10 });
  const [tp] = reports;
  assert.deepEqual(tp.changed, [
    { id: "tp-link-tapo-z100-v5", quote: "Wired Indoor Camera Tapo Z100 V5 31/12/2028 or later*" },
    { id: "tp-link-tapo-z100-v5", quote: "Wired Indoor Camera Tapo Z100 V5 31/12/2029 or later*", parser: true },
  ]);
  assert.equal(mismatches(tp), 0);
  assert.deepEqual(written.map((f) => f.split("/").pop()), ["tp-link-archer-zx20-v1-20.yaml", "tp-link-tapo-z400-kit-v2.yaml"]);
  assert.deepEqual(files().filter((f) => !before.includes(f)), ["tp-link/tp-link-archer-zx20-v1-20.yaml", "tp-link/tp-link-tapo-z400-kit-v2.yaml"]);
});

test("--check reports a record whose id differs from the parser's, and a parser exception is neither compared nor rewritten", async () => {
  const { dir, get, read, edit, file } = setup();
  // Renaming a record's id keeps its quote on the page, so the parser matches it but names it differently.
  const renamed = read("tp-link", "tp-link-archer-zx90-v2").replace("id: tp-link-archer-zx90-v2", "id: tp-link-archer-zx90-v2-au");
  writeFileSync(file("tp-link", "tp-link-archer-zx90-v2-au"), renamed);
  edit("tp-link", "tp-link-archer-zx90-v2", "notes: The statement's footnote says the date may be extended for products not yet at end of life.", "notes: A hand-written note the profile does not give.");
  const sources = SOURCES.map((s) => (s.brand_slug === "tp-link" ? { ...s, parser_exceptions: ["tp-link-archer-zx90-v2"] } : s));
  const { reports } = await runCandidates(dir, { sources, today: TODAY, get, check: true, brands: ["tp-link"] });
  const [tp] = reports;
  assert.deepEqual(tp.exceptions, ["tp-link-archer-zx90-v2"]);
  assert.deepEqual(tp.idDiffers, [{ id: "tp-link-archer-zx90-v2-au", parser: "tp-link-archer-zx90-v2" }]);
  assert.deepEqual(tp.differ, []);
  assert.deepEqual(tp.changed, []);
  assert.equal(mismatches(tp), 1);
});

test("a record on the page that no candidate reproduces, or a candidate whose fixed quote is not on its page, fails the gate", async () => {
  const { dir, get, edit } = setup();
  // A quote the verifier finds but the parser cannot read: the cell texts joined differently from the row.
  edit("tp-link", "tp-link-archer-zx55-v1", 'quote: "Wi-Fi 6 Router Archer ZX55 V1 7/01/2029"', 'quote: "Archer ZX55 V1 7/01/2029"');
  const { reports } = await run(dir, { get, check: true, brands: ["tp-link"] });
  assert.deepEqual(reports[0].notReproduced, [{ id: "tp-link-archer-zx55-v1", quote: "Archer ZX55 V1 7/01/2029" }]);
  const { get: getReworded } = setup({ ...PAGES, [POLICY]: "<p>EZVIZ reworded its policy.</p>" });
  const { reports: ez, written } = await run(dir, { get: getReworded, brands: ["ezviz"] });
  assert.deepEqual(written, []);
  // The records' own items are the nightly verifier's job; the rows no record covers can't be written as they stand.
  assert.deepEqual(ez[0].reproduced.length, 4);
  assert.deepEqual(ez[0].newRows, []);
  assert.deepEqual(ez[0].unquotable, ["ezviz-cs-zv310-a0-1b2wfr-2-8mm", "ezviz-cs-z5s-4w-b-1t"].map((id) => ({ id, url: POLICY, quote: "The updates policies and the EOL product list are subject to change and will be reviewed on a regular basis." })));
  assert.equal(mismatches(ez[0]), 2);
});

test("a page with fewer rows than the profile's min_rows stops the run as parser broken", async () => {
  const { dir, get } = setup({ ...PAGES, [ezviz.PAGE]: "<h1>EOL list</h1><table><tr><td>Model</td></tr></table>" });
  await assert.rejects(run(dir, { get, check: true, brands: ["ezviz"] }), { message: `parser broken: ${ezviz.PAGE} yields 0 row(s), under the profile's min_rows 5` });
  // The real profiles' gates stop a run on the fixtures, which have far fewer rows than the live pages.
  const { get: getFixture } = setup();
  await assert.rejects(runCandidates(dir, { sources: REAL, today: TODAY, get: getFixture, check: true, brands: ["tp-link"] }), { message: `parser broken: ${tpLink.PAGE} yields 14 row(s), under the profile's min_rows 199` });
  const { get: getMoved } = setup();
  const moved = async (url) => ({ ...(await getMoved(url)), url: "https://www.tp-link.com/au/" });
  await assert.rejects(run(dir, { get: moved, brands: ["tp-link"] }), { message: "redirected to https://www.tp-link.com/au/" });
  await assert.rejects(run(dir, { get, brands: ["ring"] }), /no parser for brand "ring"/);
});

test("without --check it writes the new rows up to --limit as valid unverified records and leaves existing records as they were", async () => {
  const { dir, get, read, files } = setup();
  const before = Object.fromEntries(files().map((f) => [f, readFileSync(join(dir, f), "utf8")]));
  const { reports, written } = await run(dir, { get, limit: 3 });
  assert.equal(reports.length, 2);
  assert.deepEqual(written.map((f) => f.split("/").slice(-2).join("/")), ["tp-link/tp-link-archer-zx20-v1-20.yaml", "tp-link/tp-link-tapo-z400-kit-v2.yaml", "ezviz/ezviz-cs-zv310-a0-1b2wfr-2-8mm.yaml"]);
  for (const [f, text] of Object.entries(before)) assert.equal(readFileSync(join(dir, f), "utf8"), text);
  const written1 = read("tp-link", "tp-link-tapo-z400-kit-v2");
  assert.ok(written1.startsWith("id: tp-link-tapo-z400-kit-v2\nbrand: TP-Link\nbrand_slug: tp-link\nmodel: Tapo Z400 KIT (V2)\naliases:\n  - Tapo Z400 KIT V2\ncategory: camera\nregions: [AU]\nsupport:\n  rule: fixed_date\n  end_date: \"2028-12-31\"\n"));
  assert.ok(written1.includes('    retrieved: "2026-10-27"\n    regime: au_smart_device_rules\n'));
  assert.ok(written1.endsWith("verification:\n  status: unverified\nnotes: The statement's footnote says the date may be extended for products not yet at end of life.\n"));
  assert.ok(!written1.includes("archive_url"));
  assert.deepEqual(validateDevices(dir, { today: TODAY, sources: SOURCES }).errors, []);
  // A second run finds the written rows covered and nothing left under the limit of one.
  const again = await run(dir, { get, limit: 1 });
  assert.deepEqual(again.written.map((f) => f.split("/").pop()), ["ezviz-cs-z5s-4w-b-1t.yaml"]);
  assert.deepEqual(again.reports.map((r) => r.reproduced.length), [7, 5]);
});

test("a written record the validator rejects is removed again and the run fails", async () => {
  // A row whose model is longer than the schema allows reads fine, so only the validator catches it.
  const long = `Archer ${"Z".repeat(170)} V1`;
  const row = `<tr><td><p>Wi-Fi 6 Router</p></td><td><p>${long}</p></td><td><p>31/12/2028 or later*</p></td></tr>\n\t</tbody>`;
  const { dir, get, file, files } = setup({ ...PAGES, [tpLink.PAGE]: PAGES[tpLink.PAGE].replace("\n\t</tbody>", row) });
  const before = files();
  await assert.rejects(run(dir, { get, brands: ["tp-link"] }), (err) => err.message.startsWith("validation failed after writing, so the 3 new record(s) were removed:\n") && err.message.includes("schema: /model must NOT have more than 160 characters"));
  assert.deepEqual(files(), before);
  assert.ok(!existsSync(file("tp-link", "tp-link-archer-zx20-v1-20")));
});

test("gateDifferences compares the seven gate fields and recordYaml writes the hand-written style", () => {
  const record = { model: "A (V1)", category: "router", regions: ["AU"], support: { end_date: "2028-12-31", at_least: true, conditions: "c" }, notes: "n" };
  assert.deepEqual(gateDifferences(record, { ...record, regions: ["UK"], support: { ...record.support, at_least: false } }), [
    { field: "at_least", record: true, parser: false },
    { field: "regions", record: ["AU"], parser: ["UK"] },
  ]);
  // A missing notes field and a null one read the same, as the records on main leave notes out when there is none.
  assert.deepEqual(gateDifferences({ ...record, notes: undefined }, { ...record, notes: null }), []);
  const yaml = recordYaml({ id: "x-a", brand: "X", brand_slug: "x", model: "A: B", category: "other", regions: ["EU", "UK"], support: { rule: "fixed_date", end_date: "2029-06", years: null, anchor_date: null, at_least: false, conditions: null }, evidence: [{ url: "https://x.example/", quote: "A: B June 2029 #1", retrieved: TODAY, regime: "vendor_policy" }], verification: { status: "unverified" }, notes: "Product line: Hubs." });
  assert.equal(yaml, `id: x-a\nbrand: X\nbrand_slug: x\nmodel: "A: B"\ncategory: other\nregions: [EU, UK]\nsupport:\n  rule: fixed_date\n  end_date: "2029-06"\n  years: null\n  anchor_date: null\n  at_least: false\n  conditions: null\nevidence:\n  - url: https://x.example/\n    quote: "A: B June 2029 #1"\n    retrieved: "${TODAY}"\n    regime: vendor_policy\nverification:\n  status: unverified\nnotes: "Product line: Hubs."\n`);
});
