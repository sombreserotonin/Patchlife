// Reproductions of the findings the audit of 14 Nov 2026 left open (docs/audits/2026-11-14-*.md, findings.jsonl).
// Each test fails while its defect is present and passes once it is fixed. npm test does not run this folder, so the
// suite stays green; a later sweep runs it with `node --test tests/audit/open-findings.test.mjs`, or one test with
// --test-name-pattern, as findings.jsonl records.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sampleLines } from "../../scripts/audit-sample.mjs";
import { mismatches, runCandidates } from "../../scripts/candidates.mjs";
import { createFetcher } from "../../scripts/polite-fetch.mjs";
import { tableRows } from "../../scripts/table-rows.mjs";
import { validateSources } from "../../scripts/validate-data.mjs";
import { htmlToText } from "../../scripts/verify-evidence.mjs";
import { FIXTURES, PAGES, RING, fixtureSources } from "../fixtures/parsers/profiles.mjs";

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

// record-writers L1: an exception kept only for its notes silences a later conflict for its model.
test("record-writers L1: a new date for a model whose record is an exception for its notes is flagged", async (t) => {
  const us = PAGES[RING.US].replace(/<\/tbody>(?![\s\S]*<\/tbody>)/, "<tr><td>Alarm Keypad Z</td><td>31 December 2031</td></tr></tbody>");
  const { dir, get } = setup(t, { ...PAGES, [RING.US]: us });
  const sources = SOURCES.map((s) => (s.brand_slug === "ring" ? { ...s, parser_exceptions: [...s.parser_exceptions, "ring-alarm-keypad-z"] } : s));
  const { flags } = await runCandidates(dir, { sources, today: TODAY, get, brands: ["ring"], check: true });
  assert.ok(flags.some((f) => f.includes("Alarm Keypad Z")), flags.join("\n"));
});

// record-writers L2: a rewrite can drop a region, and nothing in the PR says so.
test("record-writers L2: a rewrite that drops a region is flagged", async (t) => {
  const { dir, get } = setup(t, { ...PAGES, [RING.AU]: PAGES[RING.AU].replace("Ring Chime Z Pro (2nd Generation)", "Ring Chime Z Pro (2nd Generation) - Black") });
  const { flags } = await runCandidates(dir, { sources: SOURCES, today: TODAY, get, brands: ["ring"] });
  assert.ok(flags.some((f) => f.includes("ring-chime-z-pro-2nd-gen")), flags.join("\n"));
});

// record-writers L4 and fetchers F2: the row reader and htmlToText are quadratic on unclosed markup a page controls.
test("record-writers L4: the row reader reads a page of unclosed rows in linear time", () => {
  const started = Date.now();
  tableRows("<tr><td>x</td>".repeat(40000)); // 560 KB: about 5 s while quadratic
  assert.ok(Date.now() - started < 1000, `${Date.now() - started} ms`);
});

test("fetchers F2: htmlToText reads a page of unclosed tags in linear time", () => {
  const started = Date.now();
  htmlToText("<".repeat(100000)); // 100 KB: several seconds while quadratic
  assert.ok(Date.now() - started < 1000, `${Date.now() - started} ms`);
});

// fetchers L1: two fetches started together on one host fire at the same instant (latent: no caller does this yet).
test("fetchers L1: concurrent fetches to one host stay a second apart", async () => {
  let t = 0;
  let base = 0;
  const at = [];
  const fetch = async (url) => {
    if (!url.endsWith("/robots.txt")) at.push(t);
    return url.endsWith("/robots.txt") ? new Response("", { status: 404 }) : new Response("ok", { headers: { "content-type": "text/html" } });
  };
  const get = createFetcher({ fetch, now: () => t, sleep: (ms) => new Promise((r) => setTimeout(() => { t = Math.max(t, ms + base); r(); }, 0)) });
  await get("https://a.test/0");
  base = t;
  await Promise.all([get("https://a.test/1"), get("https://a.test/2")]);
  assert.ok(at[2] - at[1] >= 1000, `requests at ${at.join(", ")} ms`);
});

// ops-scripts L6: a spot-check link highlights only the first quote, so the "at least" sentence is never shown.
test("ops-scripts L6: a record's at-least quote on its second item is linked too", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "patchlife-sample-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "ring"));
  writeFileSync(join(dir, "ring", "ring-cam-1.yaml"), ["id: ring-cam-1", "brand: Ring", "model: Cam 1",
    'support: { rule: fixed_date, end_date: "2030-12-31", at_least: true }', "evidence:",
    '  - { url: "https://ring.com/p", quote: "Cam 1 31 December 2030" }',
    '  - { url: "https://ring.com/p", quote: "until at least four years from when" }', ""].join("\n"));
  const [line] = sampleLines(dir, ["ring-cam-1"]);
  assert.match(decodeURIComponent(line), /at least/);
});

