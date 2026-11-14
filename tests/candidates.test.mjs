import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { format, gateDifferences, mismatches, recordYaml, reportJson, rewritten, runCandidates } from "../scripts/candidates.mjs";
import { htmlToText, stripHidden } from "../scripts/verify-evidence.mjs";
import { validateDevices, validateSources } from "../scripts/validate-data.mjs";
import { withdrawRecord } from "../scripts/withdraw-record.mjs";
import * as asus from "../scripts/parsers/asus.mjs";
import * as ezviz from "../scripts/parsers/ezviz-eol.mjs";
import * as glInet from "../scripts/parsers/gl-inet.mjs";
import * as google from "../scripts/parsers/google.mjs";
import * as kyocera from "../scripts/parsers/kyocera.mjs";
import * as tpLink from "../scripts/parsers/tp-link-au.mjs";
import { EZVIZ_POLICY as POLICY, FIXTURES, GOOGLE_AU, PAGES, RING, fixtureSources } from "./fixtures/parsers/profiles.mjs";

// The real profiles with the fixtures' min_rows and names (see fixtures/parsers/profiles.mjs), synthetic pages
// (made-up models in the real markup) and records parsed from them.
const REAL = validateSources(fileURLToPath(new URL("../data/sources", import.meta.url))).entries;
const SOURCES = fixtureSources(REAL);
const TODAY = "2026-10-27";
const B3 = ["tp-link", "ezviz"];

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
const names = (written) => written.map((w) => w.file.split("/").pop());

test("--check reproduces every record whose quote is on its page, lists the new rows and writes nothing", async () => {
  const { dir, get, fetched, files } = setup();
  const before = files();
  const { reports, written } = await run(dir, { get, check: true, brands: B3 });
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
  const { reports, written } = await run(dir, { get, brands: B3 });
  assert.deepEqual(written, []);
  assert.deepEqual(reports[0].differ, [{ id: "tp-link-tapo-z100-v5", differences: [{ field: "category", record: "doorbell", parser: "camera" }] }]);
  assert.deepEqual(reports[1].differ, [{ id: "ezviz-cs-z1-32w", differences: [{ field: "end_date", record: "2030-01-21", parser: "2030-01-20" }] }]);
  assert.equal(mismatches(reports[0]) + mismatches(reports[1]), 2);
  assert.ok(format(reports[0]).includes('  differs: tp-link-tapo-z100-v5: category: record "doorbell", parser "camera"'));
});

test("a record whose row changed is rewritten from the parser's row (B4): the row-derived fields, verification restarted, the rest kept", async () => {
  const { dir, get, read } = setup();
  // The page now dates Tapo Z100 V5 to 2029: the record's row is gone and the parser's row names the record.
  const pages = { ...PAGES, [tpLink.PAGE]: PAGES[tpLink.PAGE].replace("Tapo Z100 V5</p>\n\t\t\t</td>\n\t\t\t<td nowrap=\"nowrap\" valign=\"bottom\" width=\"162\">\n\t\t\t<p class=\"MsoNormal\">31/12/2028", "Tapo Z100 V5</p>\n\t\t\t</td>\n\t\t\t<td nowrap=\"nowrap\" valign=\"bottom\" width=\"162\">\n\t\t\t<p class=\"MsoNormal\">31/12/2029") };
  assert.notEqual(pages[tpLink.PAGE], PAGES[tpLink.PAGE]);
  const original = read("tp-link", "tp-link-tapo-z100-v5");
  const { get: getChanged } = setup(pages);
  const { reports, written, flags } = await run(dir, { get: getChanged, brands: ["tp-link"], limit: 10 });
  const [tp] = reports;
  assert.deepEqual(tp.changed, [{ id: "tp-link-tapo-z100-v5", quote: "Wired Indoor Camera Tapo Z100 V5 31/12/2028 or later*", parser: "Wired Indoor Camera Tapo Z100 V5 31/12/2029 or later*" }]);
  assert.equal(mismatches(tp), 0);
  // The fixture's ambiguous TD99 rows are the only flag.
  assert.deepEqual(flags, ['ambiguous: tp-link gives two rows for tp-link-td99-v1: "Video Doorbell TD99 V1 31/12/2028 or later*" and "Video Doorbell TD99 V1 31/12/2029 or later*"']);
  assert.ok(format(tp).includes('  changed: tp-link-tapo-z100-v5: quote gone "Wired Indoor Camera Tapo Z100 V5 31/12/2028 or later*", the page now has "Wired Indoor Camera Tapo Z100 V5 31/12/2029 or later*"'));
  // The changed row is written first, then the new rows; the report says what changed.
  assert.deepEqual(written.map((w) => [w.id, w.kind]), [["tp-link-tapo-z100-v5", "changed"], ["tp-link-archer-zx20-v1-20", "new"], ["tp-link-tapo-z400-kit-v2", "new"]]);
  assert.deepEqual(written[0].before, { end_date: "2028-12-31", at_least: true, conditions: "Hardware version V5 only.", quote: "Wired Indoor Camera Tapo Z100 V5 31/12/2028 or later*", notes: "The statement's footnote says the date may be extended for products not yet at end of life." });
  assert.deepEqual(written[0].after, { end_date: "2029-12-31", at_least: true, conditions: "Hardware version V5 only.", quote: "Wired Indoor Camera Tapo Z100 V5 31/12/2029 or later*", notes: "The statement's footnote says the date may be extended for products not yet at end of life." });
  const after = YAML.parse(read("tp-link", "tp-link-tapo-z100-v5"));
  const was = YAML.parse(original);
  assert.equal(after.support.end_date, "2029-12-31");
  assert.deepEqual(after.verification, { status: "unverified" });
  assert.equal(after.evidence[0].quote, "Wired Indoor Camera Tapo Z100 V5 31/12/2029 or later*");
  assert.equal(after.evidence[0].retrieved, TODAY);
  assert.ok(after.evidence.every((item) => !("archive_url" in item)));
  for (const key of ["id", "brand", "brand_slug", "model", "aliases", "category", "regions"]) assert.deepEqual(after[key], was[key]);
  assert.deepEqual(validateDevices(dir, { today: TODAY, sources: SOURCES }).errors, []);
});

