import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { htmlToText, normalise, quoteMatches, verifyDevices, verifyRecord } from "../scripts/verify-evidence.mjs";
import { validateDevices } from "../scripts/validate-data.mjs";

const html = readFileSync(new URL("./fixtures/evidence/ring-policy.html", import.meta.url), "utf8");
const TODAY = "2026-10-21";
const record = (quote = "Ring Video Doorbell 3 31 December 2027") => ({
  support: { rule: "fixed_date" },
  evidence: [{ url: "https://example.test/policy", quote }],
  verification: { status: "unverified", checked: null, text_sha256: null },
});

test("normalise applies NFKC, collapses whitespace and ignores case", () => {
  assert.equal(normalise("  Ｒing  Video\n\tDoorbell "), "ring video doorbell");
});

test("htmlToText drops scripts and styles and joins table cells with single spaces", () => {
  const text = normalise(htmlToText(html));
  assert.ok(text.includes("ring video doorbell 3 31 december 2027"));
  assert.ok(!text.includes("color:red"));
  assert.ok(!text.includes("var a"));
});

test("htmlToText decodes entities", () => {
  assert.ok(normalise(htmlToText(html)).includes("ring’s policy"));
});

test("htmlToText drops comments and inline tags without adding spaces", () => {
  assert.equal(normalise(htmlToText("Doorbell <!-- -->3<!-- -->.")), "doorbell 3.");
  assert.equal(normalise(htmlToText("until <strong>31 December 2027</strong>.")), "until 31 december 2027.");
  assert.equal(normalise(htmlToText("31<sup>st</sup> December")), "31st december");
  assert.equal(normalise(htmlToText("<td>Ring</td><td>31 Dec</td><abbr>EOL</abbr><br>x")), "ring 31 dec eol x");
});

test("htmlToText decodes Latin-1 and typographic entities, and normalise drops invisible characters", () => {
  assert.equal(normalise(htmlToText("Ring&reg; Cam&trade; &Eacute;t&eacute; &frac12;&hellip;")), "ring® camtm été 1⁄2...");
  assert.equal(normalise("Door\u00adbell\u200b 3\ufeff"), "doorbell 3");
});

test("a quote matches regardless of case and spacing", () => {
  assert.ok(quoteMatches("RING video  doorbell 3 31 December 2027", htmlToText(html)));
});

test("a changed date does not match", () => {
  assert.equal(quoteMatches("Ring Video Doorbell 3 31 December 2028", htmlToText(html)), false);
});

test("a matching quote marks the record verified with the hash of the normalised text", () => {
  const result = verifyRecord(record(), [html], TODAY);
  assert.equal(result.ok, true);
  assert.deepEqual(result.verification, {
    status: "verified",
    checked: TODAY,
    text_sha256: createHash("sha256").update(normalise(htmlToText(html))).digest("hex"),
  });
});

test("a missing quote fails and leaves verification untouched", () => {
  const result = verifyRecord(record("Ring Video Doorbell 3 31 December 2028"), [html], TODAY);
  assert.equal(result.ok, false);
  assert.match(result.reason, /quote not found/);
  assert.equal(result.verification, undefined);
});

test("every evidence item must match", () => {
  const rec = record();
  rec.evidence.push({ url: "https://example.test/other", quote: "not on this page" });
  assert.equal(verifyRecord(rec, [html, html], TODAY).ok, false);
});

test("none_published has no quote to check and is not verified here", () => {
  const rec = { ...record(), support: { rule: "none_published" } };
  rec.evidence = [{ url: "https://example.test/policy" }];
  const result = verifyRecord(rec, [html], TODAY);
  assert.equal(result.ok, false);
  assert.match(result.reason, /none_published/);
});

test("a missing page text fails", () => {
  const result = verifyRecord(record(), [null], TODAY);
  assert.equal(result.ok, false);
  assert.match(result.reason, /no text/);
});

// verifyDevices runs against a temporary copy of the valid fixtures with a fake fetcher.
const PAGES = {
  "https://example.com/acme/security": "<p>Acme Cam 1 31 December 2029</p>",
  "https://example.com/acme/leap-5": "<p>Security updates for at least 3 years from launch on 29 February 2024.</p>",
  "https://example.com/acme/psti": "<p>The defined support period will end 3 years after the product's end-of-life date.</p>",
  "https://example.com/acme/eol": "<table><tr><td>Router 2</td><td>End of Life</td><td>31 March 2025</td></tr></table>",
};

function setupDevices(pages = PAGES) {
  const dir = mkdtempSync(join(tmpdir(), "patchlife-"));
  cpSync(new URL("./fixtures/valid", import.meta.url), dir, { recursive: true });
  const fetched = [];
  const get = async (url) => {
    fetched.push(url);
    if (!(url in pages)) throw Object.assign(new Error(`HTTP 404 for ${url}`), { status: 404 });
    return { url, contentType: "text/html", text: pages[url] };
  };
  const file = (id) => join(dir, "acme", `${id}.yaml`);
  const read = (id) => readFileSync(file(id), "utf8");
  return { dir, get, fetched, file, read };
}

const outcomes = (results) => Object.fromEntries(results.map((r) => [r.id, r.outcome]));
const beforeVerification = (yaml) => yaml.slice(0, yaml.indexOf("verification:"));

