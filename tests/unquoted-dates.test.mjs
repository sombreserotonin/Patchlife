import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { unquotedDates, unquotedIn } from "../scripts/unquoted-dates.mjs";
import { normalise } from "../scripts/verify-evidence.mjs";

const VALID = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "valid");
const dates = (text, quotes) => unquotedIn(normalise(text), quotes).map((d) => d.date);

test("a date inside a recorded row's quote is covered; a new row's date and a prose date are not", () => {
  const page = "Updated 1 July 2026. Model Support ends Acme Cam 1 30 June 2029 Acme Cam 2 31 December 2030";
  assert.deepEqual(dates(page, ["Acme Cam 1 30 June 2029"]), ["1 july 2026", "31 december 2030"]);
  const [, row] = unquotedIn(normalise(page), ["Acme Cam 1 30 June 2029"]);
  assert.equal(row.context, "updated 1 july 2026. model support ends acme cam 1 30 june 2029 acme cam 2 31 december 2030");
});

test("every date form the records use is found, and a date only part-covered by a quote still counts", () => {
  const page = "a 31st Dec 2027 b December 31, 2027 c 2029/12/31 d 2027-12-31 e 8/24/2026 f 31/12/2028 g Sept. 2027 h 3.4.2027";
  assert.deepEqual(dates(page, []), ["31st dec 2027", "december 31, 2027", "2029/12/31", "2027-12-31", "8/24/2026", "31/12/2028", "sept. 2027", "3.4.2027"]);
  assert.deepEqual(dates("Acme Cam 1 30 June 2029", ["Acme Cam 1 30 June"]), ["30 june 2029"]);
  assert.deepEqual(dates("v2.1.3 2029 build 20291231 version 12/2029x market 2027 dismay 2027 x2027-12-31", []), []);
  // A row quoted once is covered wherever it appears, for example in a table repeated for each region.
  assert.deepEqual(dates("UK Acme Cam 1 30 June 2029 AU Acme Cam 1 30 June 2029", ["Acme Cam 1 30 June 2029"]), []);
});

test("unquotedDates reads every cited page, or the ones named, and reports a page it can't read", async () => {
  const pages = {
    "https://example.com/acme/security": "<td>Acme Cam 1</td><td>30 June 2029</td><td>Acme Cam 9</td><td>30 June 2031</td>",
    "https://example.com/acme/eol": "<p>Router 2 End of Life 31 March 2025</p>",
    "https://example.com/acme/hub-4": "<p>We searched and found no date.</p>",
    "https://example.com/acme/leap-5": "<p>Acme Leap 5 gets security updates for at least 3 years from launch on 29 February 2024.</p>",
  };
  const get = async (url) => {
    if (url.endsWith("/psti")) return { url: "https://example.com/", contentType: "text/html", text: "" };
    if (!(url in pages)) throw Object.assign(new Error(`HTTP 404 for ${url}`), { status: 404 });
    return { url, contentType: "text/html", text: pages[url] };
  };
  const all = await unquotedDates(VALID, { get });
  assert.deepEqual(all.map(({ url, dates: found, error }) => [url, error ?? found.map((d) => d.date)]), [
    ["https://example.com/acme/eol", []],
    ["https://example.com/acme/hub-4", []],
    ["https://example.com/acme/leap-5", []],
    ["https://example.com/acme/psti", "redirected to https://example.com/"],
    ["https://example.com/acme/security", ["30 june 2031"]],
  ]);
  const named = await unquotedDates(VALID, { get, urls: ["https://example.com/acme/security", "https://example.com/acme/gone"] });
  assert.deepEqual(named.map((r) => r.error ?? r.dates.length), [1, "HTTP 404 for https://example.com/acme/gone"]);
});
