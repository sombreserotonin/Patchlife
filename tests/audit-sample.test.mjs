import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { changedIds, pickIds, sampleLines, sampleSize } from "../scripts/audit-sample.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/audit-sample.mjs", import.meta.url));
const VALID = fileURLToPath(new URL("./fixtures/valid", import.meta.url));
const ids = (n) => Array.from({ length: n }, (_, i) => `acme-${i}`);

test("the sample is 3 records or 5%, whichever is larger, at most 10 and never more than there are", () => {
  assert.deepEqual([1, 2, 3, 4, 59, 60, 61, 100, 199, 200, 500].map(sampleSize), [1, 2, 3, 3, 3, 3, 4, 5, 10, 10, 10]);
});

test("the same PR number always picks the same records, whatever the order given, and another number picks others", () => {
  // The lowest sha256("123\n<id>") of 40 ids, as `sha256sum` ranks them.
  const picked = pickIds(ids(40), "123");
  assert.deepEqual(picked, ["acme-11", "acme-10", "acme-22"]);
  assert.deepEqual(pickIds([...ids(40)].reverse(), "123"), picked);
  assert.deepEqual(pickIds([...ids(40), "acme-11", "acme-10"], "123"), picked, "a repeated id counts once");
  assert.deepEqual(pickIds(ids(40), "124"), ["acme-32", "acme-0", "acme-33"]);
  assert.deepEqual(pickIds(ids(100), "123"), ["acme-54", "acme-49", "acme-11", "acme-72", "acme-10"]);
  assert.deepEqual(pickIds(["acme-1", "acme-2"], "123").sort(), ["acme-1", "acme-2"]);
});

test("changedIds keeps the ids of changed device records and nothing else", () => {
  const paths = ["data/devices/acme/acme-cam-1.yaml", "data/devices/acme/acme-hub-4.yaml", "data/sources/seed.yaml", "docs/PLAN.md", "", "data/devices/README.md"];
  assert.deepEqual(changedIds(paths), ["acme-cam-1", "acme-hub-4"]);
});

test("each line gives the id, brand and model, end date or rule, and the first quote highlighted on its page", () => {
  assert.deepEqual(sampleLines(VALID, ["acme-cam-1", "acme-plug-3", "acme-hub-4", "acme-nope"]), [
    "acme-cam-1\tAcme Cam 1\t2029-06-30\thttps://example.com/acme/security#:~:text=Acme%20Cam%201%2030%20June%202029",
    "acme-plug-3\tAcme Plug 3\tyears_after_eol\thttps://example.com/acme/psti#:~:text=The%20defined%20support%20period%20will%20end%203%20years%20after%20the%20product's%20end%2Dof%2Dlife%20date.",
    // A none_published record has no quote to highlight, so its page is linked plain.
    "acme-hub-4\tAcme Hub 4\tnone_published\thttps://example.com/acme/hub-4",
    "acme-nope\tno record with this id",
  ]);
});

// With ids given, the CLI reads only the repository's records, so it needs neither git nor the network.
test("the CLI exits 2 without a PR number, and with ids prints the sample from them", () => {
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
  for (const args of [[], ["x1"], ["acme-cam-1", "12"]]) {
    const { status, stderr } = run(...args);
    assert.equal(status, 2, args.join(" "));
    assert.match(stderr, /Usage: node scripts\/audit-sample\.mjs <pr number> \[id \.\.\.\]/);
  }
  const { status, stdout } = run("123", "acme-nope-1", "acme-nope-2", "acme-nope-2");
  assert.equal(status, 0);
  assert.match(stdout, /^Sample for PR #123: 2 of 2 record\(s\)\n(acme-nope-[12]\tno record with this id\n){2}$/);
});
