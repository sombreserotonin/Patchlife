import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, cpSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { withdrawnNotes, withdrawRecord } from "../scripts/withdraw-record.mjs";
import { validateDevices, validateSources } from "../scripts/validate-data.mjs";

const VALID = fileURLToPath(new URL("./fixtures/valid", import.meta.url));
const SCRIPT = fileURLToPath(new URL("../scripts/withdraw-record.mjs", import.meta.url));
// The registry the valid fixtures follow, so rule R1 can vouch for acme-cam-1's alias AC-1.
const SOURCES = validateSources(fileURLToPath(new URL("./fixtures/sources/valid", import.meta.url))).entries;
const TODAY = "2026-10-27";

const copy = () => {
  const dir = mkdtempSync(join(tmpdir(), "patchlife-withdraw-"));
  cpSync(VALID, dir, { recursive: true });
  return dir;
};
const read = (dir, id) => YAML.parse(readFileSync(join(dir, "acme", `${id}.yaml`), "utf8"));

test("withdrawing a record leaves none_published, no quotes, unverified and the withdrawal note, and it validates (O8)", () => {
  const dir = copy();
  const before = read(dir, "acme-cam-1");
  assert.equal(before.support.rule, "fixed_date");
  const { file, droppedNotes } = withdrawRecord(dir, "acme-cam-1", "the page now gives 30 June 2027", { today: TODAY });
  assert.equal(file, join(dir, "acme", "acme-cam-1.yaml"));
  assert.equal(droppedNotes, false);
  const after = read(dir, "acme-cam-1");
  assert.deepEqual(after.support, { rule: "none_published", end_date: null, years: null, anchor_date: null, at_least: false, conditions: null });
  assert.deepEqual(
    after.evidence,
    [...new Set(before.evidence.map((item) => item.url))].map((url) => {
      const item = before.evidence.find((ev) => ev.url === url);
      return { url, retrieved: item.retrieved, regime: item.regime };
    }),
    "one item per cited page, with no quote and no archive link",
  );
  assert.deepEqual(after.verification, { status: "unverified" });
  assert.equal(after.notes, `Withdrawn pending review (2026-10-27): the page now gives 30 June 2027.${before.notes ? ` ${before.notes}` : ""}`);
  for (const key of ["id", "brand", "brand_slug", "model", "aliases", "category", "regions"]) assert.deepEqual(after[key], before[key], key);
  assert.deepEqual(validateDevices(dir, { today: TODAY, sources: SOURCES }).errors, []);
  // The other records are untouched.
  assert.equal(readFileSync(join(dir, "acme", "acme-router-2.yaml"), "utf8"), readFileSync(join(VALID, "acme", "acme-router-2.yaml"), "utf8"));
  // A second withdrawal has nothing to pull.
  assert.throws(() => withdrawRecord(dir, "acme-cam-1", "again", { today: TODAY }), /already none_published/);
});

test("an unknown id throws, and the notes keep the schema's limit", () => {
  assert.throws(() => withdrawRecord(copy(), "acme-cam-9", "gone", { today: TODAY }), /No record has the id "acme-cam-9"/);
  assert.equal(withdrawnNotes(null, TODAY, "a reason."), "Withdrawn pending review (2026-10-27): a reason.");
  assert.equal(withdrawnNotes("Old note.", TODAY, " a reason "), "Withdrawn pending review (2026-10-27): a reason. Old note.");
  assert.equal(withdrawnNotes("x".repeat(480), TODAY, "too long to keep"), "Withdrawn pending review (2026-10-27): too long to keep.");
  assert.throws(() => withdrawnNotes(null, TODAY, "x".repeat(470)), /The reason is too long: notes hold 500 characters, and the withdrawal sentence has 510/);
  // Old notes are dropped when they no longer fit beside the sentence (the valid fixtures carry none, so one is added).
  const dir = copy();
  appendFileSync(join(dir, "acme", "acme-plug-3.yaml"), "notes: Old note.\n");
  assert.equal(read(dir, "acme-plug-3").notes, "Old note.");
  const { droppedNotes } = withdrawRecord(dir, "acme-plug-3", "y".repeat(455), { today: TODAY });
  assert.equal(droppedNotes, true);
  assert.equal(read(dir, "acme-plug-3").notes, `Withdrawn pending review (2026-10-27): ${"y".repeat(455)}.`);
  assert.deepEqual(validateDevices(dir, { today: TODAY, sources: SOURCES }).errors, []);
});

test("the CLI exits 2 with the usage line on bad arguments and 1 for an unknown id, writing nothing", () => {
  const bad = spawnSync(process.execPath, [SCRIPT, "acme-cam-1"], { encoding: "utf8" });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /^Usage: node scripts\/withdraw-record\.mjs <id> <reason>\n$/);
  const long = spawnSync(process.execPath, [SCRIPT, "acme-cam-1", "x".repeat(470)], { encoding: "utf8" });
  assert.equal(long.status, 2);
  assert.match(long.stderr, /^The reason is too long: .*\nUsage: /);
  const unknown = spawnSync(process.execPath, [SCRIPT, "nobody-cam-0", "a reason"], { encoding: "utf8" });
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /^No record has the id "nobody-cam-0"\n$/);
  assert.equal(spawnSync("git", ["status", "--porcelain", "--", "data"], { encoding: "utf8" }).stdout, "", "the real data is untouched");
});
