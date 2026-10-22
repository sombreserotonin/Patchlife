import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { allowed, checkLicences } from "../scripts/check-licences.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/check-licences.mjs", import.meta.url));
const LOCKFILE = fileURLToPath(new URL("../package-lock.json", import.meta.url));

test("each licence D9 and D30 allow passes on its own, and others don't", () => {
  const ok = ["MIT", "ISC", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "0BSD", "MPL-2.0", "LGPL-2.1-only", "LGPL-2.1-or-later", "LGPL-3.0-only", "LGPL-3.0-or-later", "LGPL-2.1", "LGPL-3.0", "GPL-3.0-only", "GPL-3.0-or-later", "GPL-3.0", "AGPL-3.0-only", "AGPL-3.0-or-later", "AGPL-3.0"];
  for (const id of ok) assert.equal(allowed(id), true, id);
  const not = ["GPL-2.0-only", "GPL-2.0", "GPL-2.0-or-later", "LGPL-2.0-only", "AGPL-1.0-only", "SSPL-1.0", "BUSL-1.1", "CC0-1.0", "CC-BY-4.0", "Unlicense", "UNLICENSED", "SEE LICENSE IN LICENSE", "LicenseRef-Proprietary", "mit", "LGPL-2.1+", "MIT,"];
  for (const id of not) assert.equal(allowed(id), false, id);
});

test("OR passes when either side does, AND only when both do", () => {
  assert.equal(allowed("(MIT OR CC0-1.0)"), true);
  assert.equal(allowed("CC0-1.0 OR MIT"), true);
  assert.equal(allowed("GPL-2.0-only OR SSPL-1.0"), false);
  assert.equal(allowed("MIT AND Apache-2.0"), true);
  assert.equal(allowed("MIT AND GPL-2.0-only"), false);
  assert.equal(allowed("GPL-2.0-only AND MIT"), false);
  assert.equal(allowed("CC0-1.0 OR GPL-2.0-only OR ISC"), true);
  assert.equal(allowed("MIT AND ISC AND CC0-1.0"), false);
});

test("parentheses nest, and AND binds tighter than OR", () => {
  assert.equal(allowed("((MIT OR CC0-1.0) AND (Apache-2.0 OR GPL-2.0-only))"), true);
  assert.equal(allowed("(MIT OR CC0-1.0) AND (SSPL-1.0 OR GPL-2.0-only)"), false);
  assert.equal(allowed("MIT AND (GPL-2.0-only OR (ISC AND BSD-3-Clause))"), true);
  assert.equal(allowed("MIT AND (GPL-2.0-only OR (ISC AND CC0-1.0))"), false);
  // ISC OR (MIT AND GPL-2.0-only), so ISC is enough; read left to right, it would be refused.
  assert.equal(allowed("ISC OR MIT AND GPL-2.0-only"), true);
  // (MIT AND GPL-2.0-only) OR SSPL-1.0: neither side passes.
  assert.equal(allowed("MIT AND GPL-2.0-only OR SSPL-1.0"), false);
});

test("anything but a plain SPDX expression is refused, even when an allowed licence is in it", () => {
  const bad = ["", " ", "()", "(MIT", "(MIT ISC", "MIT)", "((MIT)", "MIT OR", "OR MIT", "MIT AND", "MIT OR AND", "MIT OR )", "MIT OR OR ISC", "MIT MIT", "MIT or ISC", "MIT and ISC", "GPL-3.0-only WITH GCC-exception-3.1", "MIT OR (GPL-3.0-only WITH Classpath-exception-2.0)"];
  for (const spdx of bad) assert.equal(allowed(spdx), false, JSON.stringify(spdx));
  for (const value of [undefined, null, 1, { type: "MIT" }, ["MIT"]]) assert.equal(allowed(value), false, JSON.stringify(value));
});

test("the real lockfile passes", () => {
  const lock = JSON.parse(readFileSync(LOCKFILE, "utf8"));
  const { checked, problems } = checkLicences(lock);
  assert.deepEqual(problems, []);
  assert.equal(checked, Object.keys(lock.packages).length - 1);
});

test("a package licensed GPL-2.0-only, or with no licence, is listed; the root package is Patchlife and is skipped", () => {
  const lock = {
    lockfileVersion: 3,
    packages: {
      "": { name: "patchlife" },
      "node_modules/a": { license: "MIT" },
      "node_modules/b": { license: "GPL-2.0-only" },
      "node_modules/c": {},
      "node_modules/d": { license: " " },
      "node_modules/a/node_modules/e": { license: "(MIT OR GPL-2.0-only)" },
    },
  };
  assert.deepEqual(checkLicences(lock), { checked: 5, problems: ["node_modules/b: GPL-2.0-only", "node_modules/c: no licence", "node_modules/d: no licence"] });
});

test("a lockfile that isn't version 3 is refused", () => {
  for (const lock of [{ lockfileVersion: 2, packages: {} }, { lockfileVersion: 3 }, { lockfileVersion: 3, packages: null }, null]) {
    assert.throws(() => checkLicences(lock), /not a version 3 package-lock\.json/, JSON.stringify(lock));
  }
});

test("the CLI exits 0 on the real lockfile, 1 when a licence isn't allowed, and 2 when it can't read the file", (t) => {
  const ok = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /^\d+ package\(s\) checked, all licences allowed\n$/);
  const dir = mkdtempSync(join(tmpdir(), "patchlife-licences-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "package-lock.json");
  writeFileSync(file, JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/a": { license: "MIT" }, "node_modules/b": { license: "GPL-2.0-only" } } }));
  const bad = spawnSync(process.execPath, [SCRIPT, file], { encoding: "utf8" });
  assert.equal(bad.status, 1);
  assert.equal(bad.stderr, "node_modules/b: GPL-2.0-only\n");
  assert.equal(bad.stdout, "1 of 2 package(s) have a missing or disallowed licence (D9, D30)\n");
  const missing = spawnSync(process.execPath, [SCRIPT, join(dir, "nothing.json")], { encoding: "utf8" });
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /nothing\.json: ENOENT/);
});
