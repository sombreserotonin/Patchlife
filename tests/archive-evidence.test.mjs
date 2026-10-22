import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { archiveEvidence } from "../scripts/archive-evidence.mjs";
import { validateDevices } from "../scripts/validate-data.mjs";

const VALID = fileURLToPath(new URL("./fixtures/valid", import.meta.url));
const TS = "20261022015106";
const capture = (url) => `https://web.archive.org/web/${TS}/${url}`;
const html = (text) => ({ contentType: "text/html", text });
// Save Page Now's answers and the raw captures, by URL requested; anything else is a 404.
const ROUTES = {
  "https://web.archive.org/save/https://example.com/acme/security": { url: capture("https://example.com/acme/security"), ...html("") },
  [`https://web.archive.org/web/${TS}id_/https://example.com/acme/security`]: html("<td>Acme Cam 1</td><td>30 June 2029</td>"),
  "https://web.archive.org/save/https://example.com/acme/psti": { url: capture("https://example.com/acme/psti"), ...html("") },
  [`https://web.archive.org/web/${TS}id_/https://example.com/acme/psti`]: html("<p>The defined support period will end 3 years after the product&#39;s end-of-life date.</p>"),
  // No capture: the save page itself comes back.
  "https://web.archive.org/save/https://example.com/acme/eol": html("Sorry, we could not capture this page"),
  // The page redirected when it was captured.
  "https://web.archive.org/save/https://example.com/acme/leap-5": { url: capture("https://example.com/acme/leap-5"), ...html("") },
  [`https://web.archive.org/web/${TS}id_/https://example.com/acme/leap-5`]: { url: `https://web.archive.org/web/${TS}id_/https://example.com/`, ...html("Home") },
};
function setup() {
  const dir = join(mkdtempSync(join(tmpdir(), "archive-")), "devices");
  cpSync(VALID, dir, { recursive: true });
  const calls = [];
  const get = async (url) => {
    calls.push(url);
    if (!(url in ROUTES)) throw Object.assign(new Error(`HTTP 404 for ${url}`), { status: 404, url });
    return { url, ...ROUTES[url] };
  };
  const read = (name) => readFileSync(join(dir, "acme", `${name}.yaml`), "utf8");
  return { dir, get, calls, read };
}

test("links each quoted item whose quote the capture holds, and leaves the rest and failed pages unchanged", async () => {
  const { dir, get, calls, read } = setup();
  const results = await archiveEvidence(dir, { get });
  assert.deepEqual(results, [
    { url: "https://example.com/acme/eol", error: "Save Page Now ended at https://web.archive.org/save/https://example.com/acme/eol, not a capture of this page" },
    { url: "https://example.com/acme/leap-5", error: `the capture redirects to https://web.archive.org/web/${TS}id_/https://example.com/` },
    { url: "https://example.com/acme/psti", archiveUrl: capture("https://example.com/acme/psti"), linked: 2, missing: 1 },
    { url: "https://example.com/acme/security", archiveUrl: capture("https://example.com/acme/security"), linked: 1, missing: 0 },
  ]);
  // hub-4 has no quote to check, so its page is never saved.
  assert.ok(!calls.some((url) => url.includes("hub-4")));
  const original = (name) => readFileSync(join(VALID, "acme", `${name}.yaml`), "utf8");
  const linked = (text, after, url) => text.replace(after, `${after}    archive_url: ${capture(url)}\n`);
  assert.equal(read("acme-cam-1"), linked(original("acme-cam-1"), "    regime: au_smart_device_rules\n", "https://example.com/acme/security"));
  const plug = read("acme-plug-3");
  assert.equal(plug.match(/archive_url: (.*)/g).length, 1, "the second quote is not in the capture");
  assert.equal(plug, linked(original("acme-plug-3"), "    regime: uk_psti\n", "https://example.com/acme/psti"));
  assert.equal(read("acme-router-2"), linked(original("acme-router-2"), "    regime: uk_psti\n", "https://example.com/acme/psti"));
  for (const name of ["acme-leap-5", "acme-hub-4"]) assert.equal(read(name), original(name));
  assert.deepEqual(validateDevices(dir, { today: "2026-10-22" }).errors, []);
});

test("skips linked items; urls and limit choose the pages", async () => {
  const { dir, get, calls } = setup();
  await archiveEvidence(dir, { get, urls: ["https://example.com/acme/security"] });
  assert.deepEqual(calls, ["https://web.archive.org/save/https://example.com/acme/security", `https://web.archive.org/web/${TS}id_/https://example.com/acme/security`]);
  calls.length = 0;
  assert.deepEqual(await archiveEvidence(dir, { get, urls: ["https://example.com/acme/security"] }), []);
  // Sorted: eol, leap-5, psti; security is fully linked now.
  assert.deepEqual((await archiveEvidence(dir, { get, limit: 2 })).map((r) => r.url), ["https://example.com/acme/eol", "https://example.com/acme/leap-5"]);
  assert.equal(calls.length, 3);
});