test("a record withdrawn by O8 (no quote) counts as a changed row: the parser's row replaces it and nothing throws", async () => {
  const { dir, get, read } = setup();
  withdrawRecord(dir, "tp-link-tapo-z100-v5", "a test of the owner's withdraw action", { today: TODAY });
  const before = YAML.parse(read("tp-link", "tp-link-tapo-z100-v5"));
  assert.equal(before.support.rule, "none_published");
  assert.ok(before.evidence.every((item) => !("quote" in item)));
  const { reports, written, flags } = await run(dir, { get, brands: ["tp-link"], limit: 10 });
  const [tp] = reports;
  assert.deepEqual(tp.changed, [{ id: "tp-link-tapo-z100-v5", withdrawn: true, parser: "Wired Indoor Camera Tapo Z100 V5 31/12/2028 or later*" }]);
  assert.equal(mismatches(tp), 0);
  assert.ok(flags.every((flag) => !flag.includes("z100")), flags.join("\n"));
  assert.ok(format(tp).includes('  changed: tp-link-tapo-z100-v5: no quote (withdrawn), the page now has "Wired Indoor Camera Tapo Z100 V5 31/12/2028 or later*"'));
  assert.deepEqual(written.map((w) => [w.id, w.kind]).slice(0, 1), [["tp-link-tapo-z100-v5", "changed"]]);
  assert.equal(written[0].before.end_date, null);
  assert.equal(written[0].before.quote, null);
  assert.equal(written[0].after.end_date, "2028-12-31");
  const after = YAML.parse(read("tp-link", "tp-link-tapo-z100-v5"));
  assert.equal(after.support.end_date, "2028-12-31");
  assert.deepEqual(after.verification, { status: "unverified" });
  assert.ok(!(after.notes ?? "").includes("Withdrawn"));
  assert.deepEqual(validateDevices(dir, { today: TODAY, sources: SOURCES }).errors, []);
});

test("a changed row of a parser exception is reported and never rewritten, and a record whose row is gone with no row naming it is reported", async () => {
  const { dir, get: getOriginal, read } = setup();
  const original = read("tp-link", "tp-link-tapo-z100-v5");
  const pages = { ...PAGES, [tpLink.PAGE]: PAGES[tpLink.PAGE].replace("Tapo Z100 V5</p>\n\t\t\t</td>\n\t\t\t<td nowrap=\"nowrap\" valign=\"bottom\" width=\"162\">\n\t\t\t<p class=\"MsoNormal\">31/12/2028", "Tapo Z100 V5</p>\n\t\t\t</td>\n\t\t\t<td nowrap=\"nowrap\" valign=\"bottom\" width=\"162\">\n\t\t\t<p class=\"MsoNormal\">31/12/2029").replace("Archer ZX55 V1", "Archer ZX56 V1") };
  const { get } = setup(pages);
  const sources = SOURCES.map((s) => (s.brand_slug === "tp-link" ? { ...s, parser_exceptions: ["tp-link-tapo-z100-v5"] } : s));
  const { reports, written, flags } = await runCandidates(dir, { sources, today: TODAY, get, brands: ["tp-link"] });
  assert.equal(read("tp-link", "tp-link-tapo-z100-v5"), original);
  assert.deepEqual(written.map((w) => w.kind), ["new", "new", "new"]);
  assert.deepEqual(flags.slice(1), [
    'changed: tp-link-archer-zx55-v1: its quote "Wi-Fi 6 Router Archer ZX55 V1 7/01/2029" is no longer on https://www.tp-link.com/au/landing/au-cyber-compliance/ and no row names the model now',
    'changed: tp-link-tapo-z100-v5 is a parser exception, so its changed row "Wired Indoor Camera Tapo Z100 V5 31/12/2029 or later*" is not written',
  ]);
  assert.deepEqual(reports[0].changed.map((c) => c.id), ["tp-link-archer-zx55-v1", "tp-link-tapo-z100-v5"]);
  assert.ok(format(reports[0]).includes('  changed: tp-link-archer-zx55-v1: quote gone "Wi-Fi 6 Router Archer ZX55 V1 7/01/2029", no row names the model now'));
  // A second row for a record whose own row is still on the page is reported, not written.
  const fresh = setup();
  fresh.edit("tp-link", "tp-link-archer-zx90-v2", "aliases:\n  - Archer ZX90 V2", "aliases:\n  - Archer ZX90 V2\n  - Archer ZX20 V1.20");
  const second = await run(fresh.dir, { get: getOriginal, brands: ["tp-link"], check: true });
  assert.deepEqual(second.reports[0].changed, [{ id: "tp-link-archer-zx20-v1-20", quote: "Wi-Fi 6 Router Archer ZX20 V1.20 31/12/2028 or later*", parser: true }]);
  assert.deepEqual(second.flags.slice(1), ['changed: a second row names the existing record tp-link-archer-zx20-v1-20: "Wi-Fi 6 Router Archer ZX20 V1.20 31/12/2028 or later*"']);
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
  const { reports: ez, written, flags } = await run(dir, { get: getReworded, brands: ["ezviz"] });
  assert.deepEqual(written, []);
  // The records' own items are the nightly verifier's job; the rows no record covers can't be written as they stand.
  assert.deepEqual(ez[0].reproduced.length, 4);
  assert.deepEqual(ez[0].newRows, []);
  assert.deepEqual(ez[0].unquotable, ["ezviz-cs-zv310-a0-1b2wfr-2-8mm", "ezviz-cs-z5s-4w-b-1t"].map((id) => ({ id, url: POLICY, quote: "The updates policies and the EOL product list are subject to change and will be reviewed on a regular basis." })));
  assert.equal(mismatches(ez[0]), 2);
  assert.equal(flags.length, 2);
  assert.ok(flags[0].startsWith("unquotable: ezviz-cs-zv310-a0-1b2wfr-2-8mm:"));
});

