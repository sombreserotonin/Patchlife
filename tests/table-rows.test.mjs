import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readCell, rowQuoteProblems, tableRows } from "../scripts/table-rows.mjs";

const fixture = (name) => readFileSync(fileURLToPath(new URL(`./fixtures/parsers/${name}`, import.meta.url)), "utf8");

test("splits rows and cells on the raw HTML and joins the cell texts with single spaces", () => {
  const rows = tableRows(fixture("tp-link-au.html"));
  assert.equal(rows.length, 20);
  assert.deepEqual(rows[0].cells.map((c) => c.text), ["Product/ Model Name", "Model Number", "Defined Support Period"]);
  assert.equal(rows[3].quote, "Wi-Fi 6 Router Archer ZX90 V2 31/12/2028 or later*");
  // A section heading spans the table in one cell.
  assert.deepEqual(rows[1].cells, [{ text: "Home Networking", markers: [], span: 3 }]);
});

test("a cell's whitespace collapses, entities decode and nested inline tags vanish", () => {
  const rows = tableRows(fixture("ezviz-eol.html"));
  assert.equal(rows[2].quote, "Home Networking CS-Z2D-B2-EUP Europe 2022/12/31");
  assert.deepEqual(readCell("", "<p><b>Tapo</b>&nbsp;Z1 <a href=x>V1</a></p>"), { text: "Tapo Z1 V1", markers: [], span: 1 });
  assert.deepEqual(readCell(" colspan='2'", " <!-- note --> 31&#47;12&#x2F;2027 "), { text: "31/12/2027", markers: [], span: 2 });
});

test("keeps <sup> content as a marker beside the cell instead of fusing it into the text", () => {
  const html = fixture("footnote-markers.html");
  const rows = tableRows(html);
  assert.deepEqual(rows[1].cells, [
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
