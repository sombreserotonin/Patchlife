import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildReport } from "../scripts/data-report.mjs";

// Far from the real date, so a report that ignores `today` gets different statuses.
const TODAY = "2030-06-01";
const SCRIPT = fileURLToPath(new URL("../scripts/data-report.mjs", import.meta.url));
const FIXTURES = fileURLToPath(new URL("./fixtures/", import.meta.url));
const record = (brand_slug, category, end_date, status, checked = null) => ({
  brand_slug,
  category,
  support: { rule: end_date ? "fixed_date" : "none_published", end_date, at_least: false },
  verification: { status, checked },
});

const records = [
  record("ring", "doorbell", "2035-01-01", "verified", "2030-05-01"),
  record("ring", "camera", "2031-03-31", "verified", "2030-04-01"),
  record("google", "camera", "2029-12-31", "stale", "2030-01-15"),
  record("acme", "hub", null, "verified", "2030-03-01"),
  record("acme", "camera", null, "unverified", ""),
];

test("counts records by brand, category, status and verification state", () => {
  const report = buildReport(records, TODAY);
  assert.equal(report.records, 5);
  assert.deepEqual(report.brands, { acme: 2, google: 1, ring: 2 });
  assert.deepEqual(report.categories, { camera: 3, doorbell: 1, hub: 1 });
  assert.deepEqual(report.status, { supported: 1, ending_soon: 1, ended: 1, unknown: 2 });
  assert.deepEqual(report.verification, { verified: 3, unverified: 1, stale: 1, disputed: 0 });
  assert.equal(report.brandsVerified, 2);
});

test("brands and categories are sorted", () => {
  const report = buildReport(records, TODAY);
  assert.deepEqual(Object.keys(report.brands), ["acme", "google", "ring"]);
  assert.deepEqual(Object.keys(report.categories), ["camera", "doorbell", "hub"]);
});

test("a record without an end date has unknown status", () => {
  const report = buildReport([record("acme", "camera", null, "unverified")], TODAY);
  assert.deepEqual(report.status, { supported: 0, ending_soon: 0, ended: 0, unknown: 1 });
});

test("the computable share counts only verified records and rounds down", () => {
  const report = buildReport(records, TODAY);
  assert.equal(report.computable, 2);
  assert.equal(report.computablePercent, 66);
  const many = [...Array(199).fill(records[0]), records[3]];
  assert.equal(buildReport(many, TODAY).computablePercent, 99);
  assert.equal(buildReport([records[2]], TODAY).computablePercent, 0);
});

test("oldest checked ignores empty values", () => {
  assert.equal(buildReport(records, TODAY).oldestChecked, "2030-01-15");
  assert.equal(buildReport([record("acme", "camera", null, "unverified")], TODAY).oldestChecked, null);
});

test("the CLI prints the four Measures rows first, in the PLAN.md order", () => {
  const run = spawnSync(process.execPath, [SCRIPT, `${FIXTURES}valid`], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const rows = run.stdout.split("\n").slice(0, 7).map((line) => line.split(/\s{2,}/));
  assert.deepEqual(rows, [
    ["Verified records", "1"],
    ["Brands with verified records", "1"],
    ["Share with a computable status", "100% (1 of 1 verified)"],
    ["Stale records", "0"],
    [""],
    ["Records", "5"],
    ["Oldest checked", "2026-10-02"],
  ]);
});

test("the CLI reports a missing directory in one line", () => {
  const run = spawnSync(process.execPath, [SCRIPT, `${FIXTURES}missing`], { encoding: "utf8" });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /^[^\n]*missing: directory not found\n$/);
  assert.equal(run.stdout, "");
});