test("a page with fewer rows than the profile's min_rows stops the run as parser broken", async () => {
  const { dir, get } = setup({ ...PAGES, [ezviz.PAGE]: "<h1>EOL list</h1><table><tr><td>Model</td></tr></table>" });
  await assert.rejects(run(dir, { get, check: true, brands: ["ezviz"] }), { message: `parser broken: ${ezviz.PAGE} yields 0 row(s), under the profile's min_rows 5` });
  // The real profiles' gates stop a run on the fixtures, which have far fewer rows than the live pages.
  const { get: getFixture } = setup();
  await assert.rejects(runCandidates(dir, { sources: REAL, today: TODAY, get: getFixture, check: true, brands: ["tp-link"] }), { message: `parser broken: ${tpLink.PAGE} yields 14 row(s), under the profile's min_rows 199` });
  // The gate holds for every page of a multi-page brand, the regulatory page's links included.
  await assert.rejects(runCandidates(dir, { sources: REAL, today: TODAY, get: getFixture, check: true, brands: ["ring"] }), { message: `parser broken: ${RING.GB} yields 7 row(s), under the profile's min_rows 56` });
  const { get: getIndex } = setup({ ...PAGES, [google.INDEX]: "<p>No statements linked.</p>" });
  await assert.rejects(run(dir, { get: getIndex, check: true, brands: ["google"] }), { message: `parser broken: ${google.INDEX} yields 0 row(s), under the profile's min_rows 1` });
  const { get: getMoved } = setup();
  const moved = async (url) => ({ ...(await getMoved(url)), url: "https://www.tp-link.com/au/" });
  await assert.rejects(run(dir, { get: moved, brands: ["tp-link"] }), { message: "redirected to https://www.tp-link.com/au/" });
  await assert.rejects(run(dir, { get, brands: ["arlo"] }), /no parser for brand "arlo"/);
});

test("without --check it writes the new rows up to --limit as valid unverified records and leaves existing records as they were", async () => {
  const { dir, get, read, files } = setup();
  const before = Object.fromEntries(files().map((f) => [f, readFileSync(join(dir, f), "utf8")]));
  const { reports, written } = await run(dir, { get, limit: 3, brands: B3 });
  assert.equal(reports.length, 2);
  assert.deepEqual(written.map((w) => [w.kind, ...w.file.split("/").slice(-2)]), [["new", "tp-link", "tp-link-archer-zx20-v1-20.yaml"], ["new", "tp-link", "tp-link-tapo-z400-kit-v2.yaml"], ["new", "ezviz", "ezviz-cs-zv310-a0-1b2wfr-2-8mm.yaml"]]);
  for (const [f, text] of Object.entries(before)) assert.equal(readFileSync(join(dir, f), "utf8"), text);
  const written1 = read("tp-link", "tp-link-tapo-z400-kit-v2");
  assert.ok(written1.startsWith("id: tp-link-tapo-z400-kit-v2\nbrand: TP-Link\nbrand_slug: tp-link\nmodel: Tapo Z400 KIT (V2)\naliases:\n  - Tapo Z400 KIT V2\ncategory: camera\nregions: [AU]\nsupport:\n  rule: fixed_date\n  end_date: \"2028-12-31\"\n"));
  assert.ok(written1.includes('    retrieved: "2026-10-27"\n    regime: au_smart_device_rules\n'));
  assert.ok(written1.endsWith("verification:\n  status: unverified\nnotes: The statement's footnote says the date may be extended for products not yet at end of life.\n"));
  assert.ok(!written1.includes("archive_url"));
  assert.deepEqual(validateDevices(dir, { today: TODAY, sources: SOURCES }).errors, []);
  // A second run finds the written rows covered and nothing left under the limit of one.
  const again = await run(dir, { get, limit: 1, brands: B3 });
  assert.deepEqual(names(again.written), ["ezviz-cs-z5s-4w-b-1t.yaml"]);
  assert.deepEqual(again.reports.map((r) => r.reproduced.length), [7, 5]);
});

