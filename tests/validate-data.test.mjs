import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { addYears, ambiguousDates, mentionsDate, mentionsYears, validateDevices, validateSources } from "../scripts/validate-data.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");
const TODAY = "2026-10-21";
// Acme's URLs write numeric dates day first (dmy), Globex's month first (mdy); Initech's entry gives no order.
const SOURCES = validateSources(join(FIXTURES, "sources", "valid")).entries;
const run = (name, sources = SOURCES) => validateDevices(join(FIXTURES, name), { today: TODAY, sources });
const runSources = (name) => validateSources(join(FIXTURES, "sources", name), { today: TODAY });
const messages = (errors) => errors.map((e) => `${e.file}: ${e.message}`).join("\n");

test("repository data passes", () => {
  const sources = validateSources(join(HERE, "..", "data", "sources")).entries;
  const { files, errors } = validateDevices(join(HERE, "..", "data", "devices"), { sources });
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
  ["date-wrong-order", /^end_date 2027-03-04 is not written in any evidence quote$/],
  ["name-not-in-quote", /^neither model "Cam 1" nor an alias appears in any evidence quote$/],
  ["month-not-in-quote", /^end_date 2027-07 is not written in any evidence quote$/],
  ["month-hides-day", /^end_date 2027-06 gives only the month, but a quote states 2027-06-30: use the full date$/],
  ["bad-month", /schema: \/support\/end_date must match pattern/],
];

test("a month-only end date passes when a quote states that month and no day in it (D38)", () => {
  const { files, errors } = run("month-only");
  assert.equal(files, 1);
  assert.deepEqual(errors, [], messages(errors));
});

for (const [name, pattern] of rejected) {
  test(`rejects ${name}`, () => {
    const { errors } = run(name);
    assert.ok(errors.some((e) => pattern.test(e.message)), messages(errors) || "no errors reported");
  });
}

// acme-cam-6 cites a page under one of Acme's registry URLs, so Acme's order covers it.
test("a registry date_order reads 3/4/2027 as 3 April on a dmy source and 4 March on an mdy source", () => {
  const { files, errors } = run("date-order");
  assert.equal(files, 2);
  assert.deepEqual(errors, [], messages(errors));
});

const AMBIGUOUS = (url, date) =>
  `quote from ${url} writes "${date}", which reads as either day/month or month/day: list the URL in a source registry entry with a date_order`;

test("without a covering date_order, the same records fail on their ambiguous dates", () => {
  const { errors } = run("date-order", []);
  assert.deepEqual(messages(errors).split("\n"), [
    "acme/acme-cam-6.yaml: end_date 2027-04-03 is not written in any evidence quote",
    `acme/acme-cam-6.yaml: ${AMBIGUOUS("https://example.com/acme/security/cam-6", "3/4/2027")}`,
    "globex/globex-cam-1.yaml: anchor_date 2025-03-04 is not written in any evidence quote",
    `globex/globex-cam-1.yaml: ${AMBIGUOUS("https://example.com/globex/end-of-life", "3/4/2025")}`,
  ]);
});

test("an ambiguous date fails on a URL no entry lists, or one whose entry has no date_order", () => {
  const { errors } = run("ambiguous-date");
  assert.deepEqual(messages(errors).split("\n"), [
    "acme/acme-cam-6.yaml: end_date 2027-04-03 is not written in any evidence quote",
    `acme/acme-cam-6.yaml: ${AMBIGUOUS("https://example.com/acme/blog/security", "3/4/2027")}`,
    `initech/initech-hub-1.yaml: ${AMBIGUOUS("https://example.com/initech/psti", "10.11.2024")}`,
  ]);
});

test("region-date splits share a model and aliases, other brands may reuse names, and an alias alone can name the model", () => {
  const { files, errors } = run("names-ok");
  assert.equal(files, 3);
  assert.deepEqual(errors, [], messages(errors));
});

test("two models of one brand may not share an alias, even in different regions", () => {
  const { errors } = run("shared-alias");
  assert.deepEqual(messages(errors).split("\n"), [
    'acme/acme-cam-2.yaml: name "ac-1" is also used by acme-cam-1; only region-date splits (same model, no region in common) may share a name',
  ]);
});

test("records of one model may not share a region", () => {
  const { errors } = run("shared-region");
  assert.deepEqual(messages(errors).split("\n"), [
    'acme/acme-cam-1.yaml: name "Cam 1" is also used by acme-cam-1-uk; only region-date splits (same model, no region in common) may share a name',
  ]);
});

test("repository sources pass", () => {
  const { sources, errors } = validateSources(join(HERE, "..", "data", "sources"));
  assert.ok(sources > 0, "expected at least one source");
  assert.deepEqual(errors, [], messages(errors));
});

test("valid source fixtures pass, including last_checked today, no note and both date orders", () => {
  const { files, sources, entries, errors } = runSources("valid");
  assert.equal(files, 2);
  assert.equal(sources, 5);
  assert.deepEqual(errors, [], messages(errors));
  assert.deepEqual(entries.map((e) => [e.brand_slug, e.date_order]), [
    ["acme", "dmy"],
    ["globex", "mdy"],
    ["initech", undefined],
    ["umbrella", undefined],
    ["hooli", undefined],
  ]);
});

test("page-hashes.json must be a sorted object of https URL to SHA-256 hex", () => {
  assert.deepEqual(runSources("page-hashes-ok").errors, []);
  assert.deepEqual(messages(runSources("page-hashes-bad").errors).split("\n"), [
    'page-hashes.json: key "http://example.com/a" is not an https URL',
    "page-hashes.json: hash for http://example.com/a is not a SHA-256 hex string",
    "page-hashes.json: keys must be sorted, as the verifier writes them",
  ]);
  assert.match(messages(runSources("page-hashes-conflict").errors), /^page-hashes\.json: JSON parse error: /);
  assert.deepEqual(messages(runSources("page-hashes-array").errors), "page-hashes.json: must be a JSON object of evidence URL to hash");
});

test("validateSources returns no entries from a file that fails the schema", () => {
  const { entries, errors } = runSources("bad-date-order");
  assert.equal(errors.length, 1, messages(errors));
  assert.deepEqual(entries, []);
});

const rejectedSources = [
  ["unknown-field", /^schema: \/0 must NOT have additional properties$/],
  ["non-https-url", /^schema: \/0\/urls\/0 must match pattern "\^https:\/\/"$/],
  ["duplicate-url", /^schema: \/0\/urls must NOT have duplicate items/],
  ["future-last-checked", /^last_checked 2026-10-22 for "acme" is in the future$/],
  ["bad-date-order", /^schema: \/0\/date_order must be equal to one of the allowed values$/],
];

for (const [name, pattern] of rejectedSources) {
  test(`rejects source ${name}`, () => {
    const { errors } = runSources(name);
    assert.ok(errors.some((e) => pattern.test(e.message)), messages(errors) || "no errors reported");
  });
}

test("rejects a brand_slug listed twice, across files or within one", () => {
  const { errors } = runSources("duplicate-brand-slug");
  const text = messages(errors);
  assert.match(text, /^b\.yaml: duplicate brand_slug "acme", also in a\.yaml$/m);
  assert.match(text, /^b\.yaml: duplicate brand_slug "initech", also in b\.yaml$/m);
  assert.equal(errors.length, 2, text);
});

test("the CLI checks source files as well as device records", () => {
  const args = [join(HERE, "..", "scripts", "validate-data.mjs"), join(FIXTURES, "valid"), join(FIXTURES, "sources", "non-https-url")];
  const { status, stdout, stderr } = spawnSync(process.execPath, args, { encoding: "utf8" });
  assert.match(stderr, /^acme\.yaml: schema: \/0\/urls\/0 must match pattern/m);
  assert.match(stdout, /^5 record\(s\) and 1 source\(s\) checked, 1 error\(s\)$/m);
  assert.equal(status, 1);
});

test("the CLI reads numeric dates in the order its source registry gives", () => {
  const args = [join(HERE, "..", "scripts", "validate-data.mjs"), join(FIXTURES, "date-order"), join(FIXTURES, "sources", "valid")];
  const { status, stdout, stderr } = spawnSync(process.execPath, args, { encoding: "utf8" });
  assert.equal(stderr, "");
  assert.match(stdout, /^2 record\(s\) and 5 source\(s\) checked, 0 error\(s\)$/m);
  assert.equal(status, 0);
});

test("addYears keeps the day and handles 29 February", () => {
  assert.equal(addYears("2025-06-11", 2), "2027-06-11");
  assert.equal(addYears("2024-02-29", 3), "2027-02-28");
  assert.equal(addYears("2024-02-29", 4), "2028-02-29");
});

test("mentionsDate finds a date in the common written forms and nowhere else", () => {
  for (const text of ["Ring Video Doorbell 3 31 December 2027", "until December 31, 2027.", "31st Dec 2027", "Dec. 31, 2027", "2027-12-31", "2027/12/31", "31/12/2027", "12/31/2027"]) {
    assert.ok(mentionsDate(text, "2027-12-31"), text);
  }
  assert.ok(mentionsDate("from 1 Sept 2026", "2026-09-01"));
  assert.ok(mentionsDate("the 3rd of March 2025", "2025-03-03"));
  assert.ok(mentionsDate("CS-T1C-A0-BG Europe 2028/1/20", "2028-01-20"));
  for (const [text, date] of [["31 December 2027", "2027-12-30"], ["131 December 2027", "2027-12-31"], ["31 December 20271", "2027-12-31"], ["December 2027", "2027-12-31"], ["2028/1/20", "2028-01-02"]]) {
    assert.equal(mentionsDate(text, date), false, `${text} / ${date}`);
  }
});

test("mentionsDate reads a numeric date only in the given order, or with no order only when it can't swap", () => {
  assert.ok(mentionsDate("Tapo C100 V5 3/4/2027 or later", "2027-04-03", "dmy"));
  assert.ok(mentionsDate("03.04.2027", "2027-04-03", "dmy"));
  assert.equal(mentionsDate("3/4/2027", "2027-03-04", "dmy"), false);
  assert.ok(mentionsDate("Nest Cam 3/4/2027", "2027-03-04", "mdy"));
  assert.equal(mentionsDate("3/4/2027", "2027-04-03", "mdy"), false);
  assert.equal(mentionsDate("12/31/2027", "2027-12-31", "dmy"), false);
  assert.equal(mentionsDate("31/12/2027", "2027-12-31", "mdy"), false);
  for (const date of ["2027-04-03", "2027-03-04"]) assert.equal(mentionsDate("3/4/2027", date), false, date);
  assert.ok(mentionsDate("4/4/2027", "2027-04-04"));
  assert.ok(mentionsDate("13/4/2027", "2027-04-13"));
  assert.ok(mentionsDate("4/13/2027", "2027-04-13"));
  for (const order of [undefined, "dmy", "mdy"]) {
    assert.ok(mentionsDate("CS-T1C-A0-BG Europe 2028/1/20", "2028-01-20", order), `year first, ${order}`);
    assert.ok(mentionsDate("June 11, 2027 or later", "2027-06-11", order), `month name, ${order}`);
  }
});

test("mentionsDate finds a month-only date as the month and year, and nowhere else", () => {
  for (const text of ["until June 2027", "Jun 2027", "Jun. 2027", "June, 2027", "2027-06", "30 June 2027"]) assert.ok(mentionsDate(text, "2027-06"), text);
  assert.ok(mentionsDate("Sept 2026", "2026-09"));
  for (const [text, date] of [["July 2027", "2027-06"], ["June 2026", "2027-06"], ["June 20271", "2027-06"], ["2027-061", "2027-06"], ["12027-06", "2027-06"]]) {
    assert.equal(mentionsDate(text, date), false, `${text} / ${date}`);
  }
});

test("ambiguousDates lists numeric dates whose day and month could swap", () => {
  assert.deepEqual(ambiguousDates("from 3/4/2027 to 10.11.2028, 12/1/2029 and 01/12/2029"), ["3/4/2027", "10.11.2028", "12/1/2029", "01/12/2029"]);
  assert.deepEqual(ambiguousDates("31/12/2027 12/31/2027 4/4/2027 04/4/2027 13/1/2027 2029/8/2 2027-03-04 v4.3.25 22.03.4 112/4/2027 3/4/20271"), []);
});

test("mentionsYears finds the number of years as digits or words", () => {
  assert.ok(mentionsYears("will end 3 years after the end-of-life date", 3));
  assert.ok(mentionsYears("for three years", 3));
  assert.ok(mentionsYears("a 5-year support period", 5));
  assert.ok(mentionsYears("for a year after", 1));
  assert.equal(mentionsYears("13 years", 3), false);
  assert.equal(mentionsYears("3 months", 3), false);
});
