// Reproductions of the findings the audit of 14 Nov 2026 left open (docs/audits/2026-11-14-*.md, findings.jsonl).
// Each test fails while its defect is present and passes once it is fixed. npm test does not run this folder, so the
// suite stays green; a later sweep runs it with `node --test tests/audit/open-findings.test.mjs`, or one test with
// --test-name-pattern, as findings.jsonl records. A finding fixed later moves its test into the regular suite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { mismatches, runCandidates } from "../../scripts/candidates.mjs";
import { validateSources } from "../../scripts/validate-data.mjs";
import { htmlToText } from "../../scripts/verify-evidence.mjs";
import { FIXTURES, PAGES, fixtureSources } from "../fixtures/parsers/profiles.mjs";

const SOURCES = fixtureSources(validateSources(fileURLToPath(new URL("../../data/sources", import.meta.url))).entries);
const TODAY = "2026-10-27";

function setup(t, pages = PAGES) {
  const dir = mkdtempSync(join(tmpdir(), "patchlife-open-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(join(FIXTURES, "devices"), dir, { recursive: true });
  const get = async (url) => {
    if (!(url in pages)) throw Object.assign(new Error(`HTTP 404 for ${url}`), { status: 404, url });
    return { url, contentType: "text/html", text: pages[url] };
  };
  return { dir, get };
}

// workflows M4: refresh_open_pr re-parses over the PR's own rows, so a rename fixed on the branch fails the gate.
test("workflows M4: a refresh after a rename on the PR's branch passes the parser gate", async (t) => {
  const RENAME = "Video Doorbell 9 Plus (2027 release)";
  const before = SOURCES.map((s) => (s.brand_slug === "ring" ? { ...s, renames: s.renames.filter((r) => r.from !== RENAME) } : s));
  const { dir, get } = setup(t);
  await runCandidates(dir, { sources: before, today: TODAY, get, brands: ["ring"], limit: 10 });
  const refresh = await runCandidates(dir, { sources: SOURCES, today: TODAY, get, brands: ["ring"], limit: 10 });
  assert.equal(refresh.reports.reduce((n, r) => n + mismatches(r), 0), 0);
});

// fetchers F2: htmlToText is quadratic on unclosed markup a page controls. It stays as it is: every quote match and
// page hash depends on its output (docs/audits/2026-11-14-fetchers.md).
test("fetchers F2: htmlToText reads a page of unclosed tags in linear time", () => {
  const started = Date.now();
  htmlToText("<".repeat(100000)); // 100 KB: several seconds while quadratic
  assert.ok(Date.now() - started < 1000, `${Date.now() - started} ms`);
});