test("changed rows on any brand come before new rows, which follow one brand at a time until its backlog is empty, within --limit (decision 5)", async () => {
  const { dir, get } = setup({ ...PAGES, [glInet.PSTI]: PAGES[glInet.PSTI].replace("<td>June 11, 2027 or later*</td>\n              </tr>\n\n              <tr>\n                <td scope=\"row\">GL-S9</td>", "<td>June 12, 2027 or later*</td>\n              </tr>\n\n              <tr>\n                <td scope=\"row\">GL-S9</td>") });
  const { written } = await run(dir, { get, limit: 4, brands: ["tp-link", "gl-inet", "ezviz"] });
  // GL.iNet's changed Velox row comes first although its brand is second; TP-Link's two new rows empty its backlog
  // before EZVIZ gets one.
  assert.deepEqual(written.map((w) => [w.kind, w.id]), [["changed", "gl-inet-gl-z200"], ["new", "tp-link-archer-zx20-v1-20"], ["new", "tp-link-tapo-z400-kit-v2"], ["new", "gl-inet-gl-z300"]]);
  assert.deepEqual(written[0].before, { end_date: "2027-06-11", at_least: true, conditions: "Pre-defined support period; the actual period is 2 years after GL.iNet announces end of life, so it can be longer.", quote: "Velox (GL-Z200) June 11, 2027 or later*", notes: "The page is GL.iNet's PSTI support period table and names no region; recorded as UK, the regime it is published under. The date is the pre-defined minimum, not a guaranteed end." });
  assert.equal(written[0].after.end_date, "2027-06-12");
  assert.deepEqual(validateDevices(dir, { today: TODAY, sources: SOURCES }).errors, []);
});

test("a brand whose candidates cite several pages is matched once and counted on each page it cites (Ring)", async () => {
  const { dir, get, fetched, edit } = setup();
  const { reports, written, flags } = await run(dir, { get, check: true, brands: ["ring"] });
  // The three pages, then the 538eg pages the Indoor Cam ZK candidate quotes.
  assert.deepEqual(fetched, [RING.GB, RING.AU, RING.US, RING.RENAMES_US, RING.RENAMES_GB, RING.RENAMES_AU]);
  assert.deepEqual(reports.map((r) => [r.url, r.rows, r.cited, r.reproduced.length, r.newRows.map((c) => c.id)]), [
    [RING.GB, 7, 4, 4, ["ring-video-doorbell-9-plus"]],
    [RING.AU, 3, 3, 3, []],
    [RING.US, 9, 3, 3, ["ring-video-doorbell-9-plus", "ring-outdoor-cam-z", "ring-beacon-z"]],
  ]);
  assert.deepEqual(written, []);
  assert.deepEqual(flags, ["conflict: Ring's pages give different dates for Chime Z (UK 2029-12-31, US 2030-12-31), a D33 split for a person to record"]);
  // A record missing one page's region differs from the merged candidate; the page it lacks still counts it as cited.
  edit("ring", "ring-video-doorbell-9", "regions: [UK, AU, US]", "regions: [UK, AU]");
  const second = await run(dir, { get, check: true, brands: ["ring"] });
  assert.deepEqual(second.reports.map((r) => r.differ.length), [1, 1, 1]);
  assert.deepEqual(second.reports[2].differ[0].differences, [{ field: "regions", record: ["UK", "AU"], parser: ["UK", "AU", "US"] }]);
  assert.equal(mismatches(second.reports[0]), 1);
});

test("a conflict that exception records already settle is not flagged, and one new row per page counts once in the writes", async () => {
  const { dir, get, read, file } = setup();
  // Record Chime Z's two dates as a D33 split: a UK record and a US one, both parser exceptions.
  const uk = read("ring", "ring-alarm-keypad-z").replace(/Alarm Keypad Z/g, "Chime Z").replace("ring-alarm-keypad-z", "ring-chime-z").replace('end_date: "2030-12-31"', 'end_date: "2029-12-31"').replace("31 December 2030", "31 December 2029");
  writeFileSync(file("ring", "ring-chime-z"), uk);
  const us = uk.replace("ring-chime-z", "ring-chime-z-us").replace("regions: [UK]", "regions: [US]").replace('end_date: "2029-12-31"', 'end_date: "2030-12-31"').replace("31 December 2029", "31 December 2030").replaceAll(RING.GB, RING.US).replace("quote: Ring Chime Z 31 December 2030", "quote: Chime Z 31 December 2030");
  writeFileSync(file("ring", "ring-chime-z-us"), us);
  const sources = SOURCES.map((s) => (s.brand_slug === "ring" ? { ...s, parser_exceptions: [...s.parser_exceptions, "ring-chime-z", "ring-chime-z-us"] } : s));
  const { reports, flags, written } = await runCandidates(dir, { sources, today: TODAY, get, brands: ["ring"], limit: 10 });
  assert.deepEqual(flags, []);
  assert.deepEqual(reports.map((r) => r.exceptions), [["ring-chime-z"], [], ["ring-chime-z-us"]]);
  assert.deepEqual(written.map((w) => w.id), ["ring-video-doorbell-9-plus", "ring-outdoor-cam-z", "ring-beacon-z"]);
  assert.deepEqual(validateDevices(dir, { today: TODAY, sources }).errors, []);
});

