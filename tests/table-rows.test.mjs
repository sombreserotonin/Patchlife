import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readCell, rowQuoteProblems, tableRows } from "../scripts/table-rows.mjs";
import { htmlToText } from "../scripts/verify-evidence.mjs";

const fixture = (name) => readFileSync(fileURLToPath(new URL(`./fixtures/parsers/${name}`, import.meta.url)), "utf8");

test("splits rows and cells on the raw HTML and joins the cell texts with single spaces", () => {
  const rows = tableRows(fixture("tp-link-au.html"));
  assert.equal(rows.length, 20);
  assert.deepEqual(rows[0].cells.map((c) => c.text), ["Product/ Model Name", "Model Number", "Defined Support Period"]);
  assert.equal(rows[3].quote, "Wi-Fi 6 Router Archer ZX90 V2 31/12/2028 or later*");
  // A section heading spans the table in one cell.
  assert.deepEqual(rows[1].cells.map(({ html, ...cell }) => cell), [{ text: "Home Networking", markers: [], span: 3 }]);
  assert.match(rows[1].cells[0].html, /<p align="center" class="paragraph">Home Networking<\/p>/);
});

test("a cell's whitespace collapses, entities decode and nested inline tags vanish", () => {
  const rows = tableRows(fixture("ezviz-eol.html"));
  assert.equal(rows[2].quote, "Home Networking CS-Z2D-B2-EUP Europe 2022/12/31");
  assert.deepEqual(readCell("", "<p><b>Tapo</b>&nbsp;Z1 <a href=x>V1</a></p>"), { text: "Tapo Z1 V1", markers: [], span: 1, html: "<p><b>Tapo</b>&nbsp;Z1 <a href=x>V1</a></p>" });
  assert.deepEqual(readCell(" colspan='2'", " <!-- note --> 31&#47;12&#x2F;2027 "), { text: "31/12/2027", markers: [], span: 2, html: " <!-- note --> 31&#47;12&#x2F;2027 " });
});

test("keeps <sup> content as a marker beside the cell instead of fusing it into the text", () => {
  const html = fixture("footnote-markers.html");
  const rows = tableRows(html);
  assert.deepEqual(rows[1].cells.map(({ html, ...cell }) => cell), [
    { text: "Tapo Z200", markers: ["1"], span: 1 },
    { text: "31/12/2027", markers: ["2"], span: 1 },
  ]);
  assert.equal(rows[1].quote, "Tapo Z200 31/12/2027");
  assert.deepEqual(rows[2].cells.map((c) => c.markers), [[], []]);
  assert.equal(rows[3].quote, "Notes");
});

test("reports the rows whose quote the verifier would not find in the page text", async () => {
  const html = fixture("footnote-markers.html");
  const rows = tableRows(html);
  // The page text reads "Tapo Z2001 31/12/20272", so no quote of that row's cells can be verified.
  assert.deepEqual(await rowQuoteProblems(rows, html), [{ quote: "Tapo Z200 31/12/2027", reason: "quote not found in the page text" }]);
  const clean = fixture("tp-link-au.html");
  assert.deepEqual(await rowQuoteProblems(tableRows(clean), clean), []);
});

test("rows outside any table and empty cells do not break the reader", () => {
  assert.deepEqual(tableRows("<p>No table here</p>"), []);
  const [row] = tableRows("<table><tr><td></td><td>Only</td><td> </td></tr></table>");
  assert.deepEqual(row.cells.map((c) => c.text), ["", "Only", ""]);
  assert.equal(row.quote, "Only");
});

// The row reader as it was before the audit of 14 Nov 2026 (record-writers L4): the reference the linear scan must
// agree with, row for row, cell for cell and marker for marker.
const OLD_ROW = /<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi;
const OLD_CELL = /<t([dh])\b([^>]*)>([\s\S]*?)<\/t\1\s*>/gi;
const OLD_SUP = /<sup\b[^>]*>([\s\S]*?)<\/sup\s*>/gi;
const collapse = (text) => text.replace(/\s+/g, " ").trim();
function oldReadCell(attrs, inner) {
  const markers = [];
  const rest = inner.replace(OLD_SUP, (match, sup) => {
    const marker = collapse(htmlToText(sup));
    if (marker) markers.push(marker);
    return " ";
  });
  const span = Number(attrs.match(/\bcolspan\s*=\s*["']?(\d+)/i)?.[1] ?? 1);
  return { text: collapse(htmlToText(rest)), markers, span: span > 0 ? span : 1, html: inner };
}
function oldTableRows(html) {
  const rows = [];
  for (const [, inner] of html.matchAll(OLD_ROW)) {
    const cells = [...inner.matchAll(OLD_CELL)].map(([, , attrs, body]) => oldReadCell(attrs, body));
    rows.push({ cells, quote: cells.map((c) => c.text).filter(Boolean).join(" ") });
  }
  return rows;
}

test("every fixture page reads the same rows as the expressions the scan replaced", () => {
  const dir = fileURLToPath(new URL("./fixtures/parsers/", import.meta.url));
  const pages = readdirSync(dir).filter((name) => name.endsWith(".html"));
  assert.ok(pages.length >= 15);
  for (const name of pages) {
    const html = readFileSync(join(dir, name), "utf8");
    assert.deepEqual(tableRows(html), oldTableRows(html), name);
  }
});

test("random tag soup reads the same rows, cells and footnotes as the expressions the scan replaced", () => {
  const TOKENS = ["<tr>", "<tr", "<TR class=a>", "</tr>", "</tr >", "</TR\n>", "</tr", "<td>", "<td", "<TD x>", "<th colspan=2>", "</td>", "</th>", "</TD>",
    "</th >", "<sup>", "<sup", "<SUP>", "</sup>", "</SUP >", "<thead>", "<track>", "<tr1>", "<td-x>", ">", "<", "a", "1", " ", "\n", "x>y", "<p>", "</p>", "&amp;"];
  let seed = 20261114;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < 5000; i++) {
    const html = Array.from({ length: 1 + Math.floor(random() * 48) }, () => TOKENS[Math.floor(random() * TOKENS.length)]).join("");
    assert.deepEqual(tableRows(html), oldTableRows(html), JSON.stringify(html));
    assert.deepEqual(readCell(" colspan=3", html), oldReadCell(" colspan=3", html), JSON.stringify(html));
  }
});

// record-writers L4: the row expression rescanned the rest of the page from every opening tag never closed.
test("a page of unclosed rows, cells or footnotes is read in linear time", () => {
  // These time the row reader's own scan. A cell full of tags that never end still costs quadratic time, in the
  // htmlToText that reads each cell's text (fetchers F2, open), so a footnote's opening tag is ended here.
  const cases = {
    "rows never closed": `<table><tr><td>A</td></tr>${"<tr>".repeat(200000)}`,
    "rows whose tag never ends": `<table><tr><td>A</td></tr>${"<tr".repeat(200000)}`,
    "cells never closed": `<table><tr>${"<td>".repeat(200000)}</tr>`,
    "footnotes never closed": `<table><tr><td>${"<sup>".repeat(200000)}</td></tr>`,
  };
  for (const [name, html] of Object.entries(cases)) {
    const started = performance.now();
    tableRows(html);
    const ms = performance.now() - started;
    assert.ok(ms < 1000, `${name}: ${Math.round(ms)} ms`);
  }
});
