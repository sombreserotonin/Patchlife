import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { addYears, validateDevices } from "../scripts/validate-data.mjs";

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