test("Google's dated note accepts any date in the {date} position, and the statements add their regions and notes", async () => {
  const { dir, get, edit, fetched } = setup();
  edit("google", "google-nest-cam-ultra", "(checked 2026-10-27)", "(checked 2026-10-01)");
  edit("google", "google-chromecast-z", "(checked 2026-10-27)", "(checked 2025-12-31)");
  const { reports, flags } = await run(dir, { get, check: true, brands: ["google"] });
  assert.deepEqual(fetched, [google.TABLE, google.UK, GOOGLE_AU.ULTRA, GOOGLE_AU.DOORBELL, google.INDEX]);
  assert.deepEqual(reports.map((r) => [r.url.replace("https://support.google.com/", ""), r.rows, r.cited, r.reproduced.length, r.newRows.length, r.skipped.length]), [
    ["product-documentation/answer/10231940?hl=en", 7, 3, 3, 1, 3],
    ["product-documentation/answer/14869041?hl=en", 5, 2, 2, 0, 0],
    ["product-documentation/answer/99000001?hl=en", 1, 1, 1, 0, 0],
    ["product-documentation/answer/99000002?hl=en", 1, 0, 0, 0, 0],
    ["chromecast/answer/10367042", 3, 0, 0, 0, 0],
  ]);
  assert.equal(flags.length, 5);
  // Any other difference in the notes alone is a proposal to regenerate the record, never a gate mismatch: when a
  // minimum passes, the dated note joins the notes while the row stays the same.
  edit("google", "google-nest-cam-ultra", "the 5-year minimum has passed.", "the 5-year minimum has passed. Hand-written.");
  const second = await run(dir, { get, check: true, brands: ["google"] });
  assert.deepEqual(second.reports[0].differ, []);
  assert.equal(second.reports[0].changed[0].id, "google-nest-cam-ultra");
  assert.equal(second.reports[0].changed[0].notes, true);
  assert.ok(second.flags.some((f) => f.startsWith("changed: google-nest-cam-ultra: only the notes differ")), second.flags.join("\n"));
  const third = await run(dir, { get, brands: ["google"] });
  assert.deepEqual(third.written.map((w) => [w.id, w.kind]), [["google-nest-cam-ultra", "changed"], ["google-home-orb", "new"]]);
  assert.ok(third.written[0].before.notes.endsWith("Hand-written.") && !third.written[0].after.notes.endsWith("Hand-written."));
});

test("a written record the validator rejects is removed again, a rewritten one restored, and the run fails", async () => {
  // A row whose model is longer than the schema allows reads fine, so only the validator catches it.
  const long = `Archer ${"Z".repeat(170)} V1`;
  const row = `<tr><td><p>Wi-Fi 6 Router</p></td><td><p>${long}</p></td><td><p>31/12/2028 or later*</p></td></tr>\n\t</tbody>`;
  const pages = { ...PAGES, [tpLink.PAGE]: PAGES[tpLink.PAGE].replace("\n\t</tbody>", row).replace("Tapo Z100 V5</p>\n\t\t\t</td>\n\t\t\t<td nowrap=\"nowrap\" valign=\"bottom\" width=\"162\">\n\t\t\t<p class=\"MsoNormal\">31/12/2028", "Tapo Z100 V5</p>\n\t\t\t</td>\n\t\t\t<td nowrap=\"nowrap\" valign=\"bottom\" width=\"162\">\n\t\t\t<p class=\"MsoNormal\">31/12/2029") };
  const { dir, get, file, files, read } = setup(pages);
  const before = files();
  const original = read("tp-link", "tp-link-tapo-z100-v5");
  await assert.rejects(run(dir, { get, brands: ["tp-link"] }), (err) => err.message.startsWith("validation failed after writing, so the 4 record(s) written were undone:\n") && err.message.includes("schema: /model must NOT have more than 160 characters"));
  assert.deepEqual(files(), before);
  assert.ok(!existsSync(file("tp-link", "tp-link-archer-zx20-v1-20")));
  assert.equal(read("tp-link", "tp-link-tapo-z100-v5"), original);
});

test("the report file holds today, one entry per page with the counts, the records written and the flags", async () => {
  const { dir, get } = setup();
  const result = await run(dir, { get, brands: ["kyocera", "asus"], limit: 2 });
  const json = reportJson({ today: TODAY, ...result });
  assert.equal(json.today, TODAY);
  assert.deepEqual(json.pages.map((p) => [p.brand_slug, p.rows, p.min_rows, p.cited, p.reproduced, p.new_rows, p.skipped, p.ambiguous]), [["kyocera", 6, 1, 2, 2, 1, 3, 0], ["asus", 37, 1, 3, 3, 19, 15, 0]]);
  assert.deepEqual(Object.keys(json.pages[0]), ["url", "brand_slug", "rows", "min_rows", "cited", "reproduced", "exceptions", "differ", "not_reproduced", "changed", "id_differs", "ambiguous", "unquotable", "new_rows", "skipped"]);
  assert.deepEqual(json.written.map((w) => [w.id, w.kind]), [["kyocera-ecosys-za9500wx", "new"], ["asus-tuf-zx3000-v2", "new"]]);
  assert.deepEqual(json.flags, []);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(json)));
});

test("a source with no records yet: every Grandstream row that reads is written as a new record, and the records validate", async () => {
  const { dir, get, files } = setup();
  const before = files();
  const { reports, written, flags } = await run(dir, { get, brands: ["grandstream"] });
  assert.deepEqual(flags, []);
  assert.deepEqual(counts(reports[0]), { rows: 15, cited: 0, reproduced: 0, newRows: 7, skipped: 8, mismatches: 0 });
  assert.deepEqual(written.map((w) => [w.id, w.kind]), [
    ["grandstream-gwn7691-lite", "new"],
    ["grandstream-gwn7692", "new"],
    ["grandstream-gwn7695", "new"],
    ["grandstream-gwn7091", "new"],
    ["grandstream-gwn7891", "new"],
    ["grandstream-gwn7892", "new"],
    ["grandstream-gwn7893-pl-pro", "new"],
  ]);
  assert.equal(files().length, before.length + 7);
  // The written records pass every rule, among them the date in the quote, the at-least phrase and the registry's sites.
  assert.deepEqual(validateDevices(dir, { today: TODAY, sources: SOURCES }).errors, []);
  // A second run finds each of them by its quote and writes nothing.
  const again = await run(dir, { get, brands: ["grandstream"] });
  assert.deepEqual(counts(again.reports[0]), { rows: 15, cited: 7, reproduced: 7, newRows: 0, skipped: 8, mismatches: 0 });
  assert.deepEqual(again.written, []);
});

