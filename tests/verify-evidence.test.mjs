import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { htmlToText, normalise, quoteMatches, verifyRecord } from "../scripts/verify-evidence.mjs";

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
