import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { verificationOnlyProblems } from "../scripts/verification-only.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "..", "scripts", "verification-only.mjs");

// A throwaway repository holding the valid fixtures as data/devices, committed once.
function repo(t) {
  const dir = mkdtempSync(join(tmpdir(), "patchlife-verify-only-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(join(HERE, "fixtures", "valid"), join(dir, "data", "devices"), { recursive: true });
  mkdirSync(join(dir, "data", "sources"));
  writeFileSync(join(dir, "data", "sources", "seed.yaml"), "- brand: Acme\n");
  writeFileSync(join(dir, "README.md"), "fixture\n");
  const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
  git("init", "-q");
  git("add", ".");
  git("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-qm", "base");
  const file = (id) => join(dir, "data", "devices", "acme", `${id}.yaml`);
  const edit = (id, from, to) => {
    const text = readFileSync(file(id), "utf8");
    assert.ok(text.includes(from), `${id} has no "${from}"`);
    writeFileSync(file(id), text.replace(from, to));
  };
  return { dir, git, file, edit, problems: (ref) => verificationOnlyProblems(ref, dir) };
}

test("verification fields and the page hash file may change", (t) => {
  const r = repo(t);
  assert.deepEqual(r.problems(), []);
  r.edit("acme-cam-1", 'checked: "2026-10-02"', 'checked: "2026-12-01"\n  text_sha256: ' + "a".repeat(64));
  r.edit("acme-leap-5", "status: unverified", "status: stale");
  writeFileSync(join(r.dir, "data", "sources", "page-hashes.json"), '{"https://example.com/acme/security": "x"}\n');
  assert.deepEqual(r.problems(), []);
});

test("an empty archive link filled with a capture of its item's page counts as verification; other link changes don't (D43)", (t) => {
  const r = repo(t);
  const capture = (url) => `https://web.archive.org/web/20261022015106/${url}`;
  const commit = () => r.git("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-qam", "change");
  // Real records carry archive_url: null; the fixtures leave it out.
  r.edit("acme-plug-3", "    regime: uk_psti\n", "    archive_url: null\n    regime: uk_psti\n");
  commit();
  r.edit("acme-plug-3", "    archive_url: null\n", `    archive_url: ${capture("https://example.com/acme/psti")}\n`);
  r.edit("acme-cam-1", "    regime: au_smart_device_rules\n", `    regime: au_smart_device_rules\n    archive_url: ${capture("https://example.com/acme/security")}\n`);
  assert.deepEqual(r.problems(), []);
  commit();
  r.edit("acme-cam-1", "20261022015106", "20261023000000");
  r.edit("acme-leap-5", "    regime: vendor_policy\n", `    regime: vendor_policy\n    archive_url: ${capture("https://example.com/acme/other")}\n`);
  r.edit("acme-router-2", "    regime: vendor_policy\n", "    regime: vendor_policy\n    archive_url: https://example.com/acme/copy\n");
  r.edit("acme-plug-3", `    archive_url: ${capture("https://example.com/acme/psti")}\n`, "    archive_url: null\n");
  assert.deepEqual(r.problems(), [
    "data/devices/acme/acme-cam-1.yaml: changes more than the verification block",
    "data/devices/acme/acme-leap-5.yaml: changes more than the verification block",
    "data/devices/acme/acme-plug-3.yaml: changes more than the verification block",
    "data/devices/acme/acme-router-2.yaml: changes more than the verification block",
  ]);
});

test("a record that already has an archive link may gain another, and its verification may change (D43)", (t) => {
  const r = repo(t);
  const capture = (url) => `https://web.archive.org/web/20261022015106/${url}`;
  const commit = () => r.git("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-qam", "change");
  // As on 24 Oct: one item linked on an earlier night, the other filled now, with a re-check in the same run.
  r.edit("acme-router-2", "    regime: uk_psti\n", `    regime: uk_psti\n    archive_url: ${capture("https://example.com/acme/psti")}\n`);
  r.edit("acme-router-2", "    regime: vendor_policy\n", "    regime: vendor_policy\n    archive_url: null\n");
  commit();
  r.edit("acme-router-2", "    archive_url: null\n", `    archive_url: ${capture("https://example.com/acme/eol")}\n`);
  r.edit("acme-router-2", "  status: unverified\n", "  status: verified\n  checked: \"2026-10-24\"\n");
  assert.deepEqual(r.problems(), []);
  commit();
  // An existing link still may not change.
  r.edit("acme-router-2", "20261022015106/https://example.com/acme/psti", "20261023000000/https://example.com/acme/psti");
  assert.deepEqual(r.problems(), ["data/devices/acme/acme-router-2.yaml: changes more than the verification block"]);
});

test("a change outside the verification block is reported, as is a new, deleted, renamed or other data file", (t) => {
  const r = repo(t);
  r.edit("acme-cam-1", 'end_date: "2029-06-30"', 'end_date: "2029-06-29"');
  r.edit("acme-leap-5", "Acme Leap 5 gets", "Acme Leap 5 now gets");
  writeFileSync(join(r.dir, "data", "devices", "acme", "acme-new-9.yaml"), "id: acme-new-9\n");
  unlinkSync(r.file("acme-plug-3"));
  renameSync(r.file("acme-hub-4"), r.file("acme-hub-5"));
  writeFileSync(join(r.dir, "data", "sources", "seed.yaml"), "- brand: Acme\n  last_checked: null\n");
  assert.deepEqual(r.problems(), [
    "data/devices/acme/acme-cam-1.yaml: changes more than the verification block",
    "data/devices/acme/acme-hub-4.yaml: deleted or unreadable",
    "data/devices/acme/acme-hub-5.yaml: new file",
    "data/devices/acme/acme-leap-5.yaml: changes more than the verification block",
    "data/devices/acme/acme-new-9.yaml: new file",
    "data/devices/acme/acme-plug-3.yaml: deleted or unreadable",
    "data/sources/seed.yaml: data other than a device record or the page hash file",
  ]);
});

test("files outside data/ are not data and are ignored", (t) => {
  const r = repo(t);
  writeFileSync(join(r.dir, "README.md"), "changed\n");
  mkdirSync(join(r.dir, ".agent"));
  writeFileSync(join(r.dir, ".agent", "LOG.md"), "- a line\n");
  assert.deepEqual(r.problems(), []);
});

test("committed changes count against an earlier ref, and the CLI exits 1 on a problem", (t) => {
  const r = repo(t);
  const base = r.git("rev-parse", "HEAD").trim();
  r.edit("acme-cam-1", "quote: Acme Cam 1 30 June 2029", "quote: Acme Cam 1 until 30 June 2029");
  r.git("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-qam", "quote");
  assert.deepEqual(r.problems(), []);
  assert.deepEqual(r.problems(base), ["data/devices/acme/acme-cam-1.yaml: changes more than the verification block"]);
  const bad = spawnSync(process.execPath, [SCRIPT, base], { cwd: r.dir, encoding: "utf8" });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /acme-cam-1\.yaml: changes more than the verification block/);
  writeFileSync(join(r.dir, "data", "sources", "page-hashes.json"), "{}\n");
  const ok = spawnSync(process.execPath, [SCRIPT], { cwd: join(r.dir, "data", "devices"), encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /Only verification changed/);
  writeFileSync(join(r.dir, "data", "sources", "extra.yaml"), "untracked outside the current folder\n");
  const top = spawnSync(process.execPath, [SCRIPT], { cwd: join(r.dir, "data", "devices"), encoding: "utf8" });
  assert.equal(top.status, 1);
  assert.match(top.stderr, /^data\/sources\/extra\.yaml: data other than a device record or the page hash file$/m);
});

test("a committed rename shows as the old record deleted and a new file", (t) => {
  const r = repo(t);
  const base = r.git("rev-parse", "HEAD").trim();
  renameSync(r.file("acme-hub-4"), r.file("acme-hub-5"));
  r.git("add", "-A");
  r.git("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-qm", "rename");
  assert.deepEqual(r.problems(base), ["data/devices/acme/acme-hub-4.yaml: deleted or unreadable", "data/devices/acme/acme-hub-5.yaml: new file"]);
});