test("gateDifferences compares the seven gate fields, rewritten keeps the record's identity, and recordYaml writes the hand-written style", () => {
  const record = { model: "A (V1)", category: "router", regions: ["AU"], support: { end_date: "2028-12-31", at_least: true, conditions: "c" }, notes: "n" };
  assert.deepEqual(gateDifferences(record, { ...record, regions: ["UK"], support: { ...record.support, at_least: false } }), [
    { field: "at_least", record: true, parser: false },
    { field: "regions", record: ["AU"], parser: ["UK"] },
  ]);
  // A missing notes field and a null one read the same, as the records on main leave notes out when there is none.
  assert.deepEqual(gateDifferences({ ...record, notes: undefined }, { ...record, notes: null }), []);
  assert.deepEqual(gateDifferences({ ...record, notes: "checked 2026-10-01; fine" }, { ...record, notes: "checked 2026-10-27; fine" }), []);
  const full = { id: "x-a", brand: "X", brand_slug: "x", model: "A", aliases: ["XA"], category: "other", regions: ["EU"], support: { rule: "fixed_date", end_date: "2029-06-01", years: null, anchor_date: null, at_least: false, conditions: null }, evidence: [{ url: "https://x.example/", quote: "A 1 June 2029", retrieved: "2026-01-01", archive_url: "https://web.archive.org/web/2026/https://x.example/", regime: "vendor_policy" }], verification: { status: "verified", checked: "2026-01-01", text_sha256: "0" }, notes: "Old." };
  const candidate = { ...full, regions: ["EU", "UK"], support: { ...full.support, end_date: "2030-06-01" }, evidence: [{ url: "https://x.example/", quote: "A 1 June 2030", retrieved: TODAY, regime: "vendor_policy" }], verification: { status: "unverified" }, aliases: [], notes: undefined };
  assert.deepEqual(rewritten(full, candidate), { id: "x-a", brand: "X", brand_slug: "x", model: "A", aliases: ["XA"], category: "other", regions: ["EU", "UK"], support: candidate.support, evidence: candidate.evidence, verification: { status: "unverified" } });
  const yaml = recordYaml({ id: "x-a", brand: "X", brand_slug: "x", model: "A: B", category: "other", regions: ["EU", "UK"], support: { rule: "years_after_launch", end_date: "2029-06-01", years: 5, anchor_date: "2024-06-01", at_least: true, conditions: null }, evidence: [{ url: "https://x.example/", quote: "A: B June 2029 #1", retrieved: TODAY, regime: "vendor_policy" }], verification: { status: "unverified" }, notes: "Product line: Hubs." });
  assert.equal(yaml, `id: x-a\nbrand: X\nbrand_slug: x\nmodel: "A: B"\ncategory: other\nregions: [EU, UK]\nsupport:\n  rule: years_after_launch\n  end_date: "2029-06-01"\n  years: 5\n  anchor_date: "2024-06-01"\n  at_least: true\n  conditions: null\nevidence:\n  - url: https://x.example/\n    quote: "A: B June 2029 #1"\n    retrieved: "${TODAY}"\n    regime: vendor_policy\nverification:\n  status: unverified\nnotes: "Product line: Hubs."\n`);
});

test("a changed row whose parser quotes are no longer on the page fails the gate, as a new row does, and nothing is written", async () => {
  const { dir, get } = setup();
  await run(dir, { get, brands: ["kyocera"] });
  // Kyocera drops the sentence that makes every date a minimum, which the parser still quotes.
  const page = PAGES[kyocera.PAGE].replace(/<p>At no point shall[^<]*<\/p>/, "");
  assert.notEqual(page, PAGES[kyocera.PAGE]);
  const { get: getEdited } = setup({ ...PAGES, [kyocera.PAGE]: page });
  const { reports, written, flags } = await run(dir, { get: getEdited, brands: ["kyocera"] });
  assert.deepEqual(written, []);
  assert.ok(reports[0].unquotable.length > 0 && mismatches(reports[0]) > 0, format(reports[0]).join("\n"));
  assert.ok(flags.some((f) => f.startsWith("unquotable: kyocera-") && f.includes("At no point shall")), flags.join("\n"));
});

test("a row that names a record under another model is left to a person, so no write fails the next run's gate", async () => {
  // GL.iNet renames the Velox; the id comes from the model code, so the new row has the record's id.
  const pages = { ...PAGES, [glInet.PSTI]: PAGES[glInet.PSTI].replace(">Velox (GL-Z200)<", ">Velox Pro (GL-Z200)<") };
  assert.notEqual(pages[glInet.PSTI], PAGES[glInet.PSTI]);
  const { dir, get, read } = setup(pages);
  const before = read("gl-inet", "gl-inet-gl-z200");
  const { written, flags } = await run(dir, { get, brands: ["gl-inet"] });
  assert.ok(!written.some((w) => w.id === "gl-inet-gl-z200"), written.map((w) => w.id).join(", "));
  assert.equal(read("gl-inet", "gl-inet-gl-z200"), before);
  assert.ok(flags.some((f) => f.startsWith("changed: gl-inet-gl-z200: its quote") && f.endsWith('the row that names it now gives the model "Velox Pro (GL-Z200)" (id gl-inet-gl-z200): a rename for a person (RUNBOOKS O9)')), flags.join("\n"));
  assert.ok(!flags.some((f) => f.includes("no row names the model now") || f.startsWith("changed: a second row names")), flags.join("\n"));
  const next = await run(dir, { get, brands: ["gl-inet"], check: true });
  assert.equal(next.reports.reduce((n, r) => n + mismatches(r), 0), 0);
});

