import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReport } from "../scripts/data-report.mjs";

const TODAY = "2026-10-21";
const record = (brand_slug, category, end_date, status, checked = null) => ({
  brand_slug,
  category,
  support: { rule: end_date ? "fixed_date" : "none_published", end_date, at_least: false },
  verification: { status, checked },
});

const records = [
  record("ring", "doorbell", "2030-01-01", "verified", "2026-10-21"),
  record("ring", "camera", "2027-06-30", "verified", "2026-09-30"),
  record("google", "camera", "2026-01-31", "stale", "2026-08-01"),
  record("acme", "camera", null, "unverified", ""),
];

test("counts records by brand, category, status and verification state", () => {
  const report = buildReport(records, TODAY);
  assert.equal(report.records, 4);
  assert.deepEqual(report.brands, { acme: 1, google: 1, ring: 2 });
  assert.deepEqual(report.categories, { camera: 3, doorbell: 1 });
  assert.deepEqual(report.status, { supported: 1, ending_soon: 1, ended: 1, unknown: 1 });
  assert.deepEqual(report.verification, { verified: 2, unverified: 1, stale: 1, disputed: 0 });
  assert.equal(report.brandsVerified, 1);
});

test("a record without an end date has unknown status", () => {
  const report = buildReport([record("acme", "camera", null, "unverified")], TODAY);
  assert.deepEqual(report.status, { supported: 0, ending_soon: 0, ended: 0, unknown: 1 });
});

test("oldest checked ignores empty values", () => {
  assert.equal(buildReport(records, TODAY).oldestChecked, "2026-08-01");
  assert.equal(buildReport([record("acme", "camera", null, "unverified")], TODAY).oldestChecked, null);
});
