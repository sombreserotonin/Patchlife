import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { USER_AGENT, createFetcher } from "../scripts/polite-fetch.mjs";
import { verificationOnlyProblems } from "../scripts/verification-only.mjs";
import { htmlToText, normalise, pageReport, verifyDevices } from "../scripts/verify-evidence.mjs";

// The M3 exit check, part 2 (TASKS.md, 22 Oct 2026): a deliberately broken source is detected and flagged. A local
// server plays the maker's site with four pages: one as cited, one with its quote removed, one gone and one that
// redirects to another page. The real polite fetcher reads it through Node's fetch, with its one-second gap between
// requests faked so the test takes milliseconds. Every URL is on 127.0.0.1, so nothing reaches the internet.
const TODAY = "2026-10-22";
const GOOD = "<h1>Security updates</h1><table><tr><td>Acme Cam A</td><td>30 June 2029</td></tr></table>";
const PAGES = {
  "/robots.txt": ["text/plain", "User-agent: *\nDisallow: /private\n"],
  "/good": ["text/html", GOOD],
  "/removed": ["text/html", "<h1>Security updates</h1><p>This page no longer lists Acme Cam B.</p>"],
  // The quote of the record citing /moved is here, so reading the page it redirects to would verify that record.
  "/elsewhere": ["text/html", "<h1>Welcome</h1><p>Acme Cam D 31 December 2030</p>"],
};

// A verified record in the shape of the real ones.
const record = (id, model, url, quote) => `id: ${id}
brand: Acme
brand_slug: acme
model: ${model}
category: camera
regions: [AU]
support:
  rule: fixed_date
  end_date: "2029-06-30"
  at_least: false
evidence:
  - url: ${url}
    quote: ${quote}
    retrieved: "2026-10-01"
    archive_url: null
    regime: vendor_policy
verification:
  status: verified
  checked: "2026-08-01"
  text_sha256: ${"a".repeat(64)}
`;

test("the verifier keeps a good page verified, marks a vanished quote and a gone page stale, and reports a moved page without touching it", async (t) => {
  const requests = [];
  const server = createServer((req, res) => {
    requests.push({ path: req.url, agent: req.headers["user-agent"] });
    if (req.url === "/moved") {
      res.writeHead(302, { location: "/elsewhere" });
      return res.end();
    }
    const page = PAGES[req.url];
    res.writeHead(page ? 200 : 404, { "content-type": page ? page[0] : "text/html" });
    res.end(page ? page[1] : "<p>Not found</p>");
  });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const origin = `http://127.0.0.1:${server.address().port}`;

  // A throwaway repository with the four records committed, so the gate for a merge without an audit (RUNBOOKS A9)
  // can run on the result, as reverify.yml runs it before pushing.
  const root = mkdtempSync(join(tmpdir(), "patchlife-drill-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const devices = join(root, "data", "devices");
  mkdirSync(join(devices, "acme"), { recursive: true });
  mkdirSync(join(root, "data", "sources"));
  const records = [
    ["acme-cam-a", "Cam A", `${origin}/good`, "Acme Cam A 30 June 2029"],
    ["acme-cam-b", "Cam B", `${origin}/removed`, "Acme Cam B 30 June 2029"],
    ["acme-cam-c", "Cam C", `${origin}/gone`, "Acme Cam C 30 June 2029"],
    ["acme-cam-d", "Cam D", `${origin}/moved`, "Acme Cam D 31 December 2030"],
  ];
  for (const [id, ...rest] of records) writeFileSync(join(devices, "acme", `${id}.yaml`), record(id, ...rest));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
  git("init", "-q");
  git("add", ".");
  git("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-qm", "base");
  const read = (id) => readFileSync(join(devices, "acme", `${id}.yaml`), "utf8");
  const before = read("acme-cam-d");

  let clock = 0;
  const get = createFetcher({ now: () => clock, sleep: async (ms) => { clock += ms; } });
  const hashFile = join(root, "data", "sources", "page-hashes.json");
  const { results, pages } = await verifyDevices(devices, { get, today: TODAY, hashFile });

  // The lines the CLI prints.
  assert.deepEqual(results.map((r) => `${r.id}: ${r.outcome}${r.reason ? ` (${r.reason})` : ""}`), [
    "acme-cam-a: verified",
    `acme-cam-b: stale (quote not found at ${origin}/removed)`,
    `acme-cam-c: stale (HTTP 404 for ${origin}/gone)`,
    `acme-cam-d: error (redirected to ${origin}/elsewhere)`,
  ]);
  const hash = createHash("sha256").update(normalise(htmlToText(GOOD))).digest("hex");
  assert.match(read("acme-cam-a"), new RegExp(`verification:\n  status: verified\n  checked: "${TODAY}"\n  text_sha256: ${hash}\n$`));
  assert.match(read("acme-cam-b"), /verification:\n  status: stale\n  checked: "2026-08-01"\n/);
  assert.match(read("acme-cam-c"), /verification:\n  status: stale\n  checked: "2026-08-01"\n/);
  assert.equal(read("acme-cam-d"), before);
  // Only the pages read get a hash: the gone page has no text, and the moved page's text is never read.
  assert.deepEqual(pageReport(pages), [`${origin}/good: page not seen before`, `${origin}/removed: page not seen before`, "2 page(s) read: 0 changed, 0 unchanged, 2 not seen before"]);
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(hashFile, "utf8"))), [`${origin}/good`, `${origin}/removed`]);
  // The commit the workflow would push holds only verification changes, so the bot may merge it (RUNBOOKS A9).
  assert.deepEqual(verificationOnlyProblems("HEAD", root), []);
  // Every request went to the local server as PatchlifeBot, a second apart: robots.txt once, each page once and the
  // redirect's hop.
  assert.deepEqual(requests.map((r) => r.path), ["/robots.txt", "/good", "/removed", "/gone", "/moved", "/elsewhere"]);
  assert.ok(requests.every((r) => r.agent === USER_AGENT));
  assert.equal(clock, 5000);
});