test("verifyDevices writes verified, marks a changed quote stale and skips none_published", async () => {
  const { dir, get, fetched, read } = setupDevices();
  const before = read("acme-router-2");
  const results = await verifyDevices(dir, { get, today: TODAY });
  assert.deepEqual(outcomes(results), {
    "acme-cam-1": "stale",
    "acme-hub-4": "skipped",
    "acme-leap-5": "verified",
    "acme-plug-3": "verified",
    "acme-router-2": "verified",
  });
  assert.match(read("acme-leap-5"), /status: verified\n  checked: "2026-10-21"\n  text_sha256: [a-f0-9]{64}\n/);
  assert.match(read("acme-cam-1"), /status: stale\n  checked: "2026-10-02"/);
  assert.equal(beforeVerification(read("acme-router-2")), beforeVerification(before));
  assert.equal(fetched.filter((u) => u === "https://example.com/acme/psti").length, 1);
  assert.deepEqual(validateDevices(dir, { today: TODAY }).errors, []);
});

test("verifyDevices leaves an unverified record unchanged when its quote is missing", async () => {
  const { dir, get, read } = setupDevices({ ...PAGES, "https://example.com/acme/leap-5": "<p>Nothing here</p>" });
  const before = read("acme-leap-5");
  const results = await verifyDevices(dir, { get, today: TODAY, ids: ["acme-leap-5"] });
  assert.deepEqual(results, [{ id: "acme-leap-5", outcome: "failed", reason: "quote not found at https://example.com/acme/leap-5" }]);
  assert.equal(read("acme-leap-5"), before);
});

test("verifyDevices leaves files unchanged when a page cannot be fetched or is not text", async () => {
  const pages = { ...PAGES };
  delete pages["https://example.com/acme/leap-5"];
  const { dir, get, read } = setupDevices(pages);
  const pdf = async (url) => (url.endsWith("/eol") ? { url, contentType: "application/pdf", text: "%PDF" } : get(url));
  const before = { leap: read("acme-leap-5"), router: read("acme-router-2") };
  const results = await verifyDevices(dir, { get: pdf, today: TODAY, ids: ["acme-leap-5", "acme-router-2"] });
  assert.deepEqual(outcomes(results), { "acme-leap-5": "error", "acme-router-2": "error" });
  assert.match(results.find((r) => r.id === "acme-router-2").reason, /unsupported content type "application\/pdf"/);
  assert.deepEqual({ leap: read("acme-leap-5"), router: read("acme-router-2") }, before);
});

test("verifyDevices marks a verified record stale when its page is gone, but not on other errors", async () => {
  const gone = { ...PAGES };
  delete gone["https://example.com/acme/security"];
  const removed = setupDevices(gone);
  const results = await verifyDevices(removed.dir, { get: removed.get, today: TODAY, ids: ["acme-cam-1"] });
  assert.deepEqual(results, [{ id: "acme-cam-1", outcome: "stale", reason: "HTTP 404 for https://example.com/acme/security" }]);
  assert.match(removed.read("acme-cam-1"), /status: stale/);

  const down = setupDevices();
  const before = down.read("acme-cam-1");
  const failing = async () => { throw Object.assign(new Error("HTTP 500 for https://example.com/acme/security"), { status: 500 }); };
  assert.deepEqual(outcomes(await verifyDevices(down.dir, { get: failing, today: TODAY, ids: ["acme-cam-1"] })), { "acme-cam-1": "error" });
  assert.equal(down.read("acme-cam-1"), before);
});

// acme-cam-1 is verified and its quote is not on the page, so reading the redirected page would mark it stale.
test("verifyDevices reports a redirect to another origin or path as an error and leaves the record unchanged", async () => {
  for (const to of ["https://example.com/", "https://www.example.com/acme/security"]) {
    const { dir, get, read } = setupDevices();
    const moved = async (url) => ({ ...(await get(url)), url: to });
    const before = read("acme-cam-1");
    const results = await verifyDevices(dir, { get: moved, today: TODAY, ids: ["acme-cam-1"] });
    assert.deepEqual(results, [{ id: "acme-cam-1", outcome: "error", reason: `redirected to ${to}` }]);
    assert.equal(read("acme-cam-1"), before);
  }
});

test("verifyDevices still verifies after a redirect that changes only a trailing slash, query string or fragment", async () => {
  for (const suffix of ["/", "?hl=en", "#top", "/?ref=home"]) {
    const { dir, get } = setupDevices();
    const moved = async (url) => ({ ...(await get(url)), url: url + suffix });
    const results = await verifyDevices(dir, { get: moved, today: TODAY, ids: ["acme-leap-5"] });
    assert.deepEqual(results, [{ id: "acme-leap-5", outcome: "verified" }]);
  }
});

test("verifyDevices skips disputed records and reports unknown ids", async () => {
  const { dir, get, file, read } = setupDevices();
  writeFileSync(file("acme-cam-1"), read("acme-cam-1").replace("status: verified", "status: disputed"));
  const before = read("acme-cam-1");
  const results = await verifyDevices(dir, { get, today: TODAY, ids: ["acme-cam-1", "acme-nope"] });
  assert.deepEqual(results, [
    { id: "acme-cam-1", outcome: "skipped", reason: "disputed" },
    { id: "acme-nope", outcome: "error", reason: "no record with this id" },
  ]);
  assert.equal(read("acme-cam-1"), before);
});