test("a row in an HTML comment or a script is not read, as the verifier does not read it, so it fails no run", async () => {
  const row = (model) => `<tr><td><p class="paragraph">Wi-Fi 7 Router</p></td><td><p class="paragraph">${model}</p></td><td><p class="paragraph">31/12/2030 or later*</p></td></tr>`;
  const hidden = `<!-- ${row("Archer ZX77 V1")} --><script type="text/x-template">${row("Archer ZX78 V1")}</script><template>${row("Archer ZX79 V1")}</template>`;
  const page = PAGES[tpLink.PAGE].replace("</table>", `${hidden}</table>`);
  assert.notEqual(page, PAGES[tpLink.PAGE]);
  const { dir, get } = setup({ ...PAGES, [tpLink.PAGE]: page });
  const { reports, flags } = await run(dir, { get, brands: ["tp-link"], check: true });
  assert.equal(mismatches(reports[0]), 0, format(reports[0]).join("\n"));
  assert.ok(!JSON.stringify({ reports, flags }).match(/ZX7[789]/));
  // The same row in plain sight is read.
  const { get: getShown } = setup({ ...PAGES, [tpLink.PAGE]: PAGES[tpLink.PAGE].replace("</table>", `${row("Archer ZX77 V1")}</table>`) });
  const shown = await run(dir, { get: getShown, brands: ["tp-link"], check: true });
  assert.ok(shown.reports[0].newRows.some((c) => c.model === "Archer ZX77 (V1)"));
});

test("after a rename on the open PR's branch, deleting the PR's own record lets the refresh write the renamed row", async () => {
  // RUNBOOKS O9: the weekly run wrote the renamed model as a record of its own; the owner adds the renames entry.
  const RENAME = "Video Doorbell 9 Plus (2027 release)";
  const before = SOURCES.map((s) => (s.brand_slug === "ring" ? { ...s, renames: s.renames.filter((r) => r.from !== RENAME) } : s));
  const { dir, get, file } = setup();
  const weekly = await runCandidates(dir, { sources: before, today: TODAY, get, brands: ["ring"], limit: 10 });
  assert.ok(weekly.written.some((w) => w.id === "ring-video-doorbell-9-plus-2027-release"));
  // Refreshed as it stands, the PR's own row is a record the parser must reproduce, and the gate fails.
  const stuck = await run(dir, { get, brands: ["ring"], limit: 10, check: true });
  assert.ok(stuck.reports.reduce((n, r) => n + mismatches(r), 0) > 0);
  // With that record deleted first, the refresh writes the row under its renamed model.
  rmSync(file("ring", "ring-video-doorbell-9-plus-2027-release"));
  const refresh = await run(dir, { get, brands: ["ring"], limit: 10 });
  assert.equal(refresh.reports.reduce((n, r) => n + mismatches(r), 0), 0);
  assert.ok(refresh.written.some((w) => w.id === "ring-video-doorbell-9-plus"), refresh.written.map((w) => w.id).join(", "));
});

const SENTENCE = "Security updates will address critical issues known to Google Nest that are able to be resolved with a remote software update.";

test("a notes-only regeneration whose parser quote is not on the page fails the gate and writes nothing", async () => {
  // No new row on the table page, so only the notes path is in play. The records no longer cite the sentence the page
  // rewords, and their 5-year minimum has passed by the run date, so only their notes differ.
  const page = PAGES[google.TABLE].replace(/<tr>\s*<td>Google Home Orb<\/td>[\s\S]*?<\/tr>/, "").replace(SENTENCE, "Security updates address critical issues that Google can fix remotely.");
  const { dir, get, file } = setup({ ...PAGES, [google.TABLE]: page });
  for (const id of ["google-nest-doorbell-ultra-2nd-gen", "google-chromecast-z", "google-nest-cam-ultra"]) {
    const text = readFileSync(file("google", id), "utf8");
    const item = `  - url: ${google.TABLE}\n    quote: "${SENTENCE}"\n`;
    const at = text.indexOf(item);
    assert.ok(at > 0, id);
    writeFileSync(file("google", id), text.slice(0, at) + text.slice(text.indexOf("  - url:", at + item.length)));
  }
  const { reports, written } = await runCandidates(dir, { sources: SOURCES, today: "2030-10-02", get, brands: ["google"] });
  assert.deepEqual(written, []);
  assert.ok(reports.some((r) => r.unquotable.some((u) => u.id === "google-nest-doorbell-ultra-2nd-gen" && u.quote === SENTENCE)));
});

test("a withdrawn record whose id the parser does not give is not rewritten when its row is back", async () => {
  const { dir, get, file } = setup();
  const text = readFileSync(file("tp-link", "tp-link-archer-zx90-v2"), "utf8").replace("id: tp-link-archer-zx90-v2", "id: tp-link-archer-zx90-v2-au");
  rmSync(file("tp-link", "tp-link-archer-zx90-v2"));
  writeFileSync(file("tp-link", "tp-link-archer-zx90-v2-au"), text);
  withdrawRecord(dir, "tp-link-archer-zx90-v2-au", "a test", { today: TODAY });
  const before = readFileSync(file("tp-link", "tp-link-archer-zx90-v2-au"), "utf8");
  const { written } = await run(dir, { get, brands: ["tp-link"], limit: 60 });
  assert.ok(!written.some((w) => w.id === "tp-link-archer-zx90-v2-au"), written.map((w) => w.id).join(", "));
  assert.equal(readFileSync(file("tp-link", "tp-link-archer-zx90-v2-au"), "utf8"), before);
  const next = await run(dir, { get, brands: ["tp-link"], check: true });
  assert.equal(next.reports.reduce((n, r) => n + mismatches(r), 0), 0);
});

