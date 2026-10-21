import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { addYears, mentionsDate, mentionsYears, validateDevices } from "../scripts/validate-data.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");
const TODAY = "2026-10-21";
const run = (name) => validateDevices(join(FIXTURES, name), { today: TODAY });
const messages = (errors) => errors.map((e) => `${e.file}: ${e.message}`).join("\n");

test("repository data passes", () => {
  const { files, errors } = validateDevices(join(HERE, "..", "data", "devices"));
  assert.ok(files > 0, "expected at least one record");
  assert.deepEqual(errors, [], messages(errors));
});

test("valid fixtures pass", () => {
  const { files, errors } = run("valid");
  assert.equal(files, 5);
  assert.deepEqual(errors, [], messages(errors));
});

const rejected = [
  ["missing-quote", /required property 'quote'/],
  ["id-mismatch", /must match filename/],
  ["bad-anchor-math", /anchor_date \+ 3 years \(2028-03-31\)/],
  ["verified-without-date", /verification\/checked/],
  ["unknown-field", /additional properties/],
  ["future-retrieved", /in the future/],
  ["duplicate-id", /duplicate id/],
  ["date-not-in-quote", /end_date 2029-06-29 is not written in any evidence quote/],
  ["years-not-in-quote", /years 2 is not stated in any evidence quote/],
];

for (const [name, pattern] of rejected) {
  test(`rejects ${name}`, () => {
    const { errors } = run(name);
    assert.ok(errors.some((e) => pattern.test(e.message)), messages(errors) || "no errors reported");
  });
}

test("addYears keeps the day and handles 29 February", () => {
  assert.equal(addYears("2025-06-11", 2), "2027-06-11");
  assert.equal(addYears("2024-02-29", 3), "2027-02-28");
  assert.equal(addYears("2024-02-29", 4), "2028-02-29");
});

test("mentionsDate finds a date in the common written forms and nowhere else", () => {
  for (const text of ["Ring Video Doorbell 3 31 December 2027", "until December 31, 2027.", "31st Dec 2027", "Dec. 31, 2027", "2027-12-31", "31/12/2027", "12/31/2027"]) {
    assert.ok(mentionsDate(text, "2027-12-31"), text);
  }
  assert.ok(mentionsDate("from 1 Sept 2026", "2026-09-01"));
  assert.ok(mentionsDate("the 3rd of March 2025", "2025-03-03"));
  for (const [text, date] of [["31 December 2027", "2027-12-30"], ["131 December 2027", "2027-12-31"], ["31 December 20271", "2027-12-31"], ["December 2027", "2027-12-31"]]) {
    assert.equal(mentionsDate(text, date), false, `${text} / ${date}`);
  }
});

test("mentionsYears finds the number of years as digits or words", () => {
  assert.ok(mentionsYears("will end 3 years after the end-of-life date", 3));
  assert.ok(mentionsYears("for three years", 3));
  assert.ok(mentionsYears("a 5-year support period", 5));
  assert.ok(mentionsYears("for a year after", 1));
  assert.equal(mentionsYears("13 years", 3), false);
  assert.equal(mentionsYears("3 months", 3), false);
});
