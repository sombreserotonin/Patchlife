import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStatus, statusSince } from "../scripts/status.mjs";

const TODAY = "2026-10-21";
const record = (support) => ({ support: { at_least: false, ...support } });
const fixed = (end_date) => record({ rule: "fixed_date", end_date });

test("more than 12 months left is supported", () => {
  assert.equal(computeStatus(fixed("2027-10-22"), TODAY), "supported");
});

test("exactly 12 months left is ending_soon", () => {
  assert.equal(computeStatus(fixed("2027-10-21"), TODAY), "ending_soon");
});

test("the end date itself is still ending_soon, the day after is ended", () => {
  assert.equal(computeStatus(fixed("2026-10-21"), TODAY), "ending_soon");
  assert.equal(computeStatus(fixed("2026-10-20"), TODAY), "ended");
});

test("the 12-month boundary from 29 February falls on 28 February", () => {
  assert.equal(computeStatus(fixed("2025-02-28"), "2024-02-29"), "ending_soon");
  assert.equal(computeStatus(fixed("2025-03-01"), "2024-02-29"), "supported");
});

test("a month-only date has ended only after the month's last day (D38)", () => {
  assert.equal(computeStatus(fixed("2026-10"), "2026-10-31"), "ending_soon");
  assert.equal(computeStatus(fixed("2026-10"), "2026-11-01"), "ended");
  assert.equal(computeStatus(fixed("2028-02"), "2028-02-29"), "ending_soon");
  assert.equal(computeStatus(fixed("2028-02"), "2028-03-01"), "ended");
});

test("a month-only date is ending soon once the month's first day is within a year (D38)", () => {
  assert.equal(computeStatus(fixed("2027-10"), TODAY), "ending_soon");
  assert.equal(computeStatus(fixed("2027-11"), TODAY), "supported");
  assert.equal(computeStatus(fixed("2027-11"), "2026-11-01"), "ending_soon");
});

test("a relative rule with a published anchor uses its end date", () => {
  const anchored = record({ rule: "years_after_eol", years: 3, anchor_date: "2025-03-31", end_date: "2028-03-31" });
  assert.equal(computeStatus(anchored, TODAY), "supported");
});

test("relative rules without an anchor are unknown", () => {
  for (const rule of ["years_after_eol", "years_after_launch"]) {
    assert.equal(computeStatus(record({ rule, years: 3, anchor_date: null, end_date: null }), TODAY), "unknown", rule);
  }
  for (const rule of ["years_after_manufacture", "years_after_purchase"]) {
    assert.equal(computeStatus(record({ rule, years: 2 }), TODAY), "unknown", rule);
  }
});

test("none_published is unknown", () => {
  assert.equal(computeStatus(record({ rule: "none_published" }), TODAY), "unknown");
});

// statusSince gives the first day computeStatus returns the status, so the two agree day by day (M7 feeds).
test("statusSince is the first day the status applies, for day and month-only dates and across 29 February", () => {
  const dayBefore = (isoDate) => new Date(Date.parse(`${isoDate}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const cases = [
    ["2026-10-20", "ended", "2026-10-21"],
    ["2026-10-20", "ending_soon", "2025-10-20"],
    ["2028-02-29", "ending_soon", "2027-03-01"],
    ["2028-02-29", "ended", "2028-03-01"],
    ["2027-02-28", "ending_soon", "2026-02-28"],
    ["2026-10", "ended", "2026-11-01"],
    ["2027-10", "ending_soon", "2026-10-01"],
    ["2028-02", "ended", "2028-03-01"],
  ];
  for (const [end, status, expected] of cases) {
    const since = statusSince(fixed(end), status);
    assert.equal(since, expected, `${end} ${status}`);
    assert.equal(computeStatus(fixed(end), since), status, `${end} ${status} on ${since}`);
    assert.notEqual(computeStatus(fixed(end), dayBefore(since)), status, `${end} ${status} the day before`);
  }
  assert.equal(statusSince(fixed("2026-10-20"), "supported"), null);
  assert.equal(statusSince(fixed("2026-10-20"), "unknown"), null);
  assert.equal(statusSince(record({ rule: "years_after_eol", end_date: null }), "ended"), null);
});
