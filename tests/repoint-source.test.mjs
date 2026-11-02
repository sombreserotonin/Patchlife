import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { repointSource } from "../scripts/repoint-source.mjs";
import { validateDevices, validateSources } from "../scripts/validate-data.mjs";
import { htmlToText, normalise } from "../scripts/verify-evidence.mjs";

const VALID = fileURLToPath(new URL("./fixtures/valid", import.meta.url));
// The registry the valid fixtures follow: the alias AC-1 of acme-cam-1 comes from its rename table (rule R1).
const SOURCES = validateSources(fileURLToPath(new URL("./fixtures/sources/valid", import.meta.url))).entries;
const SCRIPT = fileURLToPath(new URL("../scripts/repoint-source.mjs", import.meta.url));
const TODAY = "2026-10-27";
// acme-plug-3 cites the old page twice and acme-router-2 once, next to the end-of-life page.
const OLD = "https://example.com/acme/psti";
const NEW = "https://example.com/acme/security-policy";
const EOL = "https://example.com/acme/eol";
const capture = (url) => `https://web.archive.org/web/20261022015106/${url}`;
const PAGES = {
  "https://example.com/acme/security": "<p>Acme Cam 1 30 June 2029</p>",
  [EOL]: "<table><tr><td>Router 2</td><td>End of Life</td><td>31 March 2025</td></tr></table>",
  [NEW]: "<p>The defined support period will end 3 years after the product's end-of-life date.</p><p>This statement covers Acme Plug 3.</p>",
};

// A temporary copy of the valid fixtures with a fake fetcher, as the verifier's tests set up.
function setup(pages = PAGES) {
  const root = mkdtempSync(join(tmpdir(), "patchlife-repoint-"));
  const dir = join(root, "devices");
  cpSync(VALID, dir, { recursive: true });
  const fetched = [];
  const get = async (url) => {
    fetched.push(url);
    if (!(url in pages)) throw Object.assign(new Error(`HTTP 404 for ${url}`), { status: 404, url });
    return { url, contentType: "text/html", text: pages[url] };
  };
  const file = (id) => join(dir, "acme", `${id}.yaml`);
  const read = (id) => readFileSync(file(id), "utf8");
  const edit = (id, from, to) => {
    const text = read(id);
    assert.ok(text.includes(from), `${id} has no "${from}"`);
    writeFileSync(file(id), text.replace(from, to));
  };
  return { dir, get, fetched, file, read, edit, hashFile: join(root, "page-hashes.json") };
}
const original = (id) => readFileSync(join(VALID, "acme", `${id}.yaml`), "utf8");

test("a dry run lists the records citing the old URL and neither writes nor fetches", async () => {
  const { dir, get, fetched, file, read } = setup();
  const result = await repointSource(dir, OLD, NEW, { dryRun: true, get });
  assert.deepEqual(result, {
    moved: [
      { id: "acme-plug-3", file: file("acme-plug-3"), items: [0, 1] },
      { id: "acme-router-2", file: file("acme-router-2"), items: [0] },
    ],
    results: [],
    pages: [],
  });
  assert.deepEqual(fetched, []);
  for (const id of ["acme-plug-3", "acme-router-2"]) assert.equal(read(id), original(id));
});