test("markup a browser shows in full does not hide the rows from the parsers", () => {
  const table = "<table><tr><td>Archer ZX90 V2</td></tr></table>";
  for (const before of ["<!-->", "<!--->", "<template-row>", "<style-scope>", "<script-loader>"]) {
    assert.ok(htmlToText(before + table).includes("Archer"), `verifier, ${before}`);
    assert.ok(htmlToText(stripHidden(before + table)).includes("Archer"), `parsers, ${before}`);
  }
});

// Audit 2026-11-14, record-writers L1: an exception kept for its notes alone silenced every later conflict for its model.
test("a later row with another date is flagged even for a model whose record is an exception for its notes alone", async () => {
  const us = PAGES[RING.US].replace(/<\/tbody>(?![\s\S]*<\/tbody>)/, "<tr><td>Alarm Keypad Z</td><td>31 December 2031</td></tr></tbody>");
  const { dir, get } = setup({ ...PAGES, [RING.US]: us });
  const sources = SOURCES.map((s) => (s.brand_slug === "ring" ? { ...s, parser_exceptions: [...s.parser_exceptions, "ring-alarm-keypad-z"] } : s));
  const { flags } = await runCandidates(dir, { sources, today: TODAY, get, brands: ["ring"], check: true });
  assert.ok(flags.some((f) => f.startsWith("conflict: Ring's pages give different dates for Alarm Keypad Z")), flags.join("\n"));
});

test("a D39 case recorded as one exception that quotes both pages' rows stays settled until a row changes", async () => {
  const { dir, get, file } = setup();
  writeFileSync(file("gl-inet", "gl-inet-gl-z100"), [
    "id: gl-inet-gl-z100", "brand: GL.iNet", "brand_slug: gl-inet", 'model: "Ferret (GL-Z100)"', "aliases:", '  - "GL-Z100"', "category: router", "regions: [GLOBAL, UK]",
    "support:", "  rule: fixed_date", '  end_date: "2028-06-08"', "  years: null", "  anchor_date: null", "  at_least: false",
    '  conditions: "Status Maintenance: the model has reached end of life and GL.iNet lists a Supported Until date."', "evidence:",
    `  - url: ${glInet.ENDED}`, '    quote: "GL-Z100 4.3.25 Native OpenWrt 22.03.4 Maintenance June 9, 2026 June 8, 2028"', '    retrieved: "2026-10-27"', "    regime: vendor_policy",
    `  - url: ${glInet.PSTI}`, '    quote: "Ferret (GL-Z100) June 11, 2027 or later*"', '    retrieved: "2026-10-27"', "    regime: uk_psti",
    `  - url: ${glInet.PSTI}`, '    quote: "*Actual Support Periods is 2 years after announcement of EOL"', '    retrieved: "2026-10-27"', "    regime: uk_psti",
    "verification:", "  status: unverified", "",
  ].join("\n"));
  // Like Beryl (GL-MT1300): one record for both regions, with the firmware table's later date, settles the conflict.
  const sources = SOURCES.map((s) => (s.brand_slug === "gl-inet" ? { ...s, parser_exceptions: [...(s.parser_exceptions ?? []), "gl-inet-gl-z100"] } : s));
  const conflict = (flags) => flags.filter((f) => f.startsWith("conflict: GL.iNet's pages both list Ferret (GL-Z100)"));
  const settled = await runCandidates(dir, { sources, today: TODAY, get, brands: ["gl-inet"], check: true });
  assert.deepEqual(conflict(settled.flags), []);
  // Without the exception the same conflict is flagged.
  const plain = await runCandidates(dir, { sources: SOURCES, today: TODAY, get, brands: ["gl-inet"], check: true });
  assert.equal(conflict(plain.flags).length, 1);
  // Once the firmware table moves the date, the record no longer quotes that side, so the conflict shows again.
  const moved = { ...PAGES, [glInet.ENDED]: PAGES[glInet.ENDED].replace("June 8, 2028", "June 8, 2029") };
  assert.notEqual(moved[glInet.ENDED], PAGES[glInet.ENDED]);
  const { get: getMoved } = setup(moved);
  const again = await runCandidates(dir, { sources, today: TODAY, get: getMoved, brands: ["gl-inet"], check: true });
  assert.equal(conflict(again.flags).length, 1);
});

// Audit 2026-11-14, record-writers L2: the PR's change table shows dates and conditions, not regions. A rewrite that keeps
// every region adds no such flag (the B4 test above lists its flags in full).
test("a rewrite that drops a region the record had is flagged for a person", async () => {
  const { dir, get } = setup({ ...PAGES, [RING.AU]: PAGES[RING.AU].replace("Ring Chime Z Pro (2nd Generation)", "Ring Chime Z Pro (2nd Generation) - Black") });
  const { flags } = await runCandidates(dir, { sources: SOURCES, today: TODAY, get, brands: ["ring"] });
  assert.ok(flags.some((f) => f.startsWith("changed: ring-chime-z-pro-2nd-gen: the rewrite drops the region(s) AU")), flags.join("\n"));
});