test("moves each citing item, keeps its quote, clears its archive link and re-verifies the records", async () => {
  const { dir, get, fetched, read, edit, hashFile } = setup();
  // A capture of the old page goes; a capture of another page on the same record stays.
  edit("acme-plug-3", "    regime: uk_psti\n", `    archive_url: ${capture(OLD)}\n    regime: uk_psti\n`);
  edit("acme-router-2", "    regime: vendor_policy\n", `    archive_url: ${capture(EOL)}\n    regime: vendor_policy\n`);
  // The old page's hash goes with it; the end-of-life page's hash, stored from an earlier run, is kept.
  writeFileSync(hashFile, JSON.stringify({ [OLD]: "a".repeat(64), [EOL]: createHash("sha256").update(normalise(htmlToText(PAGES[EOL]))).digest("hex") }));
  const { moved, results, pages } = await repointSource(dir, OLD, NEW, { get, today: TODAY, hashFile });
  assert.deepEqual(moved.map((m) => m.id), ["acme-plug-3", "acme-router-2"]);
  assert.deepEqual(results, [{ id: "acme-plug-3", outcome: "verified" }, { id: "acme-router-2", outcome: "verified" }]);
  assert.deepEqual(pages, [{ url: NEW, change: "new" }, { url: EOL, change: "unchanged" }]);
  assert.deepEqual(fetched, [NEW, EOL]);
  const plug = read("acme-plug-3");
  assert.equal(plug.match(new RegExp(`url: ${NEW}\n`, "g")).length, 2);
  assert.ok(!plug.includes(OLD));
  assert.ok(plug.includes("    quote: The defined support period will end 3 years after the product's end-of-life date.\n    retrieved: \"2026-10-01\"\n    archive_url: null\n"));
  assert.ok(plug.includes("    quote: This statement covers Acme Plug 3.\n    retrieved: \"2026-10-01\"\n    regime: uk_psti\n"), "an item without an archive link gains none");
  assert.match(plug, new RegExp(`verification:\n  status: verified\n  checked: "${TODAY}"\n  text_sha256: [a-f0-9]{64}\n$`));
  const router = read("acme-router-2");
  assert.ok(router.includes(`  - url: ${NEW}\n    quote: The defined support period will end 3 years after the product's end-of-life date.\n`));
  assert.ok(router.includes(`  - url: ${EOL}\n    quote: Router 2 End of Life 31 March 2025\n    retrieved: "2026-10-01"\n    archive_url: ${capture(EOL)}\n`));
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(hashFile, "utf8"))), [EOL, NEW]);
  assert.deepEqual(validateDevices(dir, { today: TODAY, sources: SOURCES }).errors, []);
  // Records citing other pages are untouched.
  for (const id of ["acme-cam-1", "acme-hub-4", "acme-leap-5"]) assert.equal(read(id), original(id));
});

test("a moved record whose quote is not on the new page is reported: failed when unverified, stale when verified", async () => {
  const { dir, get, read, edit } = setup({ ...PAGES, [NEW]: "<p>This statement covers Acme Plug 3.</p>" });
  edit("acme-router-2", "status: unverified", 'status: verified\n  checked: "2026-09-01"');
  const { results } = await repointSource(dir, OLD, NEW, { get, today: TODAY });
  assert.deepEqual(results, [
    { id: "acme-plug-3", outcome: "failed", reason: `quote not found at ${NEW}` },
    { id: "acme-router-2", outcome: "stale", reason: `quote not found at ${NEW}` },
  ]);
  assert.match(read("acme-router-2"), new RegExp(`url: ${NEW}\n[\\s\\S]*status: stale\n`));
});

test("a URL no record cites moves nothing and fetches nothing", async () => {
  const { dir, get, fetched } = setup();
  assert.deepEqual(await repointSource(dir, "https://example.com/acme/nothing", NEW, { get }), { moved: [], results: [], pages: [] });
  assert.deepEqual(fetched, []);
});

// The dry run reads the repository's own records, so it needs no network.
test("the CLI exits 2 with a usage line on bad arguments and 1 when nothing cites the old URL", () => {
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
  for (const args of [[], ["https://a.test/x"], ["https://a.test/x", "http://a.test/y"], ["https://a.test/x", "https://a.test/x"], ["--nope", "https://a.test/x", "https://a.test/y"]]) {
    const { status, stderr } = run(...args);
    assert.equal(status, 2, args.join(" "));
    assert.match(stderr, /Usage: node --use-env-proxy scripts\/repoint-source\.mjs <old url> <new url> \[--dry-run\]/);
  }
  const { status, stdout } = run("--dry-run", "https://example.invalid/old", "https://example.invalid/new");
  assert.equal(status, 1);
  assert.equal(stdout, "No evidence item cites https://example.invalid/old\n");
});
